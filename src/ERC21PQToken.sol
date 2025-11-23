// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { OFT } from "@layerzerolabs/oapp-evm/contracts/oft/OFT.sol";
import { SendParam, MessagingFee, MessagingReceipt, OFTReceipt } from "@layerzerolabs/oapp-evm/contracts/oft/interfaces/IOFT.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IStarkVerifier } from "./interfaces/IStarkVerifier.sol";

/// @title ERC21PQToken
/// @notice ERC-20 compatible token with optional STARK-based ownership lock (ERC-21)
/// @dev Extends LayerZero OFT for cross-chain capability with ZK guard mechanism
/// @dev Uses STARKs for quantum-resistant proofs (no trusted setup, hash-based)
/// @author EthVaultPQ Team
contract ERC21PQToken is OFT {
    // =============================================================
    //                         CONSTANTS
    // =============================================================

    /// @notice Prime field modulus for STARK proofs (Cairo field)
    uint256 constant STARK_PRIME =
        3618502788666131213697322783095070105623107215331596699973092056135872020481;

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice The STARK verifier contract (quantum-resistant)
    IStarkVerifier public immutable verifier;

    /// @notice The program hash for HD commitment verification
    bytes32 public immutable programHash;

    /// @notice HD commitment for each address (hash of hdSecret)
    mapping(address => bytes32) public hdCommitment;

    /// @notice Whether ZK guard is enabled for each address
    mapping(address => bool) public zkGuardEnabled;

    /// @notice Nonce for ZK transfers to prevent replay attacks
    mapping(address => uint256) public zkNonce;

    /// @dev Internal flag to track if we're in a ZK transfer context
    bool private _zkContextActive;

    // =============================================================
    //                           EVENTS
    // =============================================================

    /// @notice Emitted when an HD commitment is bound to an address
    event HDCommitmentBound(address indexed account, bytes32 commitment);

    /// @notice Emitted when ZK guard is enabled for an address
    event ZKGuardEnabled(address indexed account);

    /// @notice Emitted when ZK guard is disabled for an address
    event ZKGuardDisabled(address indexed account);

    /// @notice Emitted when a ZK-verified transfer is executed
    event ZKTransfer(address indexed from, address indexed to, uint256 amount, uint256 nonce);

    /// @notice Emitted when a ZK proof verification fails (for Graph indexing)
    event ZKProofFailed(address indexed from, address indexed to, uint256 amount, string reason);

    /// @notice Emitted when disabling ZK guard fails
    event ZKDisableFailed(address indexed account, string reason);

    /// @notice Emitted when an unauthorized transfer attempt is blocked
    event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason);

    /// @notice Emitted when a ZK-verified cross-chain send is executed
    event ZKSend(
        bytes32 indexed guid,
        uint32 dstEid,
        address indexed from,
        uint256 amountSentLD,
        uint256 nonce
    );

    // =============================================================
    //                           ERRORS
    // =============================================================

    /// @notice Thrown when trying to bind an HD commitment that's already set
    error CommitmentAlreadyBound();

    /// @notice Thrown when trying to enable ZK guard without a commitment
    error NoCommitmentBound();

    /// @notice Thrown when a guarded address tries to use normal transfer
    error ZKGuardEnabled_UseTransferZK();

    /// @notice Thrown when ZK proof verification fails
    error InvalidProof();

    /// @notice Thrown when nonce in proof doesn't match on-chain nonce
    error InvalidNonce();

    /// @notice Thrown when commitment in proof doesn't match on-chain commitment
    error InvalidCommitment();

    /// @notice Thrown when ZK guard is not enabled for the sender
    error ZKGuardNotEnabled();

    /// @notice Thrown when insufficient balance for transfer
    error InsufficientBalance();

    /// @notice Thrown when a guarded address tries to use normal cross-chain send
    error ZKGuardEnabled_UseSendZK();

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /// @notice Constructor for ERC21PQToken
    /// @param _name Token name
    /// @param _symbol Token symbol
    /// @param _lzEndpoint LayerZero endpoint address
    /// @param _delegate Address that can configure OApp
    /// @param _verifier STARK verifier contract address
    /// @param _programHash Hash of the Cairo program for verification
    /// @param _initialSupply Initial token supply to mint to deployer
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate,
        address _verifier,
        bytes32 _programHash,
        uint256 _initialSupply
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) Ownable(_delegate) {
        verifier = IStarkVerifier(_verifier);
        programHash = _programHash;

        // Mint initial supply to deployer
        if (_initialSupply > 0) {
            _mint(_delegate, _initialSupply);
        }
    }

    // =============================================================
    //                      ZK GUARD FUNCTIONS
    // =============================================================

    /// @notice Setup quantum protection in one transaction (bind + enable)
    /// @param commitment The hash of the caller's HD secret
    /// @dev Combines bindHD and enableZKGuard into single call
    function setupProtection(bytes32 commitment) external {
        if (hdCommitment[msg.sender] != bytes32(0)) {
            revert CommitmentAlreadyBound();
        }

        hdCommitment[msg.sender] = commitment;
        zkGuardEnabled[msg.sender] = true;

        emit HDCommitmentBound(msg.sender, commitment);
        emit ZKGuardEnabled(msg.sender);
    }

    /// @notice Bind an HD commitment to the caller's address
    /// @param commitment The hash of the caller's HD secret
    /// @dev Can only be set once per address
    function bindHD(bytes32 commitment) external {
        if (hdCommitment[msg.sender] != bytes32(0)) {
            revert CommitmentAlreadyBound();
        }

        hdCommitment[msg.sender] = commitment;
        emit HDCommitmentBound(msg.sender, commitment);
    }

    /// @notice Enable ZK guard for the caller's address
    /// @dev Requires an HD commitment to be bound first
    function enableZKGuard() external {
        if (hdCommitment[msg.sender] == bytes32(0)) {
            revert NoCommitmentBound();
        }

        zkGuardEnabled[msg.sender] = true;
        emit ZKGuardEnabled(msg.sender);
    }

    /// @notice Disable ZK guard (requires STARK proof of ownership)
    /// @param proof The STARK proof proving ownership of HD secret
    /// @param publicInputs Public inputs for verification
    /// @return success True if guard was disabled
    function disableZKGuard(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external returns (bool success) {
        if (!zkGuardEnabled[msg.sender]) {
            emit ZKDisableFailed(msg.sender, "ZK guard not enabled");
            return false;
        }

        // Verify STARK proof to prove ownership
        if (!verifier.verifyProof(proof, publicInputs, programHash)) {
            emit ZKDisableFailed(msg.sender, "Invalid proof");
            return false;
        }

        // Verify the proof is for this address
        if (publicInputs.length < 5) {
            emit ZKDisableFailed(msg.sender, "Invalid public inputs");
            return false;
        }

        if (address(uint160(publicInputs[0])) != msg.sender) {
            emit ZKDisableFailed(msg.sender, "Proof not for sender");
            return false;
        }

        // Verify commitment matches (reduced to STARK field)
        uint256 proofCommitment = publicInputs[4];
        uint256 expectedCommitment = uint256(hdCommitment[msg.sender]) % STARK_PRIME;
        if (proofCommitment != expectedCommitment) {
            emit ZKDisableFailed(msg.sender, "Invalid commitment");
            return false;
        }

        zkGuardEnabled[msg.sender] = false;
        emit ZKGuardDisabled(msg.sender);
        return true;
    }

    /// @notice Execute a ZK-verified transfer
    /// @param from The address to transfer from
    /// @param to The recipient address
    /// @param amount The amount to transfer
    /// @param proof The STARK proof data (quantum-resistant)
    /// @param publicInputs The public inputs (from, to, amount, nonce, commitment)
    /// @return success True if transfer succeeded
    function transferZK(
        address from,
        address to,
        uint256 amount,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external returns (bool success) {
        // Verify ZK guard is enabled
        if (!zkGuardEnabled[from]) {
            emit ZKProofFailed(from, to, amount, "ZK guard not enabled");
            return false;
        }

        // Verify balance
        if (balanceOf(from) < amount) {
            emit ZKProofFailed(from, to, amount, "Insufficient balance");
            return false;
        }

        // Verify STARK proof (quantum-resistant)
        if (!verifier.verifyProof(proof, publicInputs, programHash)) {
            emit ZKProofFailed(from, to, amount, "Invalid proof");
            return false;
        }

        // Extract and verify public inputs
        // Expected order: [from, to, amount, nonce, commitment]
        if (publicInputs.length < 5) {
            emit ZKProofFailed(from, to, amount, "Invalid public inputs length");
            return false;
        }

        address proofFrom = address(uint160(publicInputs[0]));
        address proofTo = address(uint160(publicInputs[1]));
        uint256 proofAmount = publicInputs[2];
        uint256 proofNonce = publicInputs[3];
        uint256 proofCommitment = publicInputs[4];

        // Verify inputs match
        if (proofFrom != from || proofTo != to || proofAmount != amount) {
            emit ZKProofFailed(from, to, amount, "Input mismatch");
            return false;
        }

        // Verify nonce
        if (proofNonce != zkNonce[from]) {
            emit ZKProofFailed(from, to, amount, "Invalid nonce");
            return false;
        }

        // Verify commitment (reduced to STARK field)
        uint256 expectedCommitment = uint256(hdCommitment[from]) % STARK_PRIME;
        if (proofCommitment != expectedCommitment) {
            emit ZKProofFailed(from, to, amount, "Invalid commitment");
            return false;
        }

        // Execute transfer in ZK context
        _zkContextActive = true;
        _transfer(from, to, amount);
        _zkContextActive = false;

        // Increment nonce
        zkNonce[from] += 1;

        emit ZKTransfer(from, to, amount, proofNonce);

        return true;
    }

    /// @notice Try to transfer tokens (emits event on failure instead of reverting)
    /// @dev Used for testing/demo - allows Graph to index failed attempts
    /// @param to The recipient address
    /// @param amount The amount to transfer
    /// @return success True if transfer succeeded
    function tryTransfer(address to, uint256 amount) external returns (bool success) {
        address from = msg.sender;

        // Check ZK guard
        if (zkGuardEnabled[from]) {
            emit TransferBlocked(from, to, amount, "ZK guard enabled - use transferZK");
            return false;
        }

        // Check balance
        if (balanceOf(from) < amount) {
            emit TransferBlocked(from, to, amount, "Insufficient balance");
            return false;
        }

        // Execute transfer
        _transfer(from, to, amount);
        return true;
    }

    // =============================================================
    //                    INTERNAL OVERRIDES
    // =============================================================

    /// @notice Override _update to enforce ZK guard
    /// @dev This is called by all transfer functions in OZ v5
    function _update(address from, address to, uint256 amount) internal virtual override {
        // Check ZK guard for outgoing transfers (not mints)
        if (from != address(0) && zkGuardEnabled[from]) {
            if (!_zkContextActive) {
                revert ZKGuardEnabled_UseTransferZK();
            }
        }

        super._update(from, to, amount);
    }

    /// @notice Override _debit to block ZK-guarded accounts from regular send()
    /// @dev Forces ZK-guarded users to use sendZK() for cross-chain transfers
    function _debit(
        address _from,
        uint256 _amountLD,
        uint256 _minAmountLD,
        uint32 _dstEid
    ) internal virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
        // Block ZK-guarded accounts from using regular send()
        if (zkGuardEnabled[_from] && !_zkContextActive) {
            revert ZKGuardEnabled_UseSendZK();
        }

        return super._debit(_from, _amountLD, _minAmountLD, _dstEid);
    }

    // =============================================================
    //                   CROSS-CHAIN ZK FUNCTIONS
    // =============================================================

    /// @notice Execute a ZK-verified cross-chain send
    /// @param _sendParam The parameters for the send operation
    /// @param _fee The LayerZero messaging fee
    /// @param _refundAddress The address to receive any excess funds
    /// @param proof The STARK proof data
    /// @param publicInputs The public inputs for verification
    /// @return msgReceipt The LayerZero messaging receipt
    /// @return oftReceipt The OFT receipt information
    function sendZK(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external payable returns (MessagingReceipt memory msgReceipt, OFTReceipt memory oftReceipt) {
        address from = msg.sender;
        address to = address(uint160(uint256(_sendParam.to)));
        uint256 amount = _sendParam.amountLD;

        // Verify ZK guard is enabled
        if (!zkGuardEnabled[from]) {
            revert ZKGuardNotEnabled();
        }

        // Verify balance
        if (balanceOf(from) < amount) {
            revert InsufficientBalance();
        }

        // Verify STARK proof
        if (!verifier.verifyProof(proof, publicInputs, programHash)) {
            revert InvalidProof();
        }

        // Verify public inputs
        if (publicInputs.length < 5) {
            revert InvalidProof();
        }

        address proofFrom = address(uint160(publicInputs[0]));
        address proofTo = address(uint160(publicInputs[1]));
        uint256 proofAmount = publicInputs[2];
        uint256 proofNonce = publicInputs[3];
        uint256 proofCommitment = publicInputs[4];

        // Verify inputs match
        if (proofFrom != from || proofTo != to || proofAmount != amount) {
            revert InvalidProof();
        }

        // Verify nonce
        if (proofNonce != zkNonce[from]) {
            revert InvalidNonce();
        }

        // Verify commitment
        uint256 expectedCommitment = uint256(hdCommitment[from]) % STARK_PRIME;
        if (proofCommitment != expectedCommitment) {
            revert InvalidCommitment();
        }

        // Increment nonce before send (prevents reentrancy)
        uint256 currentNonce = zkNonce[from];
        zkNonce[from] += 1;

        // Execute debit in ZK context (burns tokens)
        _zkContextActive = true;
        (uint256 amountSentLD, uint256 amountReceivedLD) = _debit(
            from,
            _sendParam.amountLD,
            _sendParam.minAmountLD,
            _sendParam.dstEid
        );
        _zkContextActive = false;

        // Build message and options
        (bytes memory message, bytes memory options) = _buildMsgAndOptions(_sendParam, amountReceivedLD);

        // Send via LayerZero
        msgReceipt = _lzSend(_sendParam.dstEid, message, options, _fee, _refundAddress);
        oftReceipt = OFTReceipt(amountSentLD, amountReceivedLD);

        emit OFTSent(msgReceipt.guid, _sendParam.dstEid, from, amountSentLD, amountReceivedLD);
        emit ZKSend(msgReceipt.guid, _sendParam.dstEid, from, amountSentLD, currentNonce);

        return (msgReceipt, oftReceipt);
    }

    /// @notice Get a quote for sendZK() operation
    /// @param _sendParam The parameters for the send operation
    /// @param _payInLzToken Flag indicating whether to pay in LZ token
    /// @return msgFee The calculated LayerZero messaging fee
    function quoteSendZK(
        SendParam calldata _sendParam,
        bool _payInLzToken
    ) external view returns (MessagingFee memory msgFee) {
        return this.quoteSend(_sendParam, _payInLzToken);
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================

    /// @notice Check if an address has ZK guard protection
    /// @param account The address to check
    /// @return True if ZK guard is enabled
    function isGuarded(address account) external view returns (bool) {
        return zkGuardEnabled[account];
    }

    /// @notice Get the current nonce for an address
    /// @param account The address to check
    /// @return The current nonce
    function getNonce(address account) external view returns (uint256) {
        return zkNonce[account];
    }

    /// @notice Get the HD commitment for an address
    /// @param account The address to check
    /// @return The HD commitment
    function getCommitment(address account) external view returns (bytes32) {
        return hdCommitment[account];
    }
}

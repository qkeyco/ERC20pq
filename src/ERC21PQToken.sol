// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { OFT } from "@layerzerolabs/oapp-evm/contracts/oft/OFT.sol";
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
    function disableZKGuard(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external {
        if (!zkGuardEnabled[msg.sender]) {
            revert ZKGuardNotEnabled();
        }

        // Verify STARK proof to prove ownership
        if (!verifier.verifyProof(proof, publicInputs, programHash)) {
            revert InvalidProof();
        }

        // Verify the proof is for this address
        require(publicInputs.length >= 5, "Invalid public inputs");
        require(address(uint160(publicInputs[0])) == msg.sender, "Proof not for sender");

        // Verify commitment matches (reduced to STARK field)
        uint256 proofCommitment = publicInputs[4];
        uint256 expectedCommitment = uint256(hdCommitment[msg.sender]) % STARK_PRIME;
        if (proofCommitment != expectedCommitment) {
            revert InvalidCommitment();
        }

        zkGuardEnabled[msg.sender] = false;
        emit ZKGuardDisabled(msg.sender);
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
            revert ZKGuardNotEnabled();
        }

        // Verify balance
        if (balanceOf(from) < amount) {
            revert InsufficientBalance();
        }

        // Verify STARK proof (quantum-resistant)
        if (!verifier.verifyProof(proof, publicInputs, programHash)) {
            revert InvalidProof();
        }

        // Extract and verify public inputs
        // Expected order: [from, to, amount, nonce, commitment]
        require(publicInputs.length >= 5, "Invalid public inputs length");

        address proofFrom = address(uint160(publicInputs[0]));
        address proofTo = address(uint160(publicInputs[1]));
        uint256 proofAmount = publicInputs[2];
        uint256 proofNonce = publicInputs[3];
        uint256 proofCommitment = publicInputs[4];

        // Verify inputs match
        require(proofFrom == from, "From mismatch");
        require(proofTo == to, "To mismatch");
        require(proofAmount == amount, "Amount mismatch");

        // Verify nonce
        if (proofNonce != zkNonce[from]) {
            revert InvalidNonce();
        }

        // Verify commitment (reduced to STARK field)
        uint256 expectedCommitment = uint256(hdCommitment[from]) % STARK_PRIME;
        if (proofCommitment != expectedCommitment) {
            revert InvalidCommitment();
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

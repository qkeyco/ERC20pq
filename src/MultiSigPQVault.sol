// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ERC21PQToken } from "./ERC21PQToken.sol";
import { IStarkVerifier } from "./interfaces/IStarkVerifier.sol";

/// @title MultiSigPQVault
/// @notice Quantum-resistant multi-signature vault for ERC-21 PQ tokens
/// @dev Requires M-of-N STARK proof signatures to execute transactions.
///      Each signer must provide a valid STARK proof of their HD secret,
///      making the vault resistant to both classical and quantum attacks.
/// @author EthVaultPQ Team
contract MultiSigPQVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                         CONSTANTS
    // =============================================================

    /// @notice Maximum number of signers allowed
    uint256 public constant MAX_SIGNERS = 10;

    /// @notice Maximum time a transaction can be pending before expiring
    uint256 public constant TX_EXPIRY = 7 days;

    // =============================================================
    //                         STRUCTS
    // =============================================================

    /// @notice A proposed vault transaction
    struct Transaction {
        address token; // Token to transfer
        address to; // Recipient
        uint256 amount; // Amount to transfer
        uint256 approvalCount; // Number of STARK-verified approvals
        uint256 createdAt; // Timestamp of proposal
        bool executed; // Whether the transaction has been executed
        bool cancelled; // Whether the transaction was cancelled
    }

    /// @notice A signer's STARK approval for a transaction
    struct Approval {
        address signer; // Signer address
        uint256 timestamp; // When the approval was given
    }

    // =============================================================
    //                         STORAGE
    // =============================================================

    /// @notice The STARK verifier contract
    IStarkVerifier public immutable verifier;

    /// @notice The program hash for verification
    bytes32 public immutable programHash;

    /// @notice Required number of approvals (M in M-of-N)
    uint256 public required;

    /// @notice Total number of signers
    uint256 public signerCount;

    /// @notice Whether an address is a signer
    mapping(address => bool) public isSigner;

    /// @notice Each signer's HD commitment
    mapping(address => bytes32) public signerCommitment;

    /// @notice STARK nonce per signer for replay protection
    mapping(address => uint256) public signerNonce;

    /// @notice All signers (ordered)
    address[] public signers;

    /// @notice Transaction counter
    uint256 public txCount;

    /// @notice All proposed transactions
    mapping(uint256 => Transaction) public transactions;

    /// @notice Whether a signer has approved a transaction
    mapping(uint256 => mapping(address => bool)) public hasApproved;

    /// @notice Approval records per transaction
    mapping(uint256 => Approval[]) public approvals;

    // =============================================================
    //                         EVENTS
    // =============================================================

    event VaultInitialized(address[] signers, uint256 required);
    event TransactionProposed(uint256 indexed txId, address indexed proposer, address token, address to, uint256 amount);
    event TransactionApproved(uint256 indexed txId, address indexed signer, uint256 approvalCount);
    event TransactionExecuted(uint256 indexed txId, address token, address to, uint256 amount);
    event TransactionCancelled(uint256 indexed txId, address indexed canceller);
    event SignerAdded(address indexed signer, bytes32 commitment);
    event SignerRemoved(address indexed signer);
    event RequiredChanged(uint256 oldRequired, uint256 newRequired);

    // =============================================================
    //                         ERRORS
    // =============================================================

    error NotSigner();
    error InvalidSignerCount();
    error InvalidRequired();
    error DuplicateSigner();
    error ZeroCommitment();
    error TransactionNotFound();
    error TransactionAlreadyExecuted();
    error TransactionExpired();
    error TransactionCancelled_();
    error AlreadyApproved();
    error InsufficientApprovals();
    error InvalidProof();
    error InvalidNonce();
    error InvalidCommitment();
    error SignerLimitReached();

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /// @notice Initialize the multi-sig vault
    /// @param _signers Array of signer addresses
    /// @param _commitments Array of HD commitments for each signer
    /// @param _required Number of required approvals
    /// @param _verifier STARK verifier contract address
    /// @param _programHash Hash of the verification program
    constructor(
        address[] memory _signers,
        bytes32[] memory _commitments,
        uint256 _required,
        address _verifier,
        bytes32 _programHash
    ) {
        if (_signers.length == 0 || _signers.length > MAX_SIGNERS) revert InvalidSignerCount();
        if (_signers.length != _commitments.length) revert InvalidSignerCount();
        if (_required == 0 || _required > _signers.length) revert InvalidRequired();

        verifier = IStarkVerifier(_verifier);
        programHash = _programHash;
        required = _required;

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            if (isSigner[signer]) revert DuplicateSigner();
            if (_commitments[i] == bytes32(0)) revert ZeroCommitment();

            isSigner[signer] = true;
            signerCommitment[signer] = _commitments[i];
            signers.push(signer);
        }

        signerCount = _signers.length;

        emit VaultInitialized(_signers, _required);
    }

    // =============================================================
    //                    MODIFIERS
    // =============================================================

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    // =============================================================
    //                    CORE FUNCTIONS
    // =============================================================

    /// @notice Propose a new transaction (requires STARK proof)
    /// @param token The token to transfer
    /// @param to The recipient address
    /// @param amount The amount to transfer
    /// @param proof STARK proof from the proposer
    /// @param publicInputs Public inputs for verification
    /// @return txId The ID of the proposed transaction
    function proposeTransaction(
        address token,
        address to,
        uint256 amount,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external onlySigner nonReentrant returns (uint256 txId) {
        // Verify STARK proof for the proposer
        _verifySignerProof(msg.sender, proof, publicInputs);

        txId = txCount++;
        transactions[txId] = Transaction({
            token: token,
            to: to,
            amount: amount,
            approvalCount: 1,
            createdAt: block.timestamp,
            executed: false,
            cancelled: false
        });

        hasApproved[txId][msg.sender] = true;
        approvals[txId].push(Approval({ signer: msg.sender, timestamp: block.timestamp }));

        emit TransactionProposed(txId, msg.sender, token, to, amount);
        emit TransactionApproved(txId, msg.sender, 1);

        // Auto-execute if threshold met (1-of-N)
        if (required == 1) {
            _executeTransaction(txId);
        }

        return txId;
    }

    /// @notice Approve a pending transaction with STARK proof
    /// @param txId The transaction ID to approve
    /// @param proof STARK proof from the approver
    /// @param publicInputs Public inputs for verification
    function approveTransaction(
        uint256 txId,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external onlySigner nonReentrant {
        Transaction storage txn = transactions[txId];
        if (txn.createdAt == 0) revert TransactionNotFound();
        if (txn.executed) revert TransactionAlreadyExecuted();
        if (txn.cancelled) revert TransactionCancelled_();
        if (block.timestamp > txn.createdAt + TX_EXPIRY) revert TransactionExpired();
        if (hasApproved[txId][msg.sender]) revert AlreadyApproved();

        // Verify STARK proof
        _verifySignerProof(msg.sender, proof, publicInputs);

        hasApproved[txId][msg.sender] = true;
        txn.approvalCount += 1;
        approvals[txId].push(Approval({ signer: msg.sender, timestamp: block.timestamp }));

        emit TransactionApproved(txId, msg.sender, txn.approvalCount);

        // Auto-execute if threshold met
        if (txn.approvalCount >= required) {
            _executeTransaction(txId);
        }
    }

    /// @notice Cancel a pending transaction (any signer can cancel)
    /// @param txId The transaction ID to cancel
    function cancelTransaction(uint256 txId) external onlySigner {
        Transaction storage txn = transactions[txId];
        if (txn.createdAt == 0) revert TransactionNotFound();
        if (txn.executed) revert TransactionAlreadyExecuted();

        txn.cancelled = true;
        emit TransactionCancelled(txId, msg.sender);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    /// @notice Verify a signer's STARK proof
    function _verifySignerProof(
        address signer,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) internal {
        if (!verifier.verifyProof(proof, publicInputs, programHash)) {
            revert InvalidProof();
        }

        if (publicInputs.length < 5) revert InvalidProof();

        // Verify the proof is from this signer
        if (address(uint160(publicInputs[0])) != signer) revert InvalidProof();

        // Verify nonce
        uint256 STARK_PRIME = 3618502788666131213697322783095070105623107215331596699973092056135872020481;
        if (publicInputs[3] != signerNonce[signer]) revert InvalidNonce();

        // Verify commitment
        uint256 expectedCommitment = uint256(signerCommitment[signer]) % STARK_PRIME;
        if (publicInputs[4] != expectedCommitment) revert InvalidCommitment();

        // Increment nonce
        signerNonce[signer] += 1;
    }

    /// @notice Execute a transaction that has enough approvals
    function _executeTransaction(uint256 txId) internal {
        Transaction storage txn = transactions[txId];
        if (txn.approvalCount < required) revert InsufficientApprovals();

        txn.executed = true;

        IERC20(txn.token).safeTransfer(txn.to, txn.amount);

        emit TransactionExecuted(txId, txn.token, txn.to, txn.amount);
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /// @notice Get the number of approvals for a transaction
    function getApprovalCount(uint256 txId) external view returns (uint256) {
        return transactions[txId].approvalCount;
    }

    /// @notice Check if a transaction can be executed
    function canExecute(uint256 txId) external view returns (bool) {
        Transaction storage txn = transactions[txId];
        return !txn.executed && !txn.cancelled && txn.approvalCount >= required
            && block.timestamp <= txn.createdAt + TX_EXPIRY;
    }

    /// @notice Get all signers
    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    /// @notice Get vault balance of a specific token
    function getVaultBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Receive ETH
    receive() external payable { }
}

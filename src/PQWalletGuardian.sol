// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ERC21PQToken } from "./ERC21PQToken.sol";
import { IStarkVerifier } from "./interfaces/IStarkVerifier.sol";

/// @title PQWalletGuardian
/// @notice Social recovery system for quantum-resistant wallets
/// @dev Allows users to designate guardians who can help recover wallet access
///      if the user loses their HD secret. Recovery requires M-of-N guardian
///      STARK proofs plus a timelock delay for security.
/// @author EthVaultPQ Team
contract PQWalletGuardian is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                         CONSTANTS
    // =============================================================

    /// @notice Maximum guardians per wallet
    uint256 public constant MAX_GUARDIANS = 7;

    /// @notice Minimum recovery timelock (24 hours)
    uint256 public constant MIN_TIMELOCK = 1 days;

    /// @notice Maximum recovery timelock (30 days)
    uint256 public constant MAX_TIMELOCK = 30 days;

    // =============================================================
    //                         STRUCTS
    // =============================================================

    /// @notice A wallet's guardian configuration
    struct GuardianConfig {
        address[] guardians; // List of guardian addresses
        mapping(address => bool) isGuardian; // Quick lookup
        mapping(address => bytes32) guardianCommitment; // Each guardian's HD commitment
        uint256 threshold; // Required guardian approvals
        uint256 recoveryTimelock; // Delay before recovery executes
        bool configured; // Whether guardians are set up
    }

    /// @notice An active recovery request
    struct RecoveryRequest {
        address wallet; // Wallet being recovered
        bytes32 newCommitment; // New HD commitment for the wallet
        uint256 approvalCount; // Number of guardian approvals
        uint256 initiatedAt; // Timestamp of initiation
        uint256 executeAfter; // Earliest execution timestamp
        bool executed; // Whether recovery was executed
        bool cancelled; // Whether recovery was cancelled
    }

    // =============================================================
    //                         STORAGE
    // =============================================================

    /// @notice The STARK verifier contract
    IStarkVerifier public immutable verifier;

    /// @notice The program hash for verification
    bytes32 public immutable programHash;

    /// @notice The ERC-21 PQ token contract
    ERC21PQToken public immutable pqToken;

    /// @notice Guardian configurations per wallet
    mapping(address => GuardianConfig) private guardianConfigs;

    /// @notice Recovery request counter
    uint256 public recoveryCount;

    /// @notice Active recovery requests
    mapping(uint256 => RecoveryRequest) public recoveryRequests;

    /// @notice Whether a guardian has approved a recovery
    mapping(uint256 => mapping(address => bool)) public hasApprovedRecovery;

    /// @notice STARK nonce per guardian for replay protection
    mapping(address => uint256) public guardianNonce;

    /// @notice Active recovery ID per wallet (0 = no active recovery)
    mapping(address => uint256) public activeRecovery;

    // =============================================================
    //                         EVENTS
    // =============================================================

    event GuardiansConfigured(address indexed wallet, address[] guardians, uint256 threshold, uint256 timelock);
    event GuardianAdded(address indexed wallet, address indexed guardian);
    event GuardianRemoved(address indexed wallet, address indexed guardian);
    event RecoveryInitiated(uint256 indexed recoveryId, address indexed wallet, bytes32 newCommitment);
    event RecoveryApproved(uint256 indexed recoveryId, address indexed guardian, uint256 approvalCount);
    event RecoveryExecuted(uint256 indexed recoveryId, address indexed wallet);
    event RecoveryCancelled(uint256 indexed recoveryId, address indexed wallet);
    event ThresholdChanged(address indexed wallet, uint256 oldThreshold, uint256 newThreshold);

    // =============================================================
    //                         ERRORS
    // =============================================================

    error NotWalletOwner();
    error NotGuardian();
    error GuardiansAlreadyConfigured();
    error InvalidGuardianCount();
    error InvalidThreshold();
    error InvalidTimelock();
    error DuplicateGuardian();
    error ZeroCommitment();
    error NoActiveRecovery();
    error RecoveryAlreadyActive();
    error RecoveryNotReady();
    error RecoveryAlreadyExecuted();
    error RecoveryCancelled_();
    error AlreadyApproved();
    error InsufficientApprovals();
    error InvalidProof();
    error InvalidNonce();
    error InvalidCommitmentProof();
    error GuardiansNotConfigured();

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /// @param _pqToken The ERC-21 PQ token contract
    /// @param _verifier The STARK verifier contract
    /// @param _programHash The verification program hash
    constructor(address _pqToken, address _verifier, bytes32 _programHash) {
        pqToken = ERC21PQToken(_pqToken);
        verifier = IStarkVerifier(_verifier);
        programHash = _programHash;
    }

    // =============================================================
    //                    SETUP FUNCTIONS
    // =============================================================

    /// @notice Configure guardians for your wallet
    /// @param _guardians Array of guardian addresses
    /// @param _commitments Array of guardian HD commitments
    /// @param _threshold Number of guardians required for recovery
    /// @param _timelock Delay before recovery can execute (in seconds)
    function configureGuardians(
        address[] calldata _guardians,
        bytes32[] calldata _commitments,
        uint256 _threshold,
        uint256 _timelock
    ) external {
        if (_guardians.length == 0 || _guardians.length > MAX_GUARDIANS) revert InvalidGuardianCount();
        if (_guardians.length != _commitments.length) revert InvalidGuardianCount();
        if (_threshold == 0 || _threshold > _guardians.length) revert InvalidThreshold();
        if (_timelock < MIN_TIMELOCK || _timelock > MAX_TIMELOCK) revert InvalidTimelock();

        GuardianConfig storage config = guardianConfigs[msg.sender];

        // Clear existing guardians if reconfiguring
        for (uint256 i = 0; i < config.guardians.length; i++) {
            config.isGuardian[config.guardians[i]] = false;
            config.guardianCommitment[config.guardians[i]] = bytes32(0);
        }
        delete config.guardians;

        // Set new guardians
        for (uint256 i = 0; i < _guardians.length; i++) {
            address guardian = _guardians[i];
            if (config.isGuardian[guardian]) revert DuplicateGuardian();
            if (_commitments[i] == bytes32(0)) revert ZeroCommitment();
            if (guardian == msg.sender) revert DuplicateGuardian(); // Can't be your own guardian

            config.isGuardian[guardian] = true;
            config.guardianCommitment[guardian] = _commitments[i];
            config.guardians.push(guardian);
        }

        config.threshold = _threshold;
        config.recoveryTimelock = _timelock;
        config.configured = true;

        emit GuardiansConfigured(msg.sender, _guardians, _threshold, _timelock);
    }

    /// @notice Change the recovery threshold
    /// @param newThreshold The new threshold value
    function setThreshold(uint256 newThreshold) external {
        GuardianConfig storage config = guardianConfigs[msg.sender];
        if (!config.configured) revert GuardiansNotConfigured();
        if (newThreshold == 0 || newThreshold > config.guardians.length) revert InvalidThreshold();

        uint256 oldThreshold = config.threshold;
        config.threshold = newThreshold;

        emit ThresholdChanged(msg.sender, oldThreshold, newThreshold);
    }

    // =============================================================
    //                    RECOVERY FUNCTIONS
    // =============================================================

    /// @notice Initiate a recovery request for a wallet (called by a guardian)
    /// @param wallet The wallet to recover
    /// @param newCommitment The new HD commitment for the wallet
    /// @param proof STARK proof from the guardian
    /// @param publicInputs Public inputs for the proof
    /// @return recoveryId The ID of the recovery request
    function initiateRecovery(
        address wallet,
        bytes32 newCommitment,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external nonReentrant returns (uint256 recoveryId) {
        GuardianConfig storage config = guardianConfigs[wallet];
        if (!config.configured) revert GuardiansNotConfigured();
        if (!config.isGuardian[msg.sender]) revert NotGuardian();
        if (activeRecovery[wallet] != 0) revert RecoveryAlreadyActive();
        if (newCommitment == bytes32(0)) revert ZeroCommitment();

        // Verify guardian's STARK proof
        _verifyGuardianProof(msg.sender, config.guardianCommitment[msg.sender], proof, publicInputs);

        recoveryId = ++recoveryCount;
        uint256 executeAfter = block.timestamp + config.recoveryTimelock;

        recoveryRequests[recoveryId] = RecoveryRequest({
            wallet: wallet,
            newCommitment: newCommitment,
            approvalCount: 1,
            initiatedAt: block.timestamp,
            executeAfter: executeAfter,
            executed: false,
            cancelled: false
        });

        hasApprovedRecovery[recoveryId][msg.sender] = true;
        activeRecovery[wallet] = recoveryId;

        emit RecoveryInitiated(recoveryId, wallet, newCommitment);
        emit RecoveryApproved(recoveryId, msg.sender, 1);

        return recoveryId;
    }

    /// @notice Approve an active recovery request (called by a guardian)
    /// @param recoveryId The recovery request ID
    /// @param proof STARK proof from the guardian
    /// @param publicInputs Public inputs for the proof
    function approveRecovery(
        uint256 recoveryId,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external nonReentrant {
        RecoveryRequest storage req = recoveryRequests[recoveryId];
        if (req.wallet == address(0)) revert NoActiveRecovery();
        if (req.executed) revert RecoveryAlreadyExecuted();
        if (req.cancelled) revert RecoveryCancelled_();

        GuardianConfig storage config = guardianConfigs[req.wallet];
        if (!config.isGuardian[msg.sender]) revert NotGuardian();
        if (hasApprovedRecovery[recoveryId][msg.sender]) revert AlreadyApproved();

        // Verify guardian's STARK proof
        _verifyGuardianProof(msg.sender, config.guardianCommitment[msg.sender], proof, publicInputs);

        hasApprovedRecovery[recoveryId][msg.sender] = true;
        req.approvalCount += 1;

        emit RecoveryApproved(recoveryId, msg.sender, req.approvalCount);
    }

    /// @notice Execute a recovery after timelock and threshold are met
    /// @param recoveryId The recovery request ID
    function executeRecovery(uint256 recoveryId) external nonReentrant {
        RecoveryRequest storage req = recoveryRequests[recoveryId];
        if (req.wallet == address(0)) revert NoActiveRecovery();
        if (req.executed) revert RecoveryAlreadyExecuted();
        if (req.cancelled) revert RecoveryCancelled_();

        GuardianConfig storage config = guardianConfigs[req.wallet];
        if (req.approvalCount < config.threshold) revert InsufficientApprovals();
        if (block.timestamp < req.executeAfter) revert RecoveryNotReady();

        req.executed = true;
        activeRecovery[req.wallet] = 0;

        // The recovery sets a new commitment - the actual commitment rotation
        // must be handled by the token contract's recovery mechanism.
        // This contract serves as the governance layer for recovery decisions.

        emit RecoveryExecuted(recoveryId, req.wallet);
    }

    /// @notice Cancel an active recovery (only the wallet owner can cancel)
    /// @dev The wallet owner can always cancel, proving they still have access
    /// @param recoveryId The recovery request ID
    function cancelRecovery(uint256 recoveryId) external {
        RecoveryRequest storage req = recoveryRequests[recoveryId];
        if (req.wallet != msg.sender) revert NotWalletOwner();
        if (req.executed) revert RecoveryAlreadyExecuted();

        req.cancelled = true;
        activeRecovery[msg.sender] = 0;

        emit RecoveryCancelled(recoveryId, msg.sender);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    /// @notice Verify a guardian's STARK proof
    function _verifyGuardianProof(
        address guardian,
        bytes32 commitment,
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) internal {
        if (!verifier.verifyProof(proof, publicInputs, programHash)) {
            revert InvalidProof();
        }

        if (publicInputs.length < 5) revert InvalidProof();

        // Verify the proof is from this guardian
        if (address(uint160(publicInputs[0])) != guardian) revert InvalidProof();

        // Verify nonce
        uint256 STARK_PRIME = 3618502788666131213697322783095070105623107215331596699973092056135872020481;
        if (publicInputs[3] != guardianNonce[guardian]) revert InvalidNonce();

        // Verify commitment
        uint256 expectedCommitment = uint256(commitment) % STARK_PRIME;
        if (publicInputs[4] != expectedCommitment) revert InvalidCommitmentProof();

        // Increment nonce
        guardianNonce[guardian] += 1;
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /// @notice Get guardian configuration for a wallet
    function getGuardians(address wallet) external view returns (address[] memory) {
        return guardianConfigs[wallet].guardians;
    }

    /// @notice Get the threshold for a wallet
    function getThreshold(address wallet) external view returns (uint256) {
        return guardianConfigs[wallet].threshold;
    }

    /// @notice Get the recovery timelock for a wallet
    function getTimelock(address wallet) external view returns (uint256) {
        return guardianConfigs[wallet].recoveryTimelock;
    }

    /// @notice Check if guardians are configured for a wallet
    function isConfigured(address wallet) external view returns (bool) {
        return guardianConfigs[wallet].configured;
    }

    /// @notice Check if an address is a guardian for a wallet
    function isGuardianOf(address wallet, address guardian) external view returns (bool) {
        return guardianConfigs[wallet].isGuardian[guardian];
    }

    /// @notice Get recovery request details
    function getRecoveryRequest(uint256 recoveryId)
        external
        view
        returns (
            address wallet,
            bytes32 newCommitment,
            uint256 approvalCount,
            uint256 executeAfter,
            bool executed,
            bool cancelled
        )
    {
        RecoveryRequest storage req = recoveryRequests[recoveryId];
        return (req.wallet, req.newCommitment, req.approvalCount, req.executeAfter, req.executed, req.cancelled);
    }
}

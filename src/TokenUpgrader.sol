// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ERC21PQToken } from "./ERC21PQToken.sol";
import { IStarkVerifier } from "./interfaces/IStarkVerifier.sol";

/// @title TokenUpgrader
/// @notice Upgrades standard ERC-20 tokens to quantum-resistant ERC-21 PQ wrapped versions
/// @dev Accepts deposits of any whitelisted ERC-20, mints 1:1 PQ-wrapped tokens,
///      and allows redemption back to the original token.
/// @author EthVaultPQ Team
contract TokenUpgrader is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // =============================================================
    //                         STRUCTS
    // =============================================================

    /// @notice Configuration for a supported token pair
    struct TokenPair {
        address underlying; // The original ERC-20 token (e.g., WETH, USDC)
        address pqToken; // The PQ-wrapped version
        bool active; // Whether upgrades/downgrades are enabled
        uint256 totalDeposited; // Total underlying tokens held
        uint256 upgradeCount; // Number of upgrade operations
        uint256 downgradeCount; // Number of downgrade operations
    }

    // =============================================================
    //                         STORAGE
    // =============================================================

    /// @notice Mapping from underlying token address to its PQ wrapper
    mapping(address => TokenPair) public tokenPairs;

    /// @notice List of all registered underlying token addresses
    address[] public supportedTokens;

    /// @notice Mapping from PQ token address back to underlying
    mapping(address => address) public pqToUnderlying;

    /// @notice Per-user upgrade limits (0 = no limit)
    mapping(address => uint256) public userUpgradeLimit;

    /// @notice Per-user total upgraded amount per token
    mapping(address => mapping(address => uint256)) public userUpgraded;

    /// @notice Global per-token upgrade cap (0 = no cap)
    mapping(address => uint256) public tokenUpgradeCap;

    /// @notice Minimum upgrade amount per token
    mapping(address => uint256) public minUpgradeAmount;

    /// @notice Cooldown period between upgrades per user (seconds)
    uint256 public upgradeCooldown;

    /// @notice Last upgrade timestamp per user
    mapping(address => uint256) public lastUpgradeTime;

    // =============================================================
    //                         EVENTS
    // =============================================================

    /// @notice Emitted when tokens are upgraded to PQ version
    event TokenUpgraded(
        address indexed user,
        address indexed underlying,
        address indexed pqToken,
        uint256 amount
    );

    /// @notice Emitted when PQ tokens are downgraded back to original
    event TokenDowngraded(
        address indexed user,
        address indexed pqToken,
        address indexed underlying,
        uint256 amount
    );

    /// @notice Emitted when a new token pair is registered
    event TokenPairRegistered(address indexed underlying, address indexed pqToken);

    /// @notice Emitted when a token pair is activated/deactivated
    event TokenPairStatusChanged(address indexed underlying, bool active);

    /// @notice Emitted when upgrade cap is set for a token
    event UpgradeCapSet(address indexed underlying, uint256 cap);

    // =============================================================
    //                         ERRORS
    // =============================================================

    /// @notice Token pair not registered
    error TokenNotSupported();

    /// @notice Token pair is not active
    error TokenPairInactive();

    /// @notice Zero amount not allowed
    error ZeroAmount();

    /// @notice Upgrade would exceed token cap
    error UpgradeCapExceeded();

    /// @notice User upgrade limit exceeded
    error UserLimitExceeded();

    /// @notice Cooldown period not elapsed
    error CooldownNotElapsed();

    /// @notice Amount below minimum
    error BelowMinimum();

    /// @notice Token pair already registered
    error AlreadyRegistered();

    /// @notice PQ token address already mapped
    error PQTokenAlreadyMapped();

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /// @param _owner The owner who can register token pairs and set parameters
    constructor(address _owner) Ownable(_owner) { }

    // =============================================================
    //                    ADMIN FUNCTIONS
    // =============================================================

    /// @notice Register a new token pair for upgrading
    /// @param underlying The original ERC-20 token address
    /// @param pqToken The PQ-wrapped ERC-21 token address
    function registerTokenPair(address underlying, address pqToken) external onlyOwner {
        if (tokenPairs[underlying].pqToken != address(0)) revert AlreadyRegistered();
        if (pqToUnderlying[pqToken] != address(0)) revert PQTokenAlreadyMapped();

        tokenPairs[underlying] = TokenPair({
            underlying: underlying,
            pqToken: pqToken,
            active: true,
            totalDeposited: 0,
            upgradeCount: 0,
            downgradeCount: 0
        });

        pqToUnderlying[pqToken] = underlying;
        supportedTokens.push(underlying);

        emit TokenPairRegistered(underlying, pqToken);
    }

    /// @notice Activate or deactivate a token pair
    /// @param underlying The underlying token address
    /// @param active Whether the pair should be active
    function setTokenPairActive(address underlying, bool active) external onlyOwner {
        if (tokenPairs[underlying].pqToken == address(0)) revert TokenNotSupported();
        tokenPairs[underlying].active = active;
        emit TokenPairStatusChanged(underlying, active);
    }

    /// @notice Set the global upgrade cap for a token
    /// @param underlying The underlying token address
    /// @param cap The maximum total amount that can be upgraded (0 = no cap)
    function setUpgradeCap(address underlying, uint256 cap) external onlyOwner {
        if (tokenPairs[underlying].pqToken == address(0)) revert TokenNotSupported();
        tokenUpgradeCap[underlying] = cap;
        emit UpgradeCapSet(underlying, cap);
    }

    /// @notice Set minimum upgrade amount for a token
    /// @param underlying The underlying token address
    /// @param minimum The minimum amount per upgrade transaction
    function setMinUpgradeAmount(address underlying, uint256 minimum) external onlyOwner {
        minUpgradeAmount[underlying] = minimum;
    }

    /// @notice Set cooldown period between upgrades
    /// @param cooldown The cooldown period in seconds
    function setUpgradeCooldown(uint256 cooldown) external onlyOwner {
        upgradeCooldown = cooldown;
    }

    /// @notice Set per-user upgrade limit
    /// @param user The user address
    /// @param limit The maximum total amount the user can upgrade (0 = no limit)
    function setUserUpgradeLimit(address user, uint256 limit) external onlyOwner {
        userUpgradeLimit[user] = limit;
    }

    /// @notice Pause all upgrade/downgrade operations
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause operations
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency withdraw stuck tokens (only owner)
    /// @param token The token to withdraw
    /// @param to The recipient
    /// @param amount The amount to withdraw
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // =============================================================
    //                    CORE FUNCTIONS
    // =============================================================

    /// @notice Upgrade ERC-20 tokens to their PQ-protected version
    /// @dev User must approve this contract to spend their underlying tokens first.
    ///      The underlying tokens are held by this contract. The PQ token must have
    ///      minted supply available at this contract address (or use a mintable PQ token).
    /// @param underlying The address of the ERC-20 token to upgrade
    /// @param amount The amount of tokens to upgrade
    function upgrade(address underlying, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        TokenPair storage pair = tokenPairs[underlying];
        if (pair.pqToken == address(0)) revert TokenNotSupported();
        if (!pair.active) revert TokenPairInactive();

        // Check minimum amount
        if (amount < minUpgradeAmount[underlying]) revert BelowMinimum();

        // Check cooldown
        if (upgradeCooldown > 0 && block.timestamp < lastUpgradeTime[msg.sender] + upgradeCooldown) {
            revert CooldownNotElapsed();
        }

        // Check token cap
        uint256 cap = tokenUpgradeCap[underlying];
        if (cap > 0 && pair.totalDeposited + amount > cap) revert UpgradeCapExceeded();

        // Check user limit
        uint256 limit = userUpgradeLimit[msg.sender];
        if (limit > 0 && userUpgraded[msg.sender][underlying] + amount > limit) {
            revert UserLimitExceeded();
        }

        // Pull underlying tokens from user
        IERC20(underlying).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer PQ tokens to user
        IERC20(pair.pqToken).safeTransfer(msg.sender, amount);

        // Update accounting
        pair.totalDeposited += amount;
        pair.upgradeCount += 1;
        userUpgraded[msg.sender][underlying] += amount;
        lastUpgradeTime[msg.sender] = block.timestamp;

        emit TokenUpgraded(msg.sender, underlying, pair.pqToken, amount);
    }

    /// @notice Upgrade tokens and automatically setup PQ protection in one transaction
    /// @param underlying The address of the ERC-20 token to upgrade
    /// @param amount The amount of tokens to upgrade
    /// @param commitment The HD commitment for ZK guard setup
    function upgradeAndProtect(
        address underlying,
        uint256 amount,
        bytes32 commitment
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        TokenPair storage pair = tokenPairs[underlying];
        if (pair.pqToken == address(0)) revert TokenNotSupported();
        if (!pair.active) revert TokenPairInactive();

        // Check minimum amount
        if (amount < minUpgradeAmount[underlying]) revert BelowMinimum();

        // Check cooldown
        if (upgradeCooldown > 0 && block.timestamp < lastUpgradeTime[msg.sender] + upgradeCooldown) {
            revert CooldownNotElapsed();
        }

        // Check caps
        uint256 cap = tokenUpgradeCap[underlying];
        if (cap > 0 && pair.totalDeposited + amount > cap) revert UpgradeCapExceeded();
        uint256 limit = userUpgradeLimit[msg.sender];
        if (limit > 0 && userUpgraded[msg.sender][underlying] + amount > limit) {
            revert UserLimitExceeded();
        }

        // Pull underlying tokens from user
        IERC20(underlying).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer PQ tokens to user
        IERC20(pair.pqToken).safeTransfer(msg.sender, amount);

        // Setup quantum protection on the PQ token
        ERC21PQToken(pair.pqToken).setupProtection(commitment);

        // Update accounting
        pair.totalDeposited += amount;
        pair.upgradeCount += 1;
        userUpgraded[msg.sender][underlying] += amount;
        lastUpgradeTime[msg.sender] = block.timestamp;

        emit TokenUpgraded(msg.sender, underlying, pair.pqToken, amount);
    }

    /// @notice Downgrade PQ tokens back to the original ERC-20 version
    /// @dev The user's PQ tokens are returned to this contract, and original tokens
    ///      are sent back to the user. If the user has ZK guard enabled, they must
    ///      use transferZK to send PQ tokens to this contract first.
    /// @param pqToken The address of the PQ token to downgrade
    /// @param amount The amount of PQ tokens to downgrade
    function downgrade(address pqToken, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        address underlying = pqToUnderlying[pqToken];
        if (underlying == address(0)) revert TokenNotSupported();

        TokenPair storage pair = tokenPairs[underlying];
        if (!pair.active) revert TokenPairInactive();

        // Pull PQ tokens from user
        IERC20(pqToken).safeTransferFrom(msg.sender, address(this), amount);

        // Return underlying tokens to user
        IERC20(underlying).safeTransfer(msg.sender, amount);

        // Update accounting
        pair.totalDeposited -= amount;
        pair.downgradeCount += 1;

        emit TokenDowngraded(msg.sender, pqToken, underlying, amount);
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /// @notice Get the PQ token address for an underlying token
    function getPQToken(address underlying) external view returns (address) {
        return tokenPairs[underlying].pqToken;
    }

    /// @notice Get the underlying token for a PQ token
    function getUnderlying(address pqToken) external view returns (address) {
        return pqToUnderlying[pqToken];
    }

    /// @notice Get the number of supported token pairs
    function supportedTokenCount() external view returns (uint256) {
        return supportedTokens.length;
    }

    /// @notice Check if a token is supported for upgrading
    function isSupported(address underlying) external view returns (bool) {
        return tokenPairs[underlying].pqToken != address(0);
    }

    /// @notice Get full token pair info
    function getTokenPairInfo(address underlying)
        external
        view
        returns (
            address pqToken,
            bool active,
            uint256 totalDeposited,
            uint256 upgradeCount,
            uint256 downgradeCount
        )
    {
        TokenPair storage pair = tokenPairs[underlying];
        return (pair.pqToken, pair.active, pair.totalDeposited, pair.upgradeCount, pair.downgradeCount);
    }

    /// @notice Get the available upgrade capacity for a token
    function availableCapacity(address underlying) external view returns (uint256) {
        uint256 cap = tokenUpgradeCap[underlying];
        if (cap == 0) return type(uint256).max;
        uint256 deposited = tokenPairs[underlying].totalDeposited;
        if (deposited >= cap) return 0;
        return cap - deposited;
    }
}

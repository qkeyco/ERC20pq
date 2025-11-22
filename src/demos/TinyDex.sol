// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title TinyDex
/// @notice Minimal DEX for swapping ERC21PQToken with a stablecoin
/// @dev Demonstrates ERC-20 compatibility with DEX-like operations
contract TinyDex {
    using SafeERC20 for IERC20;

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice The ERC21PQToken (LZPQ)
    IERC20 public immutable tokenLZPQ;

    /// @notice The stablecoin (USD mock)
    IERC20 public immutable tokenUSD;

    /// @notice Owner of the DEX
    address public owner;

    /// @notice Exchange rate: 1 LZPQ = exchangeRate USD (in 18 decimals)
    uint256 public exchangeRate;

    /// @notice Total volume swapped
    uint256 public totalVolume;

    // =============================================================
    //                           EVENTS
    // =============================================================

    /// @notice Emitted when LZPQ is swapped for USD
    event SwapLZPQForUSD(address indexed user, uint256 lzpqAmount, uint256 usdAmount);

    /// @notice Emitted when USD is swapped for LZPQ
    event SwapUSDForLZPQ(address indexed user, uint256 usdAmount, uint256 lzpqAmount);

    /// @notice Emitted when exchange rate is updated
    event ExchangeRateUpdated(uint256 oldRate, uint256 newRate);

    /// @notice Emitted when liquidity is added
    event LiquidityAdded(address indexed provider, uint256 lzpqAmount, uint256 usdAmount);

    // =============================================================
    //                           ERRORS
    // =============================================================

    error OnlyOwner();
    error InsufficientLiquidity();
    error ZeroAmount();

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /// @notice Constructor
    /// @param _tokenLZPQ The ERC21PQToken address
    /// @param _tokenUSD The USD stablecoin address
    /// @param _exchangeRate Initial exchange rate (18 decimals)
    constructor(address _tokenLZPQ, address _tokenUSD, uint256 _exchangeRate) {
        tokenLZPQ = IERC20(_tokenLZPQ);
        tokenUSD = IERC20(_tokenUSD);
        exchangeRate = _exchangeRate;
        owner = msg.sender;
    }

    // =============================================================
    //                      SWAP FUNCTIONS
    // =============================================================

    /// @notice Swap LZPQ tokens for USD
    /// @param lzpqAmount Amount of LZPQ to swap
    /// @return usdAmount Amount of USD received
    function swapLZPQForUSD(uint256 lzpqAmount) external returns (uint256 usdAmount) {
        if (lzpqAmount == 0) {
            revert ZeroAmount();
        }

        // Calculate USD amount
        usdAmount = (lzpqAmount * exchangeRate) / 1e18;

        // Check liquidity
        if (tokenUSD.balanceOf(address(this)) < usdAmount) {
            revert InsufficientLiquidity();
        }

        // Transfer LZPQ from user to DEX
        // Note: For ZK-guarded addresses, they must use transferZK to send here first
        tokenLZPQ.safeTransferFrom(msg.sender, address(this), lzpqAmount);

        // Transfer USD to user
        tokenUSD.safeTransfer(msg.sender, usdAmount);

        totalVolume += lzpqAmount;

        emit SwapLZPQForUSD(msg.sender, lzpqAmount, usdAmount);
    }

    /// @notice Swap USD for LZPQ tokens
    /// @param usdAmount Amount of USD to swap
    /// @return lzpqAmount Amount of LZPQ received
    function swapUSDForLZPQ(uint256 usdAmount) external returns (uint256 lzpqAmount) {
        if (usdAmount == 0) {
            revert ZeroAmount();
        }

        // Calculate LZPQ amount
        lzpqAmount = (usdAmount * 1e18) / exchangeRate;

        // Check liquidity
        if (tokenLZPQ.balanceOf(address(this)) < lzpqAmount) {
            revert InsufficientLiquidity();
        }

        // Transfer USD from user to DEX
        tokenUSD.safeTransferFrom(msg.sender, address(this), usdAmount);

        // Transfer LZPQ to user
        tokenLZPQ.safeTransfer(msg.sender, lzpqAmount);

        totalVolume += lzpqAmount;

        emit SwapUSDForLZPQ(msg.sender, usdAmount, lzpqAmount);
    }

    // =============================================================
    //                     ADMIN FUNCTIONS
    // =============================================================

    /// @notice Add liquidity to the DEX
    /// @param lzpqAmount Amount of LZPQ to add
    /// @param usdAmount Amount of USD to add
    function addLiquidity(uint256 lzpqAmount, uint256 usdAmount) external {
        if (lzpqAmount > 0) {
            tokenLZPQ.safeTransferFrom(msg.sender, address(this), lzpqAmount);
        }
        if (usdAmount > 0) {
            tokenUSD.safeTransferFrom(msg.sender, address(this), usdAmount);
        }

        emit LiquidityAdded(msg.sender, lzpqAmount, usdAmount);
    }

    /// @notice Update the exchange rate
    /// @param newRate The new exchange rate
    function setExchangeRate(uint256 newRate) external {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }

        uint256 oldRate = exchangeRate;
        exchangeRate = newRate;

        emit ExchangeRateUpdated(oldRate, newRate);
    }

    /// @notice Withdraw liquidity
    /// @param to Recipient address
    /// @param lzpqAmount LZPQ amount to withdraw
    /// @param usdAmount USD amount to withdraw
    function withdrawLiquidity(address to, uint256 lzpqAmount, uint256 usdAmount) external {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }

        if (lzpqAmount > 0) {
            tokenLZPQ.safeTransfer(to, lzpqAmount);
        }
        if (usdAmount > 0) {
            tokenUSD.safeTransfer(to, usdAmount);
        }
    }

    // =============================================================
    //                      VIEW FUNCTIONS
    // =============================================================

    /// @notice Get the DEX reserves
    /// @return lzpqReserve LZPQ balance
    /// @return usdReserve USD balance
    function getReserves() external view returns (uint256 lzpqReserve, uint256 usdReserve) {
        lzpqReserve = tokenLZPQ.balanceOf(address(this));
        usdReserve = tokenUSD.balanceOf(address(this));
    }

    /// @notice Get quote for LZPQ to USD swap
    /// @param lzpqAmount Amount of LZPQ
    /// @return usdAmount Amount of USD
    function quoteLZPQToUSD(uint256 lzpqAmount) external view returns (uint256 usdAmount) {
        usdAmount = (lzpqAmount * exchangeRate) / 1e18;
    }

    /// @notice Get quote for USD to LZPQ swap
    /// @param usdAmount Amount of USD
    /// @return lzpqAmount Amount of LZPQ
    function quoteUSDToLZPQ(uint256 usdAmount) external view returns (uint256 lzpqAmount) {
        lzpqAmount = (usdAmount * 1e18) / exchangeRate;
    }
}

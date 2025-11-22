// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PizzaMerchant
/// @notice Demo contract for a pizza shop that accepts ERC21PQToken
/// @dev Shows that the token is fully ERC-20 compatible with normal endpoints
contract PizzaMerchant {
    using SafeERC20 for IERC20;

    // =============================================================
    //                           STORAGE
    // =============================================================

    /// @notice The ERC21PQToken address
    IERC20 public immutable token;

    /// @notice Price of a pizza in tokens
    uint256 public pizzaPrice;

    /// @notice Owner of the merchant contract
    address public owner;

    /// @notice Total pizzas sold
    uint256 public totalPizzasSold;

    // =============================================================
    //                           EVENTS
    // =============================================================

    /// @notice Emitted when a pizza is paid for
    event PizzaPaid(address indexed customer, uint256 amount, uint256 pizzaId);

    /// @notice Emitted when the pizza price is updated
    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    /// @notice Emitted when tokens are withdrawn
    event Withdrawal(address indexed to, uint256 amount);

    // =============================================================
    //                           ERRORS
    // =============================================================

    error InsufficientPayment();
    error OnlyOwner();
    error TransferFailed();

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    /// @notice Constructor
    /// @param _token The ERC21PQToken address
    /// @param _pizzaPrice Initial pizza price
    constructor(address _token, uint256 _pizzaPrice) {
        token = IERC20(_token);
        pizzaPrice = _pizzaPrice;
        owner = msg.sender;
    }

    // =============================================================
    //                      PUBLIC FUNCTIONS
    // =============================================================

    /// @notice Pay for a pizza using tokens
    /// @dev Customer must have approved this contract to spend tokens
    function payForPizza() external {
        payForPizzaWithAmount(pizzaPrice);
    }

    /// @notice Pay a custom amount for a pizza
    /// @param amount The amount to pay
    function payForPizzaWithAmount(uint256 amount) public {
        if (amount < pizzaPrice) {
            revert InsufficientPayment();
        }

        // Use transferFrom - this is standard ERC-20
        // For ZK-guarded addresses, they must use transferZK to send to this contract first
        token.safeTransferFrom(msg.sender, address(this), amount);

        totalPizzasSold += 1;

        emit PizzaPaid(msg.sender, amount, totalPizzasSold);
    }

    /// @notice Update the pizza price
    /// @param newPrice The new pizza price
    function setPizzaPrice(uint256 newPrice) external {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }

        uint256 oldPrice = pizzaPrice;
        pizzaPrice = newPrice;

        emit PriceUpdated(oldPrice, newPrice);
    }

    /// @notice Withdraw collected tokens
    /// @param to The address to withdraw to
    /// @param amount The amount to withdraw
    function withdraw(address to, uint256 amount) external {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }

        token.safeTransfer(to, amount);

        emit Withdrawal(to, amount);
    }

    /// @notice Get the merchant's token balance
    /// @return The token balance
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}

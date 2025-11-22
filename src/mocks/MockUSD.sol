// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSD
/// @notice Mock USD stablecoin for testing
contract MockUSD is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {
        // Mint some initial supply to deployer
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }

    /// @notice Mint tokens (for testing)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

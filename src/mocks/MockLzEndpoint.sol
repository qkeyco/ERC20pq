// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockLzEndpoint
/// @notice Minimal mock of LayerZero endpoint for testing
contract MockLzEndpoint {
    mapping(address => address) public delegates;

    function setDelegate(address _delegate) external {
        delegates[msg.sender] = _delegate;
    }

    function eid() external pure returns (uint32) {
        return 1; // Mock chain ID
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { MessagingParams, MessagingFee, MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";

/// @title MockLzEndpoint
/// @notice Mock of LayerZero endpoint for testing cross-chain functionality
contract MockLzEndpoint {
    mapping(address => address) public delegates;
    uint64 public nonce;

    // Track sent messages for verification
    struct SentMessage {
        uint32 dstEid;
        bytes32 receiver;
        bytes message;
        bytes options;
        bool payInLzToken;
    }
    SentMessage[] public sentMessages;

    event MessageSent(
        bytes32 guid,
        uint64 nonce,
        uint32 dstEid,
        address sender
    );

    function setDelegate(address _delegate) external {
        delegates[msg.sender] = _delegate;
    }

    function eid() external pure returns (uint32) {
        return 1; // Mock source chain ID
    }

    /// @notice Mock send function for LayerZero
    function send(
        MessagingParams calldata _params,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory receipt) {
        nonce++;

        // Generate a mock GUID
        bytes32 guid = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            nonce,
            _params.dstEid
        ));

        // Store the message for test verification
        sentMessages.push(SentMessage({
            dstEid: _params.dstEid,
            receiver: _params.receiver,
            message: _params.message,
            options: _params.options,
            payInLzToken: _params.payInLzToken
        }));

        emit MessageSent(guid, nonce, _params.dstEid, msg.sender);

        // Return mock receipt
        receipt = MessagingReceipt({
            guid: guid,
            nonce: nonce,
            fee: MessagingFee({
                nativeFee: msg.value,
                lzTokenFee: 0
            })
        });

        // Refund any excess ETH (in real implementation)
        if (_refundAddress != address(0) && address(this).balance > 0) {
            // In a real mock, we might refund here
        }

        return receipt;
    }

    /// @notice Mock quote function
    function quote(
        MessagingParams calldata /*_params*/,
        address /*_sender*/
    ) external pure returns (MessagingFee memory fee) {
        // Return a fixed fee for testing
        fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });
    }

    /// @notice Get the number of sent messages (for testing)
    function getSentMessagesCount() external view returns (uint256) {
        return sentMessages.length;
    }

    /// @notice Get a sent message by index (for testing)
    function getSentMessage(uint256 index) external view returns (SentMessage memory) {
        return sentMessages[index];
    }

    /// @notice Clear sent messages (for test reset)
    function clearMessages() external {
        delete sentMessages;
    }
}

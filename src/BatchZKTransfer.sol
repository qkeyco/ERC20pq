// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ERC21PQToken } from "./ERC21PQToken.sol";

/// @title BatchZKTransfer
/// @notice Batch multiple ZK-verified transfers into a single transaction for gas efficiency
/// @dev Aggregates multiple transferZK calls, amortizing the base transaction cost.
///      Each individual transfer still requires its own valid STARK proof.
/// @author EthVaultPQ Team
contract BatchZKTransfer is ReentrancyGuard {
    // =============================================================
    //                         STRUCTS
    // =============================================================

    /// @notice A single transfer instruction within a batch
    struct ZKTransferParams {
        address from;
        address to;
        uint256 amount;
        bytes proof;
        uint256[] publicInputs;
    }

    // =============================================================
    //                         STORAGE
    // =============================================================

    /// @notice The ERC-21 PQ token contract
    ERC21PQToken public immutable pqToken;

    /// @notice Maximum transfers per batch
    uint256 public constant MAX_BATCH_SIZE = 20;

    /// @notice Total batches executed
    uint256 public totalBatches;

    /// @notice Total individual transfers executed via batches
    uint256 public totalBatchedTransfers;

    // =============================================================
    //                         EVENTS
    // =============================================================

    event BatchExecuted(uint256 indexed batchId, uint256 successCount, uint256 failCount, uint256 totalAmount);
    event BatchTransferFailed(uint256 indexed batchId, uint256 index, address from, address to, uint256 amount, string reason);

    // =============================================================
    //                         ERRORS
    // =============================================================

    error EmptyBatch();
    error BatchTooLarge();

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /// @param _pqToken The ERC-21 PQ token contract address
    constructor(address _pqToken) {
        pqToken = ERC21PQToken(_pqToken);
    }

    // =============================================================
    //                    CORE FUNCTIONS
    // =============================================================

    /// @notice Execute a batch of ZK-verified transfers
    /// @dev Each transfer is independent - failures don't revert the batch.
    ///      Failed transfers emit BatchTransferFailed events for tracking.
    /// @param transfers Array of ZK transfer parameters
    /// @return successCount Number of successful transfers
    /// @return failCount Number of failed transfers
    function executeBatch(ZKTransferParams[] calldata transfers)
        external
        nonReentrant
        returns (uint256 successCount, uint256 failCount)
    {
        if (transfers.length == 0) revert EmptyBatch();
        if (transfers.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 batchId = totalBatches++;
        uint256 totalAmount;

        for (uint256 i = 0; i < transfers.length; i++) {
            ZKTransferParams calldata t = transfers[i];

            bool success = pqToken.transferZK(t.from, t.to, t.amount, t.proof, t.publicInputs);

            if (success) {
                successCount++;
                totalAmount += t.amount;
            } else {
                failCount++;
                emit BatchTransferFailed(batchId, i, t.from, t.to, t.amount, "transferZK returned false");
            }
        }

        totalBatchedTransfers += successCount;

        emit BatchExecuted(batchId, successCount, failCount, totalAmount);

        return (successCount, failCount);
    }

    /// @notice Execute a batch where all transfers must succeed (atomic)
    /// @dev Reverts if any transfer fails - all-or-nothing execution
    /// @param transfers Array of ZK transfer parameters
    /// @return totalAmount Total amount transferred
    function executeBatchAtomic(ZKTransferParams[] calldata transfers)
        external
        nonReentrant
        returns (uint256 totalAmount)
    {
        if (transfers.length == 0) revert EmptyBatch();
        if (transfers.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 batchId = totalBatches++;

        for (uint256 i = 0; i < transfers.length; i++) {
            ZKTransferParams calldata t = transfers[i];

            bool success = pqToken.transferZK(t.from, t.to, t.amount, t.proof, t.publicInputs);
            require(success, "Atomic batch: transfer failed");

            totalAmount += t.amount;
        }

        totalBatchedTransfers += transfers.length;

        emit BatchExecuted(batchId, transfers.length, 0, totalAmount);

        return totalAmount;
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /// @notice Get batch statistics
    function getStats() external view returns (uint256 batches, uint256 transfers) {
        return (totalBatches, totalBatchedTransfers);
    }
}

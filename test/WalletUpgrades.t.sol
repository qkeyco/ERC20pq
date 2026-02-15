// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import { PQWalletGuardian } from "../src/PQWalletGuardian.sol";
import { BatchZKTransfer } from "../src/BatchZKTransfer.sol";
import { ERC21PQToken } from "../src/ERC21PQToken.sol";
import { MockStarkVerifier } from "../src/mocks/MockStarkVerifier.sol";
import { MockLzEndpoint } from "../src/mocks/MockLzEndpoint.sol";

/// @title WalletUpgradesTest
/// @notice Tests for PQWalletGuardian and BatchZKTransfer
contract WalletUpgradesTest is Test {
    PQWalletGuardian public guardian;
    BatchZKTransfer public batchTransfer;
    ERC21PQToken public token;
    MockStarkVerifier public verifier;
    MockLzEndpoint public lzEndpoint;

    bytes32 public constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    address public owner = address(1);
    address public alice = address(2);
    address public bob = address(3);
    address public guardian1 = address(10);
    address public guardian2 = address(11);
    address public guardian3 = address(12);

    bytes32 public aliceCommitment = bytes32(uint256(12345));
    bytes32 public guardianCommitment1 = bytes32(uint256(111));
    bytes32 public guardianCommitment2 = bytes32(uint256(222));
    bytes32 public guardianCommitment3 = bytes32(uint256(333));

    function setUp() public {
        vm.startPrank(owner);

        lzEndpoint = new MockLzEndpoint();
        verifier = new MockStarkVerifier(PROGRAM_HASH);

        token = new ERC21PQToken(
            "PQ Token",
            "PQT",
            address(lzEndpoint),
            owner,
            address(verifier),
            PROGRAM_HASH,
            1_000_000 * 10 ** 18
        );

        guardian = new PQWalletGuardian(address(token), address(verifier), PROGRAM_HASH);
        batchTransfer = new BatchZKTransfer(address(token));

        // Give Alice tokens
        token.transfer(alice, 50_000 * 10 ** 18);

        vm.stopPrank();
    }

    // =============================================================
    //                    GUARDIAN CONFIGURATION TESTS
    // =============================================================

    function test_ConfigureGuardians() public {
        address[] memory guardians = new address[](3);
        guardians[0] = guardian1;
        guardians[1] = guardian2;
        guardians[2] = guardian3;

        bytes32[] memory commitments = new bytes32[](3);
        commitments[0] = guardianCommitment1;
        commitments[1] = guardianCommitment2;
        commitments[2] = guardianCommitment3;

        vm.prank(alice);
        guardian.configureGuardians(guardians, commitments, 2, 1 days);

        assertTrue(guardian.isConfigured(alice));
        assertEq(guardian.getThreshold(alice), 2);
        assertEq(guardian.getTimelock(alice), 1 days);
        assertTrue(guardian.isGuardianOf(alice, guardian1));
        assertTrue(guardian.isGuardianOf(alice, guardian2));
        assertTrue(guardian.isGuardianOf(alice, guardian3));
    }

    function test_ConfigureGuardians_RevertIfSelfGuardian() public {
        address[] memory guardians = new address[](1);
        guardians[0] = alice; // Self as guardian

        bytes32[] memory commitments = new bytes32[](1);
        commitments[0] = bytes32(uint256(999));

        vm.prank(alice);
        vm.expectRevert(PQWalletGuardian.DuplicateGuardian.selector);
        guardian.configureGuardians(guardians, commitments, 1, 1 days);
    }

    function test_ConfigureGuardians_RevertIfInvalidTimelock() public {
        address[] memory guardians = new address[](1);
        guardians[0] = guardian1;
        bytes32[] memory commitments = new bytes32[](1);
        commitments[0] = guardianCommitment1;

        // Too short
        vm.prank(alice);
        vm.expectRevert(PQWalletGuardian.InvalidTimelock.selector);
        guardian.configureGuardians(guardians, commitments, 1, 1 hours);

        // Too long
        vm.prank(alice);
        vm.expectRevert(PQWalletGuardian.InvalidTimelock.selector);
        guardian.configureGuardians(guardians, commitments, 1, 31 days);
    }

    function test_ConfigureGuardians_RevertIfDuplicate() public {
        address[] memory guardians = new address[](2);
        guardians[0] = guardian1;
        guardians[1] = guardian1; // Duplicate

        bytes32[] memory commitments = new bytes32[](2);
        commitments[0] = guardianCommitment1;
        commitments[1] = guardianCommitment2;

        vm.prank(alice);
        vm.expectRevert(PQWalletGuardian.DuplicateGuardian.selector);
        guardian.configureGuardians(guardians, commitments, 1, 1 days);
    }

    function test_SetThreshold() public {
        _setupGuardians();

        vm.prank(alice);
        guardian.setThreshold(3);

        assertEq(guardian.getThreshold(alice), 3);
    }

    function test_SetThreshold_RevertIfNotConfigured() public {
        vm.prank(alice);
        vm.expectRevert(PQWalletGuardian.GuardiansNotConfigured.selector);
        guardian.setThreshold(1);
    }

    function test_Reconfigure_Guardians() public {
        _setupGuardians();

        // Reconfigure with different guardians
        address[] memory newGuardians = new address[](2);
        newGuardians[0] = address(20);
        newGuardians[1] = address(21);

        bytes32[] memory newCommitments = new bytes32[](2);
        newCommitments[0] = bytes32(uint256(444));
        newCommitments[1] = bytes32(uint256(555));

        vm.prank(alice);
        guardian.configureGuardians(newGuardians, newCommitments, 1, 2 days);

        // Old guardians should no longer be active
        assertFalse(guardian.isGuardianOf(alice, guardian1));
        assertTrue(guardian.isGuardianOf(alice, address(20)));
        assertEq(guardian.getThreshold(alice), 1);
    }

    // =============================================================
    //                    RECOVERY TESTS
    // =============================================================

    function test_InitiateRecovery() public {
        _setupGuardians();

        bytes32 newCommitment = bytes32(uint256(99999));

        (bytes memory proof, uint256[] memory inputs) = _buildGuardianProof(guardian1, guardianCommitment1, 0);

        vm.prank(guardian1);
        uint256 recoveryId = guardian.initiateRecovery(alice, newCommitment, proof, inputs);

        assertEq(recoveryId, 1);
        assertEq(guardian.activeRecovery(alice), 1);

        (address wallet, bytes32 newComm, uint256 approvals, uint256 executeAfter, bool executed, bool cancelled) =
            guardian.getRecoveryRequest(recoveryId);

        assertEq(wallet, alice);
        assertEq(newComm, newCommitment);
        assertEq(approvals, 1);
        assertEq(executeAfter, block.timestamp + 1 days);
        assertFalse(executed);
        assertFalse(cancelled);
    }

    function test_InitiateRecovery_RevertIfNotGuardian() public {
        _setupGuardians();

        (bytes memory proof, uint256[] memory inputs) = _buildGuardianProof(bob, bytes32(uint256(999)), 0);

        vm.prank(bob);
        vm.expectRevert(PQWalletGuardian.NotGuardian.selector);
        guardian.initiateRecovery(alice, bytes32(uint256(99999)), proof, inputs);
    }

    function test_InitiateRecovery_RevertIfAlreadyActive() public {
        _setupGuardians();

        (bytes memory proof1, uint256[] memory inputs1) = _buildGuardianProof(guardian1, guardianCommitment1, 0);
        vm.prank(guardian1);
        guardian.initiateRecovery(alice, bytes32(uint256(99999)), proof1, inputs1);

        // Try to initiate another
        (bytes memory proof2, uint256[] memory inputs2) = _buildGuardianProof(guardian2, guardianCommitment2, 0);
        vm.prank(guardian2);
        vm.expectRevert(PQWalletGuardian.RecoveryAlreadyActive.selector);
        guardian.initiateRecovery(alice, bytes32(uint256(88888)), proof2, inputs2);
    }

    function test_ApproveAndExecuteRecovery() public {
        _setupGuardians();

        bytes32 newCommitment = bytes32(uint256(99999));

        // Guardian1 initiates
        (bytes memory proof1, uint256[] memory inputs1) = _buildGuardianProof(guardian1, guardianCommitment1, 0);
        vm.prank(guardian1);
        uint256 recoveryId = guardian.initiateRecovery(alice, newCommitment, proof1, inputs1);

        // Guardian2 approves (now at 2/2 threshold)
        (bytes memory proof2, uint256[] memory inputs2) = _buildGuardianProof(guardian2, guardianCommitment2, 0);
        vm.prank(guardian2);
        guardian.approveRecovery(recoveryId, proof2, inputs2);

        // Advance past timelock
        vm.warp(block.timestamp + 1 days + 1);

        // Execute
        guardian.executeRecovery(recoveryId);

        (, , , , bool executed, ) = guardian.getRecoveryRequest(recoveryId);
        assertTrue(executed);
        assertEq(guardian.activeRecovery(alice), 0); // Cleared
    }

    function test_ExecuteRecovery_RevertIfTimelockNotElapsed() public {
        _setupGuardians();

        (bytes memory proof1, uint256[] memory inputs1) = _buildGuardianProof(guardian1, guardianCommitment1, 0);
        vm.prank(guardian1);
        uint256 recoveryId = guardian.initiateRecovery(alice, bytes32(uint256(99999)), proof1, inputs1);

        (bytes memory proof2, uint256[] memory inputs2) = _buildGuardianProof(guardian2, guardianCommitment2, 0);
        vm.prank(guardian2);
        guardian.approveRecovery(recoveryId, proof2, inputs2);

        // Try to execute before timelock
        vm.expectRevert(PQWalletGuardian.RecoveryNotReady.selector);
        guardian.executeRecovery(recoveryId);
    }

    function test_ExecuteRecovery_RevertIfInsufficientApprovals() public {
        _setupGuardians();

        (bytes memory proof1, uint256[] memory inputs1) = _buildGuardianProof(guardian1, guardianCommitment1, 0);
        vm.prank(guardian1);
        uint256 recoveryId = guardian.initiateRecovery(alice, bytes32(uint256(99999)), proof1, inputs1);

        // Advance past timelock but only 1/2 approvals
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectRevert(PQWalletGuardian.InsufficientApprovals.selector);
        guardian.executeRecovery(recoveryId);
    }

    function test_CancelRecovery() public {
        _setupGuardians();

        (bytes memory proof1, uint256[] memory inputs1) = _buildGuardianProof(guardian1, guardianCommitment1, 0);
        vm.prank(guardian1);
        uint256 recoveryId = guardian.initiateRecovery(alice, bytes32(uint256(99999)), proof1, inputs1);

        // Alice cancels (proving she still has access)
        vm.prank(alice);
        guardian.cancelRecovery(recoveryId);

        (, , , , , bool cancelled) = guardian.getRecoveryRequest(recoveryId);
        assertTrue(cancelled);
    }

    function test_CancelRecovery_RevertIfNotOwner() public {
        _setupGuardians();

        (bytes memory proof1, uint256[] memory inputs1) = _buildGuardianProof(guardian1, guardianCommitment1, 0);
        vm.prank(guardian1);
        uint256 recoveryId = guardian.initiateRecovery(alice, bytes32(uint256(99999)), proof1, inputs1);

        // Bob tries to cancel (not the wallet owner)
        vm.prank(bob);
        vm.expectRevert(PQWalletGuardian.NotWalletOwner.selector);
        guardian.cancelRecovery(recoveryId);
    }

    // =============================================================
    //                    BATCH ZK TRANSFER TESTS
    // =============================================================

    function test_ExecuteBatch() public {
        // Setup Alice with ZK guard
        vm.startPrank(alice);
        token.bindHD(aliceCommitment);
        token.enableZKGuard();
        vm.stopPrank();

        // Build batch of 3 transfers
        BatchZKTransfer.ZKTransferParams[] memory transfers = new BatchZKTransfer.ZKTransferParams[](3);

        for (uint256 i = 0; i < 3; i++) {
            uint256[] memory publicInputs = new uint256[](5);
            publicInputs[0] = uint256(uint160(alice));
            publicInputs[1] = uint256(uint160(bob));
            publicInputs[2] = 100 * 10 ** 18;
            publicInputs[3] = i; // nonce increments
            publicInputs[4] = uint256(aliceCommitment);

            bytes memory proof = new bytes(1024);
            proof[0] = 0x01;

            transfers[i] = BatchZKTransfer.ZKTransferParams({
                from: alice,
                to: bob,
                amount: 100 * 10 ** 18,
                proof: proof,
                publicInputs: publicInputs
            });
        }

        (uint256 successCount, uint256 failCount) = batchTransfer.executeBatch(transfers);

        assertEq(successCount, 3);
        assertEq(failCount, 0);
        assertEq(token.balanceOf(bob), 300 * 10 ** 18);
        assertEq(token.zkNonce(alice), 3);
    }

    function test_ExecuteBatch_PartialSuccess() public {
        // Setup Alice with ZK guard
        vm.startPrank(alice);
        token.bindHD(aliceCommitment);
        token.enableZKGuard();
        vm.stopPrank();

        // Build batch: first succeeds, second has wrong nonce
        BatchZKTransfer.ZKTransferParams[] memory transfers = new BatchZKTransfer.ZKTransferParams[](2);

        // Good transfer
        uint256[] memory inputs1 = new uint256[](5);
        inputs1[0] = uint256(uint160(alice));
        inputs1[1] = uint256(uint160(bob));
        inputs1[2] = 100 * 10 ** 18;
        inputs1[3] = 0;
        inputs1[4] = uint256(aliceCommitment);
        bytes memory proof1 = new bytes(1024);
        proof1[0] = 0x01;

        transfers[0] = BatchZKTransfer.ZKTransferParams({
            from: alice, to: bob, amount: 100 * 10 ** 18,
            proof: proof1, publicInputs: inputs1
        });

        // Bad transfer (wrong nonce - should be 1 after first transfer)
        uint256[] memory inputs2 = new uint256[](5);
        inputs2[0] = uint256(uint160(alice));
        inputs2[1] = uint256(uint160(bob));
        inputs2[2] = 100 * 10 ** 18;
        inputs2[3] = 0; // Wrong! Should be 1
        inputs2[4] = uint256(aliceCommitment);
        bytes memory proof2 = new bytes(1024);
        proof2[0] = 0x01;

        transfers[1] = BatchZKTransfer.ZKTransferParams({
            from: alice, to: bob, amount: 100 * 10 ** 18,
            proof: proof2, publicInputs: inputs2
        });

        (uint256 successCount, uint256 failCount) = batchTransfer.executeBatch(transfers);

        assertEq(successCount, 1);
        assertEq(failCount, 1);
        assertEq(token.balanceOf(bob), 100 * 10 ** 18);
    }

    function test_ExecuteBatchAtomic_AllSucceed() public {
        vm.startPrank(alice);
        token.bindHD(aliceCommitment);
        token.enableZKGuard();
        vm.stopPrank();

        BatchZKTransfer.ZKTransferParams[] memory transfers = new BatchZKTransfer.ZKTransferParams[](2);

        for (uint256 i = 0; i < 2; i++) {
            uint256[] memory publicInputs = new uint256[](5);
            publicInputs[0] = uint256(uint160(alice));
            publicInputs[1] = uint256(uint160(bob));
            publicInputs[2] = 50 * 10 ** 18;
            publicInputs[3] = i;
            publicInputs[4] = uint256(aliceCommitment);

            bytes memory proof = new bytes(1024);
            proof[0] = 0x01;

            transfers[i] = BatchZKTransfer.ZKTransferParams({
                from: alice, to: bob, amount: 50 * 10 ** 18,
                proof: proof, publicInputs: publicInputs
            });
        }

        uint256 totalAmount = batchTransfer.executeBatchAtomic(transfers);

        assertEq(totalAmount, 100 * 10 ** 18);
        assertEq(token.balanceOf(bob), 100 * 10 ** 18);
    }

    function test_ExecuteBatch_RevertIfEmpty() public {
        BatchZKTransfer.ZKTransferParams[] memory transfers = new BatchZKTransfer.ZKTransferParams[](0);

        vm.expectRevert(BatchZKTransfer.EmptyBatch.selector);
        batchTransfer.executeBatch(transfers);
    }

    function test_ExecuteBatch_RevertIfTooLarge() public {
        BatchZKTransfer.ZKTransferParams[] memory transfers = new BatchZKTransfer.ZKTransferParams[](21);

        vm.expectRevert(BatchZKTransfer.BatchTooLarge.selector);
        batchTransfer.executeBatch(transfers);
    }

    function test_BatchStats() public {
        vm.startPrank(alice);
        token.bindHD(aliceCommitment);
        token.enableZKGuard();
        vm.stopPrank();

        BatchZKTransfer.ZKTransferParams[] memory transfers = new BatchZKTransfer.ZKTransferParams[](1);
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(bob));
        publicInputs[2] = 10 * 10 ** 18;
        publicInputs[3] = 0;
        publicInputs[4] = uint256(aliceCommitment);
        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        transfers[0] = BatchZKTransfer.ZKTransferParams({
            from: alice, to: bob, amount: 10 * 10 ** 18,
            proof: proof, publicInputs: publicInputs
        });

        batchTransfer.executeBatch(transfers);

        (uint256 batches, uint256 totalTransfers) = batchTransfer.getStats();
        assertEq(batches, 1);
        assertEq(totalTransfers, 1);
    }

    // =============================================================
    //                    HELPERS
    // =============================================================

    function _setupGuardians() internal {
        address[] memory guardians = new address[](3);
        guardians[0] = guardian1;
        guardians[1] = guardian2;
        guardians[2] = guardian3;

        bytes32[] memory commitments = new bytes32[](3);
        commitments[0] = guardianCommitment1;
        commitments[1] = guardianCommitment2;
        commitments[2] = guardianCommitment3;

        vm.prank(alice);
        guardian.configureGuardians(guardians, commitments, 2, 1 days);
    }

    function _buildGuardianProof(
        address guardianAddr,
        bytes32 commitment,
        uint256 nonce
    ) internal pure returns (bytes memory proof, uint256[] memory publicInputs) {
        publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(guardianAddr));
        publicInputs[1] = 0;
        publicInputs[2] = 0;
        publicInputs[3] = nonce;
        publicInputs[4] = uint256(commitment);

        proof = new bytes(1024);
        proof[0] = 0x01;
    }
}

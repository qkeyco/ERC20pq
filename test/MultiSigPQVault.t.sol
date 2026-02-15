// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import { MultiSigPQVault } from "../src/MultiSigPQVault.sol";
import { ERC21PQToken } from "../src/ERC21PQToken.sol";
import { MockStarkVerifier } from "../src/mocks/MockStarkVerifier.sol";
import { MockLzEndpoint } from "../src/mocks/MockLzEndpoint.sol";

contract MultiSigPQVaultTest is Test {
    MultiSigPQVault public vault;
    ERC21PQToken public token;
    MockStarkVerifier public verifier;
    MockLzEndpoint public lzEndpoint;

    bytes32 public constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    address public owner = address(1);
    address public signer1 = address(10);
    address public signer2 = address(11);
    address public signer3 = address(12);
    address public nonSigner = address(99);
    address public recipient = address(50);

    bytes32 public commitment1 = bytes32(uint256(111));
    bytes32 public commitment2 = bytes32(uint256(222));
    bytes32 public commitment3 = bytes32(uint256(333));

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

        // Create 2-of-3 vault
        address[] memory signers = new address[](3);
        signers[0] = signer1;
        signers[1] = signer2;
        signers[2] = signer3;

        bytes32[] memory commitments = new bytes32[](3);
        commitments[0] = commitment1;
        commitments[1] = commitment2;
        commitments[2] = commitment3;

        vault = new MultiSigPQVault(
            signers,
            commitments,
            2, // 2-of-3
            address(verifier),
            PROGRAM_HASH
        );

        // Fund the vault
        token.transfer(address(vault), 100_000 * 10 ** 18);

        vm.stopPrank();
    }

    // =============================================================
    //                    HELPERS
    // =============================================================

    function _buildProofAndInputs(
        address signer,
        bytes32 commitment,
        uint256 nonce
    ) internal pure returns (bytes memory proof, uint256[] memory publicInputs) {
        publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(signer));
        publicInputs[1] = uint256(uint160(address(0))); // to (not used for vault approval)
        publicInputs[2] = 0; // amount (not used)
        publicInputs[3] = nonce;
        publicInputs[4] = uint256(commitment);

        proof = new bytes(1024);
        proof[0] = 0x01;
    }

    // =============================================================
    //                    INITIALIZATION TESTS
    // =============================================================

    function test_Initialization() public view {
        assertEq(vault.required(), 2);
        assertEq(vault.signerCount(), 3);
        assertTrue(vault.isSigner(signer1));
        assertTrue(vault.isSigner(signer2));
        assertTrue(vault.isSigner(signer3));
        assertFalse(vault.isSigner(nonSigner));
    }

    function test_GetSigners() public view {
        address[] memory signers = vault.getSigners();
        assertEq(signers.length, 3);
        assertEq(signers[0], signer1);
        assertEq(signers[1], signer2);
        assertEq(signers[2], signer3);
    }

    function test_VaultBalance() public view {
        assertEq(vault.getVaultBalance(address(token)), 100_000 * 10 ** 18);
    }

    function test_Constructor_RevertInvalidSignerCount() public {
        address[] memory signers = new address[](0);
        bytes32[] memory commitments = new bytes32[](0);

        vm.expectRevert(MultiSigPQVault.InvalidSignerCount.selector);
        new MultiSigPQVault(signers, commitments, 1, address(verifier), PROGRAM_HASH);
    }

    function test_Constructor_RevertInvalidRequired() public {
        address[] memory signers = new address[](2);
        signers[0] = address(10);
        signers[1] = address(11);
        bytes32[] memory commitments = new bytes32[](2);
        commitments[0] = bytes32(uint256(1));
        commitments[1] = bytes32(uint256(2));

        // required = 0
        vm.expectRevert(MultiSigPQVault.InvalidRequired.selector);
        new MultiSigPQVault(signers, commitments, 0, address(verifier), PROGRAM_HASH);

        // required > signers
        vm.expectRevert(MultiSigPQVault.InvalidRequired.selector);
        new MultiSigPQVault(signers, commitments, 3, address(verifier), PROGRAM_HASH);
    }

    function test_Constructor_RevertDuplicateSigner() public {
        address[] memory signers = new address[](2);
        signers[0] = address(10);
        signers[1] = address(10); // duplicate
        bytes32[] memory commitments = new bytes32[](2);
        commitments[0] = bytes32(uint256(1));
        commitments[1] = bytes32(uint256(2));

        vm.expectRevert(MultiSigPQVault.DuplicateSigner.selector);
        new MultiSigPQVault(signers, commitments, 1, address(verifier), PROGRAM_HASH);
    }

    // =============================================================
    //                    PROPOSE TESTS
    // =============================================================

    function test_ProposeTransaction() public {
        (bytes memory proof, uint256[] memory inputs) = _buildProofAndInputs(signer1, commitment1, 0);

        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token),
            recipient,
            1000 * 10 ** 18,
            proof,
            inputs
        );

        assertEq(txId, 0);
        assertEq(vault.getApprovalCount(txId), 1);
    }

    function test_ProposeTransaction_RevertIfNotSigner() public {
        (bytes memory proof, uint256[] memory inputs) = _buildProofAndInputs(nonSigner, bytes32(uint256(999)), 0);

        vm.prank(nonSigner);
        vm.expectRevert(MultiSigPQVault.NotSigner.selector);
        vault.proposeTransaction(address(token), recipient, 100, proof, inputs);
    }

    // =============================================================
    //                    APPROVE AND EXECUTE TESTS
    // =============================================================

    function test_ApproveAndExecute_2of3() public {
        // Signer1 proposes
        (bytes memory proof1, uint256[] memory inputs1) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token),
            recipient,
            1000 * 10 ** 18,
            proof1,
            inputs1
        );

        // Verify not yet executed
        (, , , , , bool executed, ) = vault.transactions(txId);
        assertFalse(executed);

        // Signer2 approves -> triggers execution (2-of-3)
        (bytes memory proof2, uint256[] memory inputs2) = _buildProofAndInputs(signer2, commitment2, 0);
        vm.prank(signer2);
        vault.approveTransaction(txId, proof2, inputs2);

        // Verify executed
        (, , , , , executed, ) = vault.transactions(txId);
        assertTrue(executed);

        // Verify recipient received tokens
        assertEq(token.balanceOf(recipient), 1000 * 10 ** 18);
    }

    function test_Approve_RevertIfAlreadyApproved() public {
        (bytes memory proof1, uint256[] memory inputs1) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token), recipient, 100, proof1, inputs1
        );

        // Try to approve again
        (bytes memory proof1b, uint256[] memory inputs1b) = _buildProofAndInputs(signer1, commitment1, 1);
        vm.prank(signer1);
        vm.expectRevert(MultiSigPQVault.AlreadyApproved.selector);
        vault.approveTransaction(txId, proof1b, inputs1b);
    }

    function test_Approve_RevertIfExpired() public {
        (bytes memory proof1, uint256[] memory inputs1) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token), recipient, 100, proof1, inputs1
        );

        // Advance past expiry
        vm.warp(block.timestamp + 8 days);

        (bytes memory proof2, uint256[] memory inputs2) = _buildProofAndInputs(signer2, commitment2, 0);
        vm.prank(signer2);
        vm.expectRevert(MultiSigPQVault.TransactionExpired.selector);
        vault.approveTransaction(txId, proof2, inputs2);
    }

    // =============================================================
    //                    CANCEL TESTS
    // =============================================================

    function test_CancelTransaction() public {
        (bytes memory proof1, uint256[] memory inputs1) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token), recipient, 100, proof1, inputs1
        );

        vm.prank(signer2);
        vault.cancelTransaction(txId);

        (, , , , , , bool cancelled) = vault.transactions(txId);
        assertTrue(cancelled);
    }

    function test_CancelTransaction_RevertIfNotSigner() public {
        (bytes memory proof1, uint256[] memory inputs1) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token), recipient, 100, proof1, inputs1
        );

        vm.prank(nonSigner);
        vm.expectRevert(MultiSigPQVault.NotSigner.selector);
        vault.cancelTransaction(txId);
    }

    function test_CannotApproveAfterCancel() public {
        (bytes memory proof1, uint256[] memory inputs1) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token), recipient, 100, proof1, inputs1
        );

        vm.prank(signer3);
        vault.cancelTransaction(txId);

        (bytes memory proof2, uint256[] memory inputs2) = _buildProofAndInputs(signer2, commitment2, 0);
        vm.prank(signer2);
        vm.expectRevert(MultiSigPQVault.TransactionCancelled_.selector);
        vault.approveTransaction(txId, proof2, inputs2);
    }

    // =============================================================
    //                    NONCE REPLAY PROTECTION
    // =============================================================

    function test_NonceIncrementsAfterProposal() public {
        assertEq(vault.signerNonce(signer1), 0);

        (bytes memory proof, uint256[] memory inputs) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        vault.proposeTransaction(address(token), recipient, 100, proof, inputs);

        assertEq(vault.signerNonce(signer1), 1);
    }

    function test_CanExecute() public {
        (bytes memory proof1, uint256[] memory inputs1) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault.proposeTransaction(
            address(token), recipient, 1000 * 10 ** 18, proof1, inputs1
        );

        // Only 1 approval, need 2
        assertFalse(vault.canExecute(txId));

        // Add second approval
        (bytes memory proof2, uint256[] memory inputs2) = _buildProofAndInputs(signer2, commitment2, 0);
        vm.prank(signer2);
        vault.approveTransaction(txId, proof2, inputs2);

        // Already executed by auto-execute
        assertFalse(vault.canExecute(txId));
    }

    // =============================================================
    //                    1-OF-N AUTO-EXECUTE TEST
    // =============================================================

    function test_AutoExecute_1ofN() public {
        // Create a 1-of-3 vault
        address[] memory signersList = new address[](3);
        signersList[0] = signer1;
        signersList[1] = signer2;
        signersList[2] = signer3;
        bytes32[] memory commitmentsList = new bytes32[](3);
        commitmentsList[0] = commitment1;
        commitmentsList[1] = commitment2;
        commitmentsList[2] = commitment3;

        MultiSigPQVault vault1of3 = new MultiSigPQVault(
            signersList, commitmentsList, 1, address(verifier), PROGRAM_HASH
        );

        // Fund it
        vm.prank(owner);
        token.transfer(address(vault1of3), 10_000 * 10 ** 18);

        // Single proposal should auto-execute
        (bytes memory proof, uint256[] memory inputs) = _buildProofAndInputs(signer1, commitment1, 0);
        vm.prank(signer1);
        uint256 txId = vault1of3.proposeTransaction(
            address(token), recipient, 500 * 10 ** 18, proof, inputs
        );

        (, , , , , bool executed, ) = vault1of3.transactions(txId);
        assertTrue(executed);
        assertEq(token.balanceOf(recipient), 500 * 10 ** 18);
    }
}

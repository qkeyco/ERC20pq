// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import { ERC21PQToken } from "../src/ERC21PQToken.sol";
import { MockStarkVerifier } from "../src/mocks/MockStarkVerifier.sol";
import { PizzaMerchant } from "../src/demos/PizzaMerchant.sol";
import { TinyDex } from "../src/demos/TinyDex.sol";
import { MockUSD } from "../src/mocks/MockUSD.sol";
import { MockLzEndpoint } from "../src/mocks/MockLzEndpoint.sol";
import { SendParam, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oft/interfaces/IOFT.sol";

/// @title ERC21PQTokenTest
/// @notice Comprehensive tests for ERC-21 ZK-guarded token with STARK proofs
contract ERC21PQTokenTest is Test {
    // =============================================================
    //                         CONTRACTS
    // =============================================================

    ERC21PQToken public token;
    MockStarkVerifier public verifier;
    PizzaMerchant public merchant;
    TinyDex public dex;
    MockUSD public usd;
    MockLzEndpoint public lzEndpoint;

    // Program hash for HD commitment verification
    bytes32 public constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    // =============================================================
    //                         ADDRESSES
    // =============================================================

    address public owner = address(1);
    address public alice = address(2);
    address public bob = address(3);
    address public will = address(4);  // The thief

    // =============================================================
    //                          SETUP
    // =============================================================

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock LZ endpoint
        lzEndpoint = new MockLzEndpoint();

        // Deploy STARK verifier
        verifier = new MockStarkVerifier(PROGRAM_HASH);

        // Deploy token with initial supply
        token = new ERC21PQToken(
            "ERC21 PQ Token",
            "LZPQ",
            address(lzEndpoint),
            owner,
            address(verifier),
            PROGRAM_HASH,
            1_000_000 * 10 ** 18
        );

        // Deploy demo contracts
        merchant = new PizzaMerchant(address(token), 10 * 10 ** 18);
        usd = new MockUSD();
        dex = new TinyDex(address(token), address(usd), 1 * 10 ** 18);

        // Setup liquidity for DEX
        token.transfer(address(dex), 100_000 * 10 ** 18);
        usd.transfer(address(dex), 100_000 * 10 ** 18);

        // Give Alice some tokens
        token.transfer(alice, 10_000 * 10 ** 18);

        // Configure peer for cross-chain tests (chain ID 2)
        // In real deployment, this would be the token contract on the destination chain
        bytes32 peerAddress = bytes32(uint256(uint160(address(token))));
        token.setPeer(2, peerAddress);

        vm.stopPrank();
    }

    // =============================================================
    //                    BASIC ERC-20 TESTS
    // =============================================================

    function test_InitialSupply() public view {
        assertEq(token.totalSupply(), 1_000_000 * 10 ** 18);
    }

    function test_Transfer() public {
        vm.prank(alice);
        token.transfer(bob, 100 * 10 ** 18);

        assertEq(token.balanceOf(bob), 100 * 10 ** 18);
        assertEq(token.balanceOf(alice), 9_900 * 10 ** 18);
    }

    function test_TransferFrom() public {
        vm.prank(alice);
        token.approve(bob, 100 * 10 ** 18);

        vm.prank(bob);
        token.transferFrom(alice, bob, 100 * 10 ** 18);

        assertEq(token.balanceOf(bob), 100 * 10 ** 18);
    }

    // =============================================================
    //                    ZK GUARD TESTS
    // =============================================================

    function test_BindHDCommitment() public {
        bytes32 commitment = keccak256(abi.encodePacked("secret"));

        vm.prank(alice);
        token.bindHD(commitment);

        assertEq(token.hdCommitment(alice), commitment);
    }

    function test_BindHDCommitment_RevertIfAlreadyBound() public {
        bytes32 commitment = keccak256(abi.encodePacked("secret"));

        vm.startPrank(alice);
        token.bindHD(commitment);

        vm.expectRevert(ERC21PQToken.CommitmentAlreadyBound.selector);
        token.bindHD(commitment);
        vm.stopPrank();
    }

    function test_EnableZKGuard() public {
        bytes32 commitment = keccak256(abi.encodePacked("secret"));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        assertTrue(token.zkGuardEnabled(alice));
    }

    function test_EnableZKGuard_RevertIfNoCommitment() public {
        vm.prank(alice);
        vm.expectRevert(ERC21PQToken.NoCommitmentBound.selector);
        token.enableZKGuard();
    }

    function test_Transfer_RevertsWhenGuarded() public {
        // Alice binds commitment and enables guard
        bytes32 commitment = keccak256(abi.encodePacked("secret"));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();

        // Now try to transfer normally - should revert
        vm.expectRevert(ERC21PQToken.ZKGuardEnabled_UseTransferZK.selector);
        token.transfer(bob, 100 * 10 ** 18);
        vm.stopPrank();
    }

    function test_TransferFrom_RevertsWhenGuarded() public {
        // Alice binds commitment and enables guard
        bytes32 commitment = keccak256(abi.encodePacked("secret"));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        token.approve(bob, 100 * 10 ** 18);
        vm.stopPrank();

        // Bob tries to transferFrom - should revert
        vm.prank(bob);
        vm.expectRevert(ERC21PQToken.ZKGuardEnabled_UseTransferZK.selector);
        token.transferFrom(alice, bob, 100 * 10 ** 18);
    }

    // =============================================================
    //                    ZK TRANSFER TESTS
    // =============================================================

    function test_TransferZK() public {
        // Setup: Alice binds commitment and enables guard
        bytes32 commitment = bytes32(uint256(12345)); // Simple commitment for test

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        // Build proof and public inputs
        // Public inputs: [from, to, amount, nonce, commitment]
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(bob));
        publicInputs[2] = 100 * 10 ** 18;
        publicInputs[3] = 0; // First transfer, nonce = 0
        publicInputs[4] = uint256(commitment);

        // Create a non-zero proof (placeholder verifier accepts non-zero proofs)
        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        // Execute ZK transfer
        token.transferZK(alice, bob, 100 * 10 ** 18, proof, publicInputs);

        // Verify results
        assertEq(token.balanceOf(bob), 100 * 10 ** 18);
        assertEq(token.balanceOf(alice), 9_900 * 10 ** 18);
        assertEq(token.zkNonce(alice), 1);
    }

    function test_TransferZK_RevertIfNotGuarded() public {
        // Try to use transferZK without enabling guard
        uint256[] memory publicInputs = new uint256[](5);
        bytes memory proof = new bytes(1024);

        // Should return false and emit ZKProofFailed event (no longer reverts)
        bool success = token.transferZK(alice, bob, 100 * 10 ** 18, proof, publicInputs);
        assertFalse(success, "Should return false when guard not enabled");
    }

    function test_TransferZK_RevertIfInvalidNonce() public {
        // Setup
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        // Try with wrong nonce
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(bob));
        publicInputs[2] = 100 * 10 ** 18;
        publicInputs[3] = 1; // Wrong nonce (should be 0)
        publicInputs[4] = uint256(commitment);

        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        // Should return false and emit ZKProofFailed event (no longer reverts)
        bool success = token.transferZK(alice, bob, 100 * 10 ** 18, proof, publicInputs);
        assertFalse(success, "Should return false with invalid nonce");

        // Verify no transfer occurred
        assertEq(token.balanceOf(bob), 0);
        assertEq(token.zkNonce(alice), 0);
    }

    // =============================================================
    //                    DEMO SCENARIO TESTS
    // =============================================================

    /// @notice Full "Will the Thief" scenario
    function test_WillTheThief_CannotStealTokens() public {
        // Step 1: Alice binds commitment and enables guard
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        // Step 2: Will gets Alice's private key (simulated by pranking as Alice)
        // Will tries to transfer Alice's tokens
        vm.prank(alice); // Will is now "controlling" Alice's account
        vm.expectRevert(ERC21PQToken.ZKGuardEnabled_UseTransferZK.selector);
        token.transfer(will, 1000 * 10 ** 18);

        // Will tries transferFrom
        vm.prank(alice);
        token.approve(will, 1000 * 10 ** 18);

        vm.prank(will);
        vm.expectRevert(ERC21PQToken.ZKGuardEnabled_UseTransferZK.selector);
        token.transferFrom(alice, will, 1000 * 10 ** 18);

        // Alice's balance unchanged
        assertEq(token.balanceOf(alice), 10_000 * 10 ** 18);
        assertEq(token.balanceOf(will), 0);
    }

    /// @notice Test pizza payment with guarded account
    function test_PizzaPayment_WithZKTransfer() public {
        // Setup: Alice enables guard
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        // Alice uses transferZK to pay for pizza
        uint256 pizzaPrice = 10 * 10 ** 18;

        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(address(merchant)));
        publicInputs[2] = pizzaPrice;
        publicInputs[3] = 0;
        publicInputs[4] = uint256(commitment);

        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        // Execute ZK transfer to merchant
        token.transferZK(alice, address(merchant), pizzaPrice, proof, publicInputs);

        // Verify merchant received tokens
        assertEq(token.balanceOf(address(merchant)), pizzaPrice);
        assertEq(merchant.getBalance(), pizzaPrice);
    }

    /// @notice Test DEX swap with guarded account
    function test_DexSwap_WithZKTransfer() public {
        // Setup: Alice enables guard
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        // Alice uses transferZK to send tokens to DEX
        uint256 swapAmount = 100 * 10 ** 18;

        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(address(dex)));
        publicInputs[2] = swapAmount;
        publicInputs[3] = 0;
        publicInputs[4] = uint256(commitment);

        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        // First transfer to DEX using ZK
        token.transferZK(alice, address(dex), swapAmount, proof, publicInputs);

        // DEX received the tokens
        uint256 initialDexBalance = 100_000 * 10 ** 18 + swapAmount;
        assertEq(token.balanceOf(address(dex)), initialDexBalance);
    }

    // =============================================================
    //                      VIEW FUNCTION TESTS
    // =============================================================

    function test_IsGuarded() public {
        assertFalse(token.isGuarded(alice));

        bytes32 commitment = keccak256(abi.encodePacked("secret"));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        assertTrue(token.isGuarded(alice));
    }

    function test_GetNonce() public view {
        assertEq(token.getNonce(alice), 0);
    }

    function test_GetCommitment() public {
        assertEq(token.getCommitment(alice), bytes32(0));

        bytes32 commitment = keccak256(abi.encodePacked("secret"));

        vm.prank(alice);
        token.bindHD(commitment);

        assertEq(token.getCommitment(alice), commitment);
    }

    // =============================================================
    //                 CROSS-CHAIN ZK SEND TESTS
    // =============================================================

    /// @notice Test that regular send() is blocked for ZK-guarded accounts
    function test_Send_RevertsWhenGuarded() public {
        // Setup: Alice enables ZK guard
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();

        // Try to use regular send() - should revert
        SendParam memory sendParam = SendParam({
            dstEid: 2, // Destination chain
            to: bytes32(uint256(uint160(bob))),
            amountLD: 100 * 10 ** 18,
            minAmountLD: 100 * 10 ** 18,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });

        vm.deal(alice, 1 ether);
        vm.expectRevert(ERC21PQToken.ZKGuardEnabled_UseSendZK.selector);
        token.send{value: 0.01 ether}(sendParam, fee, alice);
        vm.stopPrank();
    }

    /// @notice Test sendZK() with valid STARK proof
    function test_SendZK_WithValidProof() public {
        // Setup: Alice enables ZK guard
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        uint256 sendAmount = 100 * 10 ** 18;

        // Build SendParam
        SendParam memory sendParam = SendParam({
            dstEid: 2, // Destination chain
            to: bytes32(uint256(uint160(bob))),
            amountLD: sendAmount,
            minAmountLD: sendAmount,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });

        // Build proof and public inputs
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(bob));
        publicInputs[2] = sendAmount;
        publicInputs[3] = 0; // First send, nonce = 0
        publicInputs[4] = uint256(commitment);

        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        // Execute sendZK
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        token.sendZK{value: 0.01 ether}(sendParam, fee, alice, proof, publicInputs);

        // Verify tokens were burned on source chain
        assertEq(token.balanceOf(alice), 10_000 * 10 ** 18 - sendAmount);

        // Verify nonce was incremented
        assertEq(token.zkNonce(alice), 1);

        // Verify message was sent via LayerZero
        assertEq(lzEndpoint.getSentMessagesCount(), 1);
    }

    /// @notice Test sendZK() reverts with invalid nonce
    function test_SendZK_RevertWithInvalidNonce() public {
        // Setup
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        uint256 sendAmount = 100 * 10 ** 18;

        SendParam memory sendParam = SendParam({
            dstEid: 2,
            to: bytes32(uint256(uint160(bob))),
            amountLD: sendAmount,
            minAmountLD: sendAmount,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });

        // Build proof with wrong nonce
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(bob));
        publicInputs[2] = sendAmount;
        publicInputs[3] = 1; // Wrong nonce (should be 0)
        publicInputs[4] = uint256(commitment);

        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(ERC21PQToken.InvalidNonce.selector);
        token.sendZK{value: 0.01 ether}(sendParam, fee, alice, proof, publicInputs);
    }

    /// @notice Test sendZK() reverts when not guarded
    function test_SendZK_RevertWhenNotGuarded() public {
        uint256 sendAmount = 100 * 10 ** 18;

        SendParam memory sendParam = SendParam({
            dstEid: 2,
            to: bytes32(uint256(uint160(bob))),
            amountLD: sendAmount,
            minAmountLD: sendAmount,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });

        uint256[] memory publicInputs = new uint256[](5);
        bytes memory proof = new bytes(1024);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(ERC21PQToken.ZKGuardNotEnabled.selector);
        token.sendZK{value: 0.01 ether}(sendParam, fee, alice, proof, publicInputs);
    }

    /// @notice Test sendZK() with invalid proof
    function test_SendZK_RevertWithInvalidProof() public {
        // Setup
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        uint256 sendAmount = 100 * 10 ** 18;

        SendParam memory sendParam = SendParam({
            dstEid: 2,
            to: bytes32(uint256(uint160(bob))),
            amountLD: sendAmount,
            minAmountLD: sendAmount,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });

        // Build valid public inputs but empty proof (MockVerifier rejects empty proofs)
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(bob));
        publicInputs[2] = sendAmount;
        publicInputs[3] = 0;
        publicInputs[4] = uint256(commitment);

        // Empty proof - should be rejected
        bytes memory proof = new bytes(1024);
        // Don't set proof[0] = 0x01, so verifier returns false

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(ERC21PQToken.InvalidProof.selector);
        token.sendZK{value: 0.01 ether}(sendParam, fee, alice, proof, publicInputs);
    }

    /// @notice Test replay attack prevention with nonce
    function test_SendZK_ReplayAttackPrevention() public {
        // Setup
        bytes32 commitment = bytes32(uint256(12345));

        vm.startPrank(alice);
        token.bindHD(commitment);
        token.enableZKGuard();
        vm.stopPrank();

        uint256 sendAmount = 100 * 10 ** 18;

        SendParam memory sendParam = SendParam({
            dstEid: 2,
            to: bytes32(uint256(uint160(bob))),
            amountLD: sendAmount,
            minAmountLD: sendAmount,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });

        // First send with nonce 0
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = uint256(uint160(alice));
        publicInputs[1] = uint256(uint160(bob));
        publicInputs[2] = sendAmount;
        publicInputs[3] = 0;
        publicInputs[4] = uint256(commitment);

        bytes memory proof = new bytes(1024);
        proof[0] = 0x01;

        vm.deal(alice, 2 ether);

        // First send succeeds
        vm.prank(alice);
        token.sendZK{value: 0.01 ether}(sendParam, fee, alice, proof, publicInputs);
        assertEq(token.zkNonce(alice), 1);

        // Try to replay the same proof - should fail because nonce is now 1
        vm.prank(alice);
        vm.expectRevert(ERC21PQToken.InvalidNonce.selector);
        token.sendZK{value: 0.01 ether}(sendParam, fee, alice, proof, publicInputs);

        // Second send with correct nonce succeeds
        publicInputs[3] = 1; // Updated nonce
        vm.prank(alice);
        token.sendZK{value: 0.01 ether}(sendParam, fee, alice, proof, publicInputs);
        assertEq(token.zkNonce(alice), 2);
    }

    /// @notice Test that unguarded accounts can use regular send()
    function test_Send_WorksWhenNotGuarded() public {
        SendParam memory sendParam = SendParam({
            dstEid: 2,
            to: bytes32(uint256(uint160(bob))),
            amountLD: 100 * 10 ** 18,
            minAmountLD: 100 * 10 ** 18,
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = MessagingFee({
            nativeFee: 0.01 ether,
            lzTokenFee: 0
        });

        uint256 balanceBefore = token.balanceOf(alice);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        token.send{value: 0.01 ether}(sendParam, fee, alice);

        // Tokens should be burned
        assertEq(token.balanceOf(alice), balanceBefore - 100 * 10 ** 18);

        // Message should be sent
        assertEq(lzEndpoint.getSentMessagesCount(), 1);
    }
}

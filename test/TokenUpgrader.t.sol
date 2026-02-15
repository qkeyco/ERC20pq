// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import { TokenUpgrader } from "../src/TokenUpgrader.sol";
import { ERC21PQToken } from "../src/ERC21PQToken.sol";
import { MockStarkVerifier } from "../src/mocks/MockStarkVerifier.sol";
import { MockLzEndpoint } from "../src/mocks/MockLzEndpoint.sol";
import { MockUSD } from "../src/mocks/MockUSD.sol";

contract TokenUpgraderTest is Test {
    TokenUpgrader public upgrader;
    ERC21PQToken public pqToken;
    MockStarkVerifier public verifier;
    MockLzEndpoint public lzEndpoint;
    MockUSD public usdc;

    bytes32 public constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    address public owner = address(1);
    address public alice = address(2);
    address public bob = address(3);

    function setUp() public {
        vm.startPrank(owner);

        lzEndpoint = new MockLzEndpoint();
        verifier = new MockStarkVerifier(PROGRAM_HASH);

        pqToken = new ERC21PQToken(
            "PQ Token",
            "PQT",
            address(lzEndpoint),
            owner,
            address(verifier),
            PROGRAM_HASH,
            10_000_000 * 10 ** 18
        );

        usdc = new MockUSD();

        upgrader = new TokenUpgrader(owner);

        // Fund upgrader with PQ tokens
        pqToken.transfer(address(upgrader), 5_000_000 * 10 ** 18);

        // Register USDC -> PQT pair
        upgrader.registerTokenPair(address(usdc), address(pqToken));

        // Give Alice some USDC
        usdc.transfer(alice, 100_000 * 10 ** 18);

        vm.stopPrank();
    }

    // =============================================================
    //                    REGISTRATION TESTS
    // =============================================================

    function test_RegisterTokenPair() public view {
        (address pq, bool active, uint256 deposited, uint256 upgrades, uint256 downgrades) =
            upgrader.getTokenPairInfo(address(usdc));

        assertEq(pq, address(pqToken));
        assertTrue(active);
        assertEq(deposited, 0);
        assertEq(upgrades, 0);
        assertEq(downgrades, 0);
    }

    function test_RegisterTokenPair_RevertIfAlreadyRegistered() public {
        vm.prank(owner);
        vm.expectRevert(TokenUpgrader.AlreadyRegistered.selector);
        upgrader.registerTokenPair(address(usdc), address(pqToken));
    }

    function test_RegisterTokenPair_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        upgrader.registerTokenPair(address(0x999), address(0x888));
    }

    function test_SupportedTokenCount() public view {
        assertEq(upgrader.supportedTokenCount(), 1);
    }

    function test_IsSupported() public view {
        assertTrue(upgrader.isSupported(address(usdc)));
        assertFalse(upgrader.isSupported(address(0x999)));
    }

    // =============================================================
    //                    UPGRADE TESTS
    // =============================================================

    function test_Upgrade() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.startPrank(alice);
        usdc.approve(address(upgrader), amount);
        upgrader.upgrade(address(usdc), amount);
        vm.stopPrank();

        // Alice should have PQ tokens
        assertEq(pqToken.balanceOf(alice), amount);
        // Upgrader should hold the USDC
        assertEq(usdc.balanceOf(address(upgrader)), amount);
        // Alice's USDC should decrease
        assertEq(usdc.balanceOf(alice), 100_000 * 10 ** 18 - amount);
    }

    function test_Upgrade_UpdatesAccounting() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.startPrank(alice);
        usdc.approve(address(upgrader), amount);
        upgrader.upgrade(address(usdc), amount);
        vm.stopPrank();

        (,, uint256 deposited, uint256 upgrades,) = upgrader.getTokenPairInfo(address(usdc));
        assertEq(deposited, amount);
        assertEq(upgrades, 1);
    }

    function test_Upgrade_RevertIfZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TokenUpgrader.ZeroAmount.selector);
        upgrader.upgrade(address(usdc), 0);
    }

    function test_Upgrade_RevertIfNotSupported() public {
        vm.prank(alice);
        vm.expectRevert(TokenUpgrader.TokenNotSupported.selector);
        upgrader.upgrade(address(0x999), 100);
    }

    function test_Upgrade_RevertIfPaused() public {
        vm.prank(owner);
        upgrader.pause();

        vm.startPrank(alice);
        usdc.approve(address(upgrader), 100);
        vm.expectRevert();
        upgrader.upgrade(address(usdc), 100);
        vm.stopPrank();
    }

    function test_Upgrade_RevertIfInactive() public {
        vm.prank(owner);
        upgrader.setTokenPairActive(address(usdc), false);

        vm.startPrank(alice);
        usdc.approve(address(upgrader), 100);
        vm.expectRevert(TokenUpgrader.TokenPairInactive.selector);
        upgrader.upgrade(address(usdc), 100);
        vm.stopPrank();
    }

    function test_Upgrade_RespectsTokenCap() public {
        vm.prank(owner);
        upgrader.setUpgradeCap(address(usdc), 500 * 10 ** 18);

        vm.startPrank(alice);
        usdc.approve(address(upgrader), 1000 * 10 ** 18);

        // First upgrade within cap
        upgrader.upgrade(address(usdc), 400 * 10 ** 18);

        // Second upgrade exceeds cap
        vm.expectRevert(TokenUpgrader.UpgradeCapExceeded.selector);
        upgrader.upgrade(address(usdc), 200 * 10 ** 18);
        vm.stopPrank();
    }

    function test_Upgrade_RespectsMinimumAmount() public {
        vm.prank(owner);
        upgrader.setMinUpgradeAmount(address(usdc), 100 * 10 ** 18);

        vm.startPrank(alice);
        usdc.approve(address(upgrader), 50 * 10 ** 18);
        vm.expectRevert(TokenUpgrader.BelowMinimum.selector);
        upgrader.upgrade(address(usdc), 50 * 10 ** 18);
        vm.stopPrank();
    }

    function test_Upgrade_RespectsCooldown() public {
        vm.prank(owner);
        upgrader.setUpgradeCooldown(1 hours);

        vm.startPrank(alice);
        usdc.approve(address(upgrader), 2000 * 10 ** 18);

        // First upgrade succeeds
        upgrader.upgrade(address(usdc), 100 * 10 ** 18);

        // Second upgrade fails (cooldown)
        vm.expectRevert(TokenUpgrader.CooldownNotElapsed.selector);
        upgrader.upgrade(address(usdc), 100 * 10 ** 18);

        // Advance time past cooldown
        vm.warp(block.timestamp + 1 hours + 1);

        // Now succeeds
        upgrader.upgrade(address(usdc), 100 * 10 ** 18);
        vm.stopPrank();
    }

    function test_Upgrade_RespectsUserLimit() public {
        vm.prank(owner);
        upgrader.setUserUpgradeLimit(alice, 500 * 10 ** 18);

        vm.startPrank(alice);
        usdc.approve(address(upgrader), 1000 * 10 ** 18);

        upgrader.upgrade(address(usdc), 400 * 10 ** 18);

        vm.expectRevert(TokenUpgrader.UserLimitExceeded.selector);
        upgrader.upgrade(address(usdc), 200 * 10 ** 18);
        vm.stopPrank();
    }

    // =============================================================
    //                    DOWNGRADE TESTS
    // =============================================================

    function test_Downgrade() public {
        uint256 amount = 1000 * 10 ** 18;

        // First upgrade
        vm.startPrank(alice);
        usdc.approve(address(upgrader), amount);
        upgrader.upgrade(address(usdc), amount);

        // Then downgrade
        pqToken.approve(address(upgrader), amount);
        upgrader.downgrade(address(pqToken), amount);
        vm.stopPrank();

        // Alice should have her USDC back
        assertEq(usdc.balanceOf(alice), 100_000 * 10 ** 18);
        assertEq(pqToken.balanceOf(alice), 0);
    }

    function test_Downgrade_UpdatesAccounting() public {
        uint256 amount = 1000 * 10 ** 18;

        vm.startPrank(alice);
        usdc.approve(address(upgrader), amount);
        upgrader.upgrade(address(usdc), amount);

        pqToken.approve(address(upgrader), amount);
        upgrader.downgrade(address(pqToken), amount);
        vm.stopPrank();

        (,, uint256 deposited,, uint256 downgrades) = upgrader.getTokenPairInfo(address(usdc));
        assertEq(deposited, 0);
        assertEq(downgrades, 1);
    }

    function test_Downgrade_RevertIfZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(TokenUpgrader.ZeroAmount.selector);
        upgrader.downgrade(address(pqToken), 0);
    }

    function test_Downgrade_RevertIfNotSupported() public {
        vm.prank(alice);
        vm.expectRevert(TokenUpgrader.TokenNotSupported.selector);
        upgrader.downgrade(address(0x999), 100);
    }

    // =============================================================
    //                    VIEW FUNCTION TESTS
    // =============================================================

    function test_AvailableCapacity_NoCap() public view {
        assertEq(upgrader.availableCapacity(address(usdc)), type(uint256).max);
    }

    function test_AvailableCapacity_WithCap() public {
        vm.prank(owner);
        upgrader.setUpgradeCap(address(usdc), 1000 * 10 ** 18);

        assertEq(upgrader.availableCapacity(address(usdc)), 1000 * 10 ** 18);

        // Upgrade some
        vm.startPrank(alice);
        usdc.approve(address(upgrader), 300 * 10 ** 18);
        upgrader.upgrade(address(usdc), 300 * 10 ** 18);
        vm.stopPrank();

        assertEq(upgrader.availableCapacity(address(usdc)), 700 * 10 ** 18);
    }

    function test_GetPQToken() public view {
        assertEq(upgrader.getPQToken(address(usdc)), address(pqToken));
    }

    function test_GetUnderlying() public view {
        assertEq(upgrader.getUnderlying(address(pqToken)), address(usdc));
    }

    // =============================================================
    //                    ADMIN FUNCTION TESTS
    // =============================================================

    function test_EmergencyWithdraw() public {
        // Upgrade first to put tokens in the contract
        vm.startPrank(alice);
        usdc.approve(address(upgrader), 1000 * 10 ** 18);
        upgrader.upgrade(address(usdc), 1000 * 10 ** 18);
        vm.stopPrank();

        // Emergency withdraw
        vm.prank(owner);
        upgrader.emergencyWithdraw(address(usdc), owner, 500 * 10 ** 18);

        assertEq(usdc.balanceOf(owner), 500 * 10 ** 18);
    }

    function test_PauseUnpause() public {
        vm.startPrank(owner);
        upgrader.pause();

        vm.stopPrank();

        vm.startPrank(alice);
        usdc.approve(address(upgrader), 100);
        vm.expectRevert();
        upgrader.upgrade(address(usdc), 100);
        vm.stopPrank();

        vm.prank(owner);
        upgrader.unpause();

        // Should work now
        vm.startPrank(alice);
        upgrader.upgrade(address(usdc), 100);
        vm.stopPrank();
    }
}

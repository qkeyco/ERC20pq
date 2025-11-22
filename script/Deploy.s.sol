// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { ERC21PQToken } from "../src/ERC21PQToken.sol";
import { StarkVerifier } from "../src/StarkVerifier.sol";
import { PizzaMerchant } from "../src/demos/PizzaMerchant.sol";
import { TinyDex } from "../src/demos/TinyDex.sol";
import { MockUSD } from "../src/mocks/MockUSD.sol";

/// @title DeployScript
/// @notice Deploys all ERC-21 contracts to testnet with STARK verifier
contract DeployScript is Script {
    // Program hash for HD commitment verification
    bytes32 constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    function run() external {
        // Get deployer from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get LayerZero endpoint for target chain
        address lzEndpoint = vm.envAddress("LZ_ENDPOINT");

        console.log("Deploying with account:", deployer);
        console.log("LayerZero endpoint:", lzEndpoint);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy STARK Verifier (quantum-resistant)
        StarkVerifier verifier = new StarkVerifier(PROGRAM_HASH);
        console.log("StarkVerifier deployed at:", address(verifier));

        // 2. Deploy ERC21PQToken
        uint256 initialSupply = 1_000_000 * 10 ** 18; // 1M tokens
        ERC21PQToken token = new ERC21PQToken(
            "ERC21 PQ Token",
            "LZPQ",
            lzEndpoint,
            deployer,
            address(verifier),
            PROGRAM_HASH,
            initialSupply
        );
        console.log("ERC21PQToken deployed at:", address(token));

        // 3. Deploy MockUSD (for demo)
        MockUSD usd = new MockUSD();
        console.log("MockUSD deployed at:", address(usd));

        // 4. Deploy PizzaMerchant
        uint256 pizzaPrice = 10 * 10 ** 18; // 10 LZPQ per pizza
        PizzaMerchant merchant = new PizzaMerchant(address(token), pizzaPrice);
        console.log("PizzaMerchant deployed at:", address(merchant));

        // 5. Deploy TinyDex
        uint256 exchangeRate = 1 * 10 ** 18; // 1:1 for demo
        TinyDex dex = new TinyDex(address(token), address(usd), exchangeRate);
        console.log("TinyDex deployed at:", address(dex));

        // 6. Add initial liquidity to DEX
        uint256 lzpqLiquidity = 100_000 * 10 ** 18;
        uint256 usdLiquidity = 100_000 * 10 ** 18;

        token.approve(address(dex), lzpqLiquidity);
        usd.approve(address(dex), usdLiquidity);
        dex.addLiquidity(lzpqLiquidity, usdLiquidity);
        console.log("Added liquidity to DEX");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Verifier:", address(verifier));
        console.log("Token:", address(token));
        console.log("MockUSD:", address(usd));
        console.log("Merchant:", address(merchant));
        console.log("DEX:", address(dex));
        console.log("========================\n");
    }
}

/// @title DeployTenderly
/// @notice Deploy to Tenderly fork with unlocked accounts
contract DeployTenderly is Script {
    bytes32 constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    function run() external {
        // Use unlocked account for Tenderly
        address deployer = 0xD32e40436e4F6C892918C6A19AF75bf997cDe0f9;
        address lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;

        console.log("Deploying to Tenderly with account:", deployer);

        vm.startBroadcast(deployer);

        // Deploy STARK verifier
        StarkVerifier verifier = new StarkVerifier(PROGRAM_HASH);

        ERC21PQToken token = new ERC21PQToken(
            "ERC21 PQ Token",
            "LZPQ",
            lzEndpoint,
            deployer,
            address(verifier),
            PROGRAM_HASH,
            1_000_000 * 10 ** 18
        );

        MockUSD usd = new MockUSD();
        PizzaMerchant merchant = new PizzaMerchant(address(token), 10 * 10 ** 18);
        TinyDex dex = new TinyDex(address(token), address(usd), 1 * 10 ** 18);

        // Add liquidity
        token.approve(address(dex), 100_000 * 10 ** 18);
        usd.approve(address(dex), 100_000 * 10 ** 18);
        dex.addLiquidity(100_000 * 10 ** 18, 100_000 * 10 ** 18);

        vm.stopBroadcast();

        console.log("\n=== Tenderly Deployment ===");
        console.log("Verifier:", address(verifier));
        console.log("Token:", address(token));
        console.log("MockUSD:", address(usd));
        console.log("Merchant:", address(merchant));
        console.log("DEX:", address(dex));
        console.log("===========================\n");
    }
}

/// @title DeployLocal
/// @notice Deploy to local Anvil for testing
contract DeployLocal is Script {
    bytes32 constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    function run() external {
        // Use default Anvil account
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        address deployer = vm.addr(deployerPrivateKey);

        // Mock LZ endpoint for local testing
        address lzEndpoint = address(0x1a44076050125825900e736c501f859c50fE728c);

        console.log("Deploying locally with account:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy STARK verifier
        StarkVerifier verifier = new StarkVerifier(PROGRAM_HASH);

        ERC21PQToken token = new ERC21PQToken(
            "ERC21 PQ Token",
            "LZPQ",
            lzEndpoint,
            deployer,
            address(verifier),
            PROGRAM_HASH,
            1_000_000 * 10 ** 18
        );

        MockUSD usd = new MockUSD();
        PizzaMerchant merchant = new PizzaMerchant(address(token), 10 * 10 ** 18);
        TinyDex dex = new TinyDex(address(token), address(usd), 1 * 10 ** 18);

        // Add liquidity
        token.approve(address(dex), 100_000 * 10 ** 18);
        usd.approve(address(dex), 100_000 * 10 ** 18);
        dex.addLiquidity(100_000 * 10 ** 18, 100_000 * 10 ** 18);

        vm.stopBroadcast();

        console.log("\n=== Local Deployment ===");
        console.log("Verifier:", address(verifier));
        console.log("Token:", address(token));
        console.log("MockUSD:", address(usd));
        console.log("Merchant:", address(merchant));
        console.log("DEX:", address(dex));
        console.log("========================\n");
    }
}

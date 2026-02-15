// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import { ERC21PQToken } from "../src/ERC21PQToken.sol";
import { HardenedStarkVerifier } from "../src/HardenedStarkVerifier.sol";
import { TokenUpgrader } from "../src/TokenUpgrader.sol";
import { MultiSigPQVault } from "../src/MultiSigPQVault.sol";
import { PQWalletGuardian } from "../src/PQWalletGuardian.sol";
import { BatchZKTransfer } from "../src/BatchZKTransfer.sol";

/// @title DeployEthereum
/// @notice Production deployment script for Ethereum mainnet
/// @dev Deploys hardened ZK-STARK service with full token upgrader infrastructure
///
/// Usage:
///   PRIVATE_KEY=<key> \
///   LZ_ENDPOINT=0x1a44076050125825900e736c501f859c50fE728c \
///   forge script script/DeployEthereum.s.sol:DeployEthereum \
///     --rpc-url $ETH_RPC_URL \
///     --broadcast \
///     --verify \
///     --etherscan-api-key $ETHERSCAN_KEY \
///     -vvvv
contract DeployEthereum is Script {
    // Program hash for HD commitment verification
    bytes32 constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    // Ethereum mainnet LayerZero V2 endpoint
    address constant LZ_ENDPOINT_ETH = 0x1a44076050125825900e736c501f859c50fE728c;

    // Well-known Ethereum mainnet token addresses
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Allow override of LZ endpoint for testnet deploys
        address lzEndpoint = vm.envOr("LZ_ENDPOINT", LZ_ENDPOINT_ETH);

        console.log("=== Ethereum Production Deployment ===");
        console.log("Deployer:", deployer);
        console.log("LZ Endpoint:", lzEndpoint);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // =========================================================
        // Step 1: Deploy Hardened STARK Verifier
        // =========================================================
        HardenedStarkVerifier verifier = new HardenedStarkVerifier(PROGRAM_HASH, deployer);
        console.log("[1/7] HardenedStarkVerifier:", address(verifier));

        // =========================================================
        // Step 2: Deploy ERC-21 PQ Token (the main quantum-resistant token)
        // =========================================================
        uint256 initialSupply = 10_000_000 * 10 ** 18; // 10M tokens
        ERC21PQToken pqToken = new ERC21PQToken(
            "Quantum-Resistant USD",
            "USDPQ",
            lzEndpoint,
            deployer,
            address(verifier),
            PROGRAM_HASH,
            initialSupply
        );
        console.log("[2/7] ERC21PQToken (USDPQ):", address(pqToken));

        // =========================================================
        // Step 3: Deploy Token Upgrader
        // =========================================================
        TokenUpgrader upgrader = new TokenUpgrader(deployer);
        console.log("[3/7] TokenUpgrader:", address(upgrader));

        // Fund the upgrader with PQ tokens so users can upgrade
        uint256 upgraderAllocation = 5_000_000 * 10 ** 18; // 50% for upgrades
        pqToken.transfer(address(upgrader), upgraderAllocation);
        console.log("  -> Funded upgrader with 5M USDPQ");

        // =========================================================
        // Step 4: Deploy Batch ZK Transfer
        // =========================================================
        BatchZKTransfer batchTransfer = new BatchZKTransfer(address(pqToken));
        console.log("[4/7] BatchZKTransfer:", address(batchTransfer));

        // =========================================================
        // Step 5: Deploy PQ Wallet Guardian (social recovery)
        // =========================================================
        PQWalletGuardian guardian = new PQWalletGuardian(
            address(pqToken),
            address(verifier),
            PROGRAM_HASH
        );
        console.log("[5/7] PQWalletGuardian:", address(guardian));

        // =========================================================
        // Step 6: Authorize the PQ token contract to call the verifier
        // =========================================================
        verifier.authorizeCaller(address(pqToken));
        verifier.authorizeCaller(address(guardian));
        console.log("[6/7] Authorized callers on verifier");

        // =========================================================
        // Step 7: Configure token upgrade pairs
        // =========================================================
        // Register USDC -> USDPQ upgrade path
        // Note: In production, you'd register specific well-known tokens
        // For now, we register the pairs that will be available
        console.log("[7/7] Token pair registration ready");
        console.log("  -> Call upgrader.registerTokenPair(USDC, USDPQ) when ready");
        console.log("  -> Call upgrader.registerTokenPair(DAI, USDPQ) when ready");

        vm.stopBroadcast();

        // =========================================================
        // Deployment Summary
        // =========================================================
        console.log("");
        console.log("============================================");
        console.log("  ETHEREUM DEPLOYMENT COMPLETE");
        console.log("============================================");
        console.log("HardenedStarkVerifier:", address(verifier));
        console.log("ERC21PQToken (USDPQ):", address(pqToken));
        console.log("TokenUpgrader:", address(upgrader));
        console.log("BatchZKTransfer:", address(batchTransfer));
        console.log("PQWalletGuardian:", address(guardian));
        console.log("============================================");
        console.log("");
        console.log("POST-DEPLOYMENT CHECKLIST:");
        console.log("  1. Register token pairs on TokenUpgrader");
        console.log("  2. Set upgrade caps per token");
        console.log("  3. Configure LayerZero peers for cross-chain");
        console.log("  4. Enable caller auth on verifier if needed");
        console.log("  5. Verify all contracts on Etherscan");
        console.log("  6. Transfer ownership to multisig");
        console.log("  7. Run integration tests on mainnet fork");
        console.log("============================================");
    }
}

/// @title DeployEthereumSepolia
/// @notice Deployment script for Ethereum Sepolia testnet
/// @dev Use this for testing before mainnet deployment
contract DeployEthereumSepolia is Script {
    bytes32 constant PROGRAM_HASH = keccak256("hd_commitment_v1");

    // Sepolia LayerZero V2 endpoint
    address constant LZ_ENDPOINT_SEPOLIA = 0x6EDCE65403992e310A62460808c4b910D972f10f;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Sepolia Testnet Deployment ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy hardened verifier
        HardenedStarkVerifier verifier = new HardenedStarkVerifier(PROGRAM_HASH, deployer);

        // Deploy token
        ERC21PQToken pqToken = new ERC21PQToken(
            "Quantum-Resistant USD (Testnet)",
            "tUSDPQ",
            LZ_ENDPOINT_SEPOLIA,
            deployer,
            address(verifier),
            PROGRAM_HASH,
            10_000_000 * 10 ** 18
        );

        // Deploy upgrader
        TokenUpgrader upgrader = new TokenUpgrader(deployer);
        pqToken.transfer(address(upgrader), 5_000_000 * 10 ** 18);

        // Deploy batch transfer
        BatchZKTransfer batchTransfer = new BatchZKTransfer(address(pqToken));

        // Deploy guardian
        PQWalletGuardian guardian = new PQWalletGuardian(
            address(pqToken),
            address(verifier),
            PROGRAM_HASH
        );

        // Authorize callers
        verifier.authorizeCaller(address(pqToken));
        verifier.authorizeCaller(address(guardian));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Sepolia Deployment Summary ===");
        console.log("HardenedStarkVerifier:", address(verifier));
        console.log("ERC21PQToken (tUSDPQ):", address(pqToken));
        console.log("TokenUpgrader:", address(upgrader));
        console.log("BatchZKTransfer:", address(batchTransfer));
        console.log("PQWalletGuardian:", address(guardian));
        console.log("==================================");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IStarkVerifier } from "../interfaces/IStarkVerifier.sol";

/// @title MockStarkVerifier
/// @notice Mock STARK verifier for testing
/// @dev Accepts any non-zero proof for testing purposes
contract MockStarkVerifier is IStarkVerifier {
    uint256 constant STARK_PRIME =
        3618502788666131213697322783095070105623107215331596699973092056135872020481;

    bytes32 public expectedProgramHash;

    constructor(bytes32 _programHash) {
        expectedProgramHash = _programHash;
    }

    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs,
        bytes32 programHash
    ) external view override returns (bool valid) {
        // Verify program hash
        require(programHash == expectedProgramHash, "Invalid program hash");

        // Verify inputs
        require(publicInputs.length == 5, "Expected 5 public inputs");

        for (uint256 i = 0; i < publicInputs.length; i++) {
            require(publicInputs[i] < STARK_PRIME, "Input exceeds field");
        }

        // For testing: accept proofs >= 1024 bytes with non-zero first byte
        require(proof.length >= 1024, "Proof too small");

        bool nonZero = false;
        for (uint256 i = 0; i < 32 && i < proof.length; i++) {
            if (proof[i] != 0) {
                nonZero = true;
                break;
            }
        }

        return nonZero;
    }

    function securityBits() external pure override returns (uint256) {
        return 128;
    }
}

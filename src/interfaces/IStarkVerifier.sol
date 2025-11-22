// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStarkVerifier
/// @notice Interface for STARK proof verification (quantum-resistant)
/// @dev STARKs use hash-based cryptography, no trusted setup required
interface IStarkVerifier {
    /// @notice Verifies a STARK proof
    /// @param proof The STARK proof data (FRI commitments, queries, decommitments)
    /// @param publicInputs The public inputs to the computation
    /// @param programHash The hash of the Cairo program being verified
    /// @return valid True if the proof is valid
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs,
        bytes32 programHash
    ) external view returns (bool valid);

    /// @notice Get the security level in bits
    /// @return bits Security level (e.g., 128 for 128-bit security)
    function securityBits() external pure returns (uint256 bits);
}

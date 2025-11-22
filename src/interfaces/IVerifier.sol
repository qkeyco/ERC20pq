// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IVerifier
/// @notice Interface for SNARK proof verification
interface IVerifier {
    /// @notice Verifies a SNARK proof
    /// @param proof The proof data
    /// @param publicInputs The public inputs to the circuit
    /// @return valid True if the proof is valid
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs
    ) external view returns (bool valid);
}

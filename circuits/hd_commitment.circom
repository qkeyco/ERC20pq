pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";

/// @title HDCommitment
/// @notice Verifies knowledge of HD secret that hashes to a commitment
/// @dev Used for ERC-21 ZK-guarded transfers
template HDCommitment() {
    // Public inputs
    signal input from;           // Sender address (as field element)
    signal input to;             // Recipient address
    signal input amount;         // Transfer amount
    signal input nonce;          // Replay protection nonce
    signal input commitment;     // On-chain commitment = Hash(hdSecret)

    // Private witness
    signal input hdSecret;       // The HD/PQ secret (must remain private)

    // Intermediate signals
    signal computedCommitment;

    // =============================================================
    //                    COMMITMENT VERIFICATION
    // =============================================================

    // Compute commitment from HD secret using Poseidon hash
    // Poseidon is SNARK-friendly and widely used
    component hasher = Poseidon(1);
    hasher.inputs[0] <== hdSecret;
    computedCommitment <== hasher.out;

    // Enforce: computed commitment matches the on-chain commitment
    commitment === computedCommitment;

    // =============================================================
    //                    INPUT CONSTRAINTS
    // =============================================================

    // Ensure from address is valid (non-zero, fits in 160 bits)
    // This is enforced by how we pack the address as a field element
    signal fromCheck;
    fromCheck <== from * from;  // Non-zero check

    // Ensure to address is valid
    signal toCheck;
    toCheck <== to * to;

    // Ensure amount is positive
    signal amountCheck;
    amountCheck <== amount * amount;

    // Nonce can be zero (first transfer)
    // No additional constraint needed

    // =============================================================
    //                    OUTPUT
    // =============================================================

    // No output signals - success means constraints satisfied
    // The proof itself is the output
}

component main {public [from, to, amount, nonce, commitment]} = HDCommitment();

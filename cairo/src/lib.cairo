/// HD Commitment Verification Program for ERC-21
///
/// This Cairo program verifies that a user knows the HD secret
/// that corresponds to their on-chain commitment.
///
/// Public Inputs:
/// - from: sender address
/// - to: recipient address
/// - amount: transfer amount
/// - nonce: replay protection
/// - commitment: hash(hdSecret)
///
/// Private Witness:
/// - hdSecret: the secret value

use core::pedersen::pedersen;
use core::poseidon::poseidon_hash_span;

/// Main HD commitment verification
#[derive(Drop, Serde)]
struct HDCommitmentInput {
    // Public inputs
    from: felt252,
    to: felt252,
    amount: felt252,
    nonce: felt252,
    commitment: felt252,
    // Private witness
    hd_secret: felt252,
}

/// Verify HD commitment using Pedersen hash
fn verify_hd_commitment_pedersen(input: HDCommitmentInput) -> bool {
    // Compute commitment from HD secret using Pedersen hash
    // Pedersen is the default hash in Cairo/StarkNet
    let computed_commitment = pedersen(input.hd_secret, 0);

    // Verify commitment matches
    computed_commitment == input.commitment
}

/// Verify HD commitment using Poseidon hash (more efficient)
fn verify_hd_commitment_poseidon(input: HDCommitmentInput) -> bool {
    // Compute commitment using Poseidon (STARK-friendly)
    let mut data = array![input.hd_secret];
    let computed_commitment = poseidon_hash_span(data.span());

    // Verify commitment matches
    computed_commitment == input.commitment
}

/// Main entry point for STARK proof generation
#[executable]
fn main(
    from: felt252,
    to: felt252,
    amount: felt252,
    nonce: felt252,
    commitment: felt252,
    hd_secret: felt252,
) -> Array<felt252> {
    // Create input struct
    let input = HDCommitmentInput {
        from,
        to,
        amount,
        nonce,
        commitment,
        hd_secret,
    };

    // Verify using Poseidon (more efficient for STARKs)
    let is_valid = verify_hd_commitment_poseidon(input);

    // Assert the commitment is valid
    assert(is_valid, 'Invalid HD commitment');

    // Return public outputs
    let mut output = array![];
    output.append(from);
    output.append(to);
    output.append(amount);
    output.append(nonce);
    output.append(commitment);

    output
}

/// Contract interface for on-chain verification
#[starknet::interface]
trait IHDCommitmentVerifier<TContractState> {
    fn verify_commitment(
        self: @TContractState,
        hd_secret: felt252,
        expected_commitment: felt252
    ) -> bool;

    fn compute_commitment(
        self: @TContractState,
        hd_secret: felt252
    ) -> felt252;
}

/// StarkNet contract for HD commitment operations
#[starknet::contract]
mod HDCommitmentVerifier {
    use core::poseidon::poseidon_hash_span;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl HDCommitmentVerifierImpl of super::IHDCommitmentVerifier<ContractState> {
        fn verify_commitment(
            self: @ContractState,
            hd_secret: felt252,
            expected_commitment: felt252
        ) -> bool {
            let mut data = array![hd_secret];
            let computed = poseidon_hash_span(data.span());
            computed == expected_commitment
        }

        fn compute_commitment(
            self: @ContractState,
            hd_secret: felt252
        ) -> felt252 {
            let mut data = array![hd_secret];
            poseidon_hash_span(data.span())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{HDCommitmentInput, verify_hd_commitment_poseidon};
    use core::poseidon::poseidon_hash_span;

    #[test]
    fn test_valid_commitment() {
        // Create a test secret
        let hd_secret: felt252 = 12345;

        // Compute expected commitment
        let mut data = array![hd_secret];
        let commitment = poseidon_hash_span(data.span());

        // Create input
        let input = HDCommitmentInput {
            from: 0x1234,
            to: 0x5678,
            amount: 1000,
            nonce: 0,
            commitment,
            hd_secret,
        };

        // Verify
        assert(verify_hd_commitment_poseidon(input), 'Should be valid');
    }

    #[test]
    fn test_invalid_commitment() {
        let input = HDCommitmentInput {
            from: 0x1234,
            to: 0x5678,
            amount: 1000,
            nonce: 0,
            commitment: 0x9999, // Wrong commitment
            hd_secret: 12345,
        };

        // Should be invalid
        assert(!verify_hd_commitment_poseidon(input), 'Should be invalid');
    }
}

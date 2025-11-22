# Cairo HD Commitment Program

This Cairo program generates STARK proofs for ERC-21 HD commitment verification.

## Prerequisites

Install Scarb (Cairo package manager):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
```

## Build

```bash
cd cairo
scarb build
```

## Test

```bash
scarb test
```

## Generate STARK Proof

To generate a proof, you'll need the Stone prover:

```bash
# Install Stone prover
git clone https://github.com/starkware-libs/stone-prover
cd stone-prover
bazel build //...

# Generate proof
stone-prover prove \
  --program hd_commitment.json \
  --input input.json \
  --output proof.json
```

## Input Format

```json
{
  "from": "0x1234...",
  "to": "0x5678...",
  "amount": "1000000000000000000",
  "nonce": "0",
  "commitment": "0xabcd...",
  "hd_secret": "0x..."
}
```

## Integration

The generated proof can be verified on-chain using the StarkVerifier contract.

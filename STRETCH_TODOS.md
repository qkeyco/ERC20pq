# Stretch Goals - Day 2

## Wrapping Solutions

### WETHPQ - Wrapped ETH with ZK Protection
- [ ] Create wrapper contract that holds ETH
- [ ] Deposit ETH → mint WETHPQ
- [ ] WETHPQ inherits ZK guard protection
- [ ] Withdraw requires ZK proof
- [ ] Your ETH becomes quantum-safe

### USDCPQ - Wrapped USDC
- [ ] Same pattern for existing ERC-20s
- [ ] Wrap any token → get PQ-protected version

## LayerZero ZK Proofs

### Current Issue
- LayerZero messaging uses ECDSA signatures
- Quantum computers can forge these signatures
- Cross-chain transfers currently not quantum-safe

### Solutions to Explore
- [ ] Add STARK proof requirement to cross-chain sends
- [ ] Verify ZK proof on destination chain
- [ ] Custom OApp adapter with proof verification
- [ ] Research: LayerZero DVN (Decentralized Verifier Network) with ZK support

## Priority Order
1. WETHPQ wrapper (highest demo value)
2. LayerZero proof integration
3. USDCPQ wrapper

## Notes
- Wrapping is simpler than upgrading LayerZero
- LayerZero integration may need custom DVN
- Focus on demo-able features first

# ERC20pq - Comprehensive TODO

## Critical - Must Complete

### STARK Verification (BLOCKING)
- [ ] **Implement full STARK verifier** `src/StarkVerifier.sol:122`
  - [ ] Fiat-Shamir transcript for challenge generation
  - [ ] FRI (Fast Reed-Solomon IOP) query verification
  - [ ] Merkle decommitment verification
  - [ ] Constraint polynomial evaluation
  - [ ] AIR (Algebraic Intermediate Representation) checks

### Proof Generation (BLOCKING)
- [ ] **Generate valid STARK proofs in Snap** `snap/src/index.ts`
  - [ ] Implement Cairo program execution trace
  - [ ] Generate FRI commitments
  - [ ] Create valid Merkle proofs
  - [ ] Match verifier expectations

### Hash Function Alignment
- [ ] **Poseidon hash implementation**
  - [ ] Replace keccak256 with Poseidon in Snap commitment
  - [ ] Ensure verifier uses same hash function
  - [ ] STARK-friendly hash for better performance

---

## High Priority - Day 2 Goals

### Wrapping Solutions

#### WETHPQ - Wrapped ETH with ZK Protection
- [ ] Create wrapper contract that holds ETH
- [ ] Deposit ETH → mint WETHPQ
- [ ] WETHPQ inherits ZK guard protection
- [ ] Withdraw requires ZK proof
- [ ] Your ETH becomes quantum-safe

#### USDCPQ - Wrapped USDC
- [ ] Same pattern for existing ERC-20s
- [ ] Wrap any token → get PQ-protected version
- [ ] Generic wrapper factory contract

### LayerZero ZK Proofs
- [ ] Add STARK proof requirement to cross-chain sends
- [ ] Verify ZK proof on destination chain
- [ ] Custom OApp adapter with proof verification
- [ ] Research: LayerZero DVN with ZK support

---

## Medium Priority - Polish

### Deployment & Infrastructure
- [ ] Deploy to public testnet (Base Sepolia recommended)
- [ ] Deploy The Graph subgraph
- [ ] Update dApp contract addresses for production
- [ ] Set up monitoring and logging

### Testing
- [ ] Integration tests with real STARK verification
- [ ] Gas optimization benchmarks
- [ ] Cross-chain transfer tests
- [ ] Fuzz testing for edge cases

### Documentation
- [ ] API documentation for Snap RPC methods
- [ ] User guide for enabling ZK protection
- [ ] Architecture diagrams
- [ ] Security considerations document

---

## Low Priority - Future Enhancements

### Alternative Proof Systems
- [ ] **Groth16 verifier completion** `src/Groth16Verifier.sol:44`
  - [ ] Implement actual pairing check
  - [ ] Only if supporting SNARK alternative

### Performance
- [ ] Proof compression
- [ ] Batch verification
- [ ] Caching optimizations

### UX Improvements
- [ ] Better error messages in dApp
- [ ] Transaction history view
- [ ] Mobile-responsive design
- [ ] Multi-wallet support

---

## Completed

- [x] ERC21PQToken contract with ZK Guard
- [x] Basic STARK verifier structure
- [x] MetaMask Snap with HD secret management
- [x] React dApp with full UI
- [x] PizzaMerchant demo contract
- [x] TinyDex demo contract
- [x] 18 passing tests
- [x] Deployment script
- [x] The Graph schema and mappings

---

## Code Locations

| Item | File | Line |
|------|------|------|
| STARK verifier TODO | `src/StarkVerifier.sol` | 122 |
| Groth16 pairing TODO | `src/Groth16Verifier.sol` | 44 |
| Snap proof generation | `snap/src/index.ts` | - |
| dApp main component | `dapp/src/App.tsx` | - |

---

## Priority Order for Hackathon

1. **STARK verifier** - Core cryptographic integrity
2. **Valid proof generation** - End-to-end functionality
3. **WETHPQ wrapper** - Highest demo value
4. **Testnet deployment** - Public demonstration
5. **LayerZero proofs** - Advanced feature

---

## Notes

- STARKs chosen over SNARKs: hash-based, no trusted setup, quantum-resistant
- Cairo field prime: 2^251 + 17 * 2^192 + 1
- Security target: 128 bits
- FRI folding factor: 4
- Number of FRI queries: 30

---

## Deployment Addresses (Tenderly Fork, Chain 73571)

**RPC URL**: `https://virtual.mainnet.us-west.rpc.tenderly.co/8d34857c-35dd-4e13-b36d-2688a4377b1f`

**Current dApp Configuration:**
- **Token**: `0x9a1766F6CC8d02CC5C9b449958409A8F025b03BC`
- **Merchant**: `0x056cb77995eC5ef2da35CfD02a547058c6D14d84`
- **LZ Endpoint**: `0x1a44076050125825900e736c501f859c50fE728c`

**Deploy Command:**
```bash
PRIVATE_KEY=<key> LZ_ENDPOINT=0x1a44076050125825900e736c501f859c50fE728c \
forge script script/Deploy.s.sol:DeployScript --rpc-url <RPC_URL> --broadcast
```

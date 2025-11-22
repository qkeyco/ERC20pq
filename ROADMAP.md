# PQP Roadmap - Post Quantum Privacy/Pay

## Goal 1: Native Token ✅ DONE
- ERC-21 PQ Token (USDPQ)
- STARK-based ownership lock
- MetaMask Snap for ZK proof generation

## Goal 2: Multi-Chain Demo Wallet
- [x] Ethereum Snap
- [ ] Bitcoin wallet (Taproot + STARK?)
- [ ] Solana wallet

## Goal 3: Synthetic Stablecoin - USDPQ
Deposit any of:
- ETH
- BTC (wrapped)
- SOL (wrapped)
- Other approved collateral

### Mechanism Design Questions
- **Fixed % allocation** vs **Natural balance**?
- **Depeg protection**: If one asset depegs but others don't:
  - Over-collateralization buffer?
  - Automatic rebalancing?
  - Liquidation of risky collateral?
  - Insurance fund?
- Legal compliance: Synthetic = not a security?

### Architecture
```
User deposits ETH/BTC/SOL
         ↓
   Collateral Pool (quantum-safe)
         ↓
   Mint USDPQ (1:1 USD peg)
         ↓
   All transfers require ZK proof
```

## Goal 4: Mainnet Launch + Audit
- [ ] Security audit (ZK circuits, contracts)
- [ ] Formal verification
- [ ] Bug bounty program
- [ ] Gradual rollout with caps

## Goal 5: Quantum-Safe LayerZero
- Replace ECDSA in DVN with STARK proofs
- Cross-chain messages require ZK verification
- Novel contribution to LayerZero ecosystem

## Goal 6: Quantum-Safe DEX
- Support USDPQ trading
- All swaps require ZK proofs
- AMM with quantum-resistant signatures
- On-chain order book option?

---

## Naming
- **PQP** = Post Quantum Privacy/Pay
- **USDPQ** = USD Post Quantum
- Tagline: "Quantum-safe audited primitives"

## Hackathon Focus (Today)
1. Polish USDPQ demo
2. Simulate thief demo
3. Video/presentation

## Tomorrow Stretch
1. WETHPQ wrapper
2. LayerZero proof concept
3. Stablecoin mechanism design

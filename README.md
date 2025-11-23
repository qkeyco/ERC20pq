# ERC-21 PQ: Quantum-Resistant Token Standard

> Securing digital ownership for the post-quantum era

## The Problem

Quantum computers pose an existential threat to blockchain security. Current ECDSA signatures—the foundation of token ownership—can be broken by Shor's algorithm. When quantum computers reach sufficient scale, **trillions in digital assets become vulnerable**.

## Our Solution

ERC-21 PQ introduces the first **quantum-resistant token standard** using STARK zero-knowledge proofs. Every transfer requires cryptographic proof that survives quantum attacks, ensuring ownership security for decades to come.

## Key Features

### 🔐 Quantum-Resistant Proofs
- **STARK-based verification**: No trusted setup, cryptographically secure against quantum attacks
- **On-chain proof verification**: Every transfer validates a quantum-safe signature
- **Backward compatible**: Works with existing wallets via MetaMask Snap

### 🌐 Cross-Chain Architecture
- **LayerZero OFT integration**: Quantum-safe transfers across any EVM chain
- **Multi-chain monitoring**: Unified security across Ethereum, Base, and beyond
- **Atomic cross-chain proofs**: STARK verification travels with your tokens

### 📊 Real-Time Security Monitoring
- **The Graph Protocol indexing**: Instant event tracking across chains
- **Amp SQL analytics**: Query proof failures, detect quantum threats
- **Canary system**: Early warning for proof validation anomalies

### 🎯 Developer Experience
- **MetaMask Snap**: Generate quantum-safe proofs without leaving your browser
- **Terminal UI**: Hacker-friendly interface 
- **Full API**: Build quantum-resistant dApps on solid foundations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ERC-21 PQ Token                         │
├─────────────────────────────────────────────────────────────┤
│  On-Chain (Solidity)          │  Off-Chain (Cairo/TS)       │
│  • Token contract             │  • STARK proof generation   │
│  • Groth16/STARK verifiers    │  • MetaMask Snap            │
│  • LayerZero messaging        │  • React terminal UI        │
└─────────────────────────────────────────────────────────────┘
              │                           │
              ▼                           ▼
     ┌─────────────────┐        ┌──────────────────┐
     │  The Graph      │        │  Graph Protocol  │
     │  Subgraphs      │───────▶│  Amp (SQL)       │
     └─────────────────┘        └──────────────────┘
              │
              ▼
     ┌─────────────────────────────────┐
     │  Quantum Canary Dashboard       │
     │  • Multi-chain monitoring       │
     │  • Proof failure analytics      │
     │  • Cross-chain security metrics │
     └─────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Contracts** | Solidity 0.8.28, Foundry | ERC-21 token implementation |
| **ZK Proofs** | Cairo, STARK | Quantum-resistant signatures |
| **Cross-Chain** | LayerZero V2 | Omnichain token transfers |
| **Indexing** | The Graph, Amp | Event monitoring & SQL analytics |
| **Frontend** | React, Vite, Tailwind | Terminal-themed UI |
| **Wallet** | MetaMask Snap | Browser-based proof generation |

## Real-World Impact

### Today
- **Developers**: Deploy quantum-safe tokens on any EVM chain
- **Users**: Protect high-value assets from future quantum threats
- **Protocols**: Upgrade critical infrastructure before it's too late

### Tomorrow
- **Standard migration path**: ERC-20 → ERC-21 PQ wrapper contracts
- **Institutional adoption**: Post-quantum security for treasury management
- **Regulatory compliance**: Meet emerging quantum-safety requirements


## Security Model

1. **Proof Generation**: User generates STARK proof of signature validity
2. **On-Chain Verification**: Contract validates proof before transfer
3. **Failure Logging**: Failed proofs emit events for monitoring
4. **Cross-Chain Sync**: LayerZero ensures proof validation across chains
5. **Analytics Layer**: The Graph + Amp provide SQL queryable security metrics

## Why STARK?

- ✅ No trusted setup required
- ✅ Quantum-resistant hash functions (Poseidon)
- ✅ Transparent and verifiable
- ✅ Efficient recursive composition
- ✅ Battle-tested in production (StarkNet)

```

All core functionality tested:
- ✅ Quantum-safe transfers with valid proofs
- ✅ Rejection of invalid/replayed proofs
- ✅ Cross-chain messaging and proof validation
- ✅ Nonce management and replay protection
- ✅ Emergency fallback mechanisms

## Future Roadmap

- [ ] ERC-20 wrapper contracts (upgrade existing tokens)
- [ ] Multi-sig quantum-safe vaults
- [ ] Hardware wallet integration
- [ ] Mainnet deployment (Ethereum, Base, Arbitrum)
- [ ] Governance token transition to ERC-21 PQ

## Why This Matters

The quantum threat isn't hypothetical. Google's Willow chip demonstrates rapid progress toward cryptographically-relevant quantum computers. **The time to act is now, before quantum computers break ECDSA.**

ERC-21 PQ provides a migration path that protects value today while ensuring security tomorrow.


## Built With

- The Graph Protocol (Indexing & Amp SQL)
- LayerZero (Cross-chain messaging)
- StarkWare (STARK proof system)
- MetaMask (Snap platform)
- Foundry (Smart contract framework)

---

**Status**: Hackathon Demo | **Network**: Tenderly Fork (Base) | **Version**: 0.1.0

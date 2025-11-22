# ERC20pq Quantum Canary - Tomorrow's Tasks

**Date:** 2025-01-22
**Status:** Quantum Canary dashboard is LIVE and working! 🎉

---

## ✅ What's Working Right Now

### Frontend (Vercel)
- **URL:** https://your-vercel-app.vercel.app
- **Terminal Interface:** Retro 80s theme with CRT effects ✅
- **Commands Working:**
  - `test subgraph` - Connects to Digital Ocean subgraph ✅
  - `show zk` - Shows 8 ZK transfers ✅
  - `show zk 24` - Shows ZK transfers in last 24h ✅
  - `stats` - Global statistics (8 ZK, 10 regular transfers) ✅
  - `status` - Network info ✅
  - `proofs failed` - Shows 0 (waiting for contract update) ⚠️

### Subgraph (Digital Ocean)
- **Endpoint:** http://157.245.7.229:8000/subgraphs/name/qcanary
- **Network:** Tenderly Ethereum Fork (Chain ID: 73571)
- **Indexing:** Transfer events ✅, ZKTransfer events ✅
- **Stats:** 8 ZK transfers, 10 regular transfers tracked

### Contract (Tenderly)
- **Address:** [Your Tenderly contract address]
- **Events Emitted:**
  - `Transfer` ✅
  - `ZKTransfer` ✅
  - `ZKProofFailed` ❌ (NOT YET - needs contract update)

---

## 🎯 Priority 1: Update Contract for Failure Tracking

### Why?
Right now, failed ZK proofs revert without emitting events. The Graph can't track them. We need to emit an event BEFORE the revert.

### Contract Changes Needed

**File:** `src/ERC21PQToken.sol`

**1. Add Event Definition** (near other events):
```solidity
event ZKProofFailed(
    address indexed from,
    address indexed to,
    uint256 amount
);
```

**2. Update `transferZK` Function:**

**BEFORE:**
```solidity
function transferZK(
    address to,
    uint256 amount,
    uint256 nonce,
    bytes calldata proof
) external {
    // ... existing code ...

    if (!verifyProof(...)) {
        revert InvalidProof();  // ❌ No event emitted
    }

    // ... rest of function ...
}
```

**AFTER:**
```solidity
function transferZK(
    address to,
    uint256 amount,
    uint256 nonce,
    bytes calldata proof
) external {
    // ... existing code ...

    if (!verifyProof(...)) {
        emit ZKProofFailed(msg.sender, to, amount);  // ✅ ADD THIS LINE
        revert InvalidProof();
    }

    // ... rest of function ...
}
```

### Deployment Steps

**1. Test Locally:**
```bash
forge test -vv
```

**2. Deploy to Tenderly:**
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://virtual.mainnet.us-west.rpc.tenderly.co/8d34857c-35dd-4e13-b36d-2688a4377b1f \
  --broadcast
```

**3. Get New Contract Address & Block:**
- Note the deployed address from output
- Note the block number

**4. Update Subgraph:**

Edit `thegraphfiles/subgraph.yaml`:
```yaml
source:
  address: 'NEW_CONTRACT_ADDRESS_HERE'
  startBlock: NEW_BLOCK_NUMBER_HERE
```

Uncomment the ZKProofFailed handler:
```yaml
eventHandlers:
  # ... existing handlers ...
  - event: ZKProofFailed(indexed address,indexed address,uint256)
    handler: handleZKProofFailed
```

**5. Update Subgraph Mapping:**

Edit `thegraphfiles/src/mapping.ts` - uncomment the import and function:
```typescript
// Uncomment this:
import {
  Transfer as TransferEvent,
  ZKTransfer as ZKTransferEvent,
  ZKProofFailed as ZKProofFailedEvent  // ✅ Uncomment
} from "../generated/ERC21PQToken/ERC21PQToken"

// Uncomment the entire handleZKProofFailed function
```

**6. Redeploy Subgraph:**
```bash
# On Digital Ocean
cd ~/your-subgraph-directory
graph codegen
graph build
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 qcanary
```

**7. Test:**
```
proofs failed
```
Should now show real failed proofs when they occur!

---

## 🎯 Priority 2: Deploy to Base Network

### Why?
Base has real tokens you can trade live. Tenderly is just for testing.

### What You Need
- Base RPC URL
- Some Base ETH for gas
- Private key with Base ETH

### Deployment Steps

**1. Deploy Contract to Base:**
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify
```

**2. Note Contract Details:**
- Contract address on Base: __________________
- Deployment block: __________________

**3. Configure Graph Node for Base:**

Find your Graph Node config:
```bash
# On Digital Ocean
find ~ -name "docker-compose.yml"
```

Add Base to ethereum networks:
```yaml
ethereum: 'mainnet:https://eth-rpc...,base:https://mainnet.base.org'
```

Restart Graph Node:
```bash
docker-compose restart graph-node
```

**4. Deploy Base Subgraph:**

Update `thegraphfiles/subgraph-base.yaml`:
```yaml
source:
  address: 'BASE_CONTRACT_ADDRESS'
  startBlock: BASE_DEPLOYMENT_BLOCK
```

Deploy:
```bash
cd ~/your-subgraph-directory
graph create --node http://localhost:8020/ qcanary-base
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 qcanary-base subgraph-base.yaml
```

**5. Configure LayerZero Peers:**

On Tenderly contract, set Base as peer:
```solidity
// Tenderly contract
setPeer(BASE_CHAIN_ID, BASE_CONTRACT_ADDRESS_IN_BYTES32)
```

On Base contract, set Tenderly as peer:
```solidity
// Base contract
setPeer(TENDERLY_CHAIN_ID, TENDERLY_CONTRACT_ADDRESS_IN_BYTES32)
```

---

## 🎯 Priority 3: Add Network Switcher to Frontend

### Files to Update

**1. Create Network Config:**

Create `quantum-canary/lib/networks.ts`:
```typescript
export const networks = {
  tenderly: {
    name: 'Tenderly ETH',
    chainId: 73571,
    subgraphUrl: 'http://157.245.7.229:8000/subgraphs/name/qcanary',
    rpc: 'https://virtual.mainnet.us-west.rpc.tenderly.co/...',
  },
  base: {
    name: 'Base',
    chainId: 8453,
    subgraphUrl: 'http://157.245.7.229:8000/subgraphs/name/qcanary-base',
    rpc: 'https://mainnet.base.org',
  },
};
```

**2. Add Network Context:**

Create `quantum-canary/contexts/NetworkContext.tsx`:
```typescript
'use client';
import { createContext, useContext, useState } from 'react';
import { networks } from '@/lib/networks';

type NetworkType = keyof typeof networks;

const NetworkContext = createContext<{
  network: NetworkType;
  setNetwork: (n: NetworkType) => void;
  currentConfig: typeof networks.tenderly;
}>({
  network: 'tenderly',
  setNetwork: () => {},
  currentConfig: networks.tenderly,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetwork] = useState<NetworkType>('tenderly');

  return (
    <NetworkContext.Provider value={{
      network,
      setNetwork,
      currentConfig: networks[network],
    }}>
      {children}
    </NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
```

**3. Update Apollo Client to Use Network Context:**

Update `quantum-canary/lib/apollo.ts` to use dynamic URL based on selected network.

**4. Add "chain switch" Command:**

Update `quantum-canary/lib/commands.ts`:
```typescript
'chain switch': async () => {
  // Toggle between networks
  // Implementation depends on how you manage state
  return {
    status: 'success',
    message: 'Network switched! (implement with React context)',
  };
},
```

---

## 📋 Quick Reference

### Important URLs
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Digital Ocean:** https://cloud.digitalocean.com
- **Tenderly Dashboard:** https://dashboard.tenderly.co
- **Quantum Canary (local):** http://localhost:3000
- **Quantum Canary (prod):** [Your Vercel URL]
- **Subgraph GraphiQL (Tenderly):** http://157.245.7.229:8000/subgraphs/name/qcanary/graphql

### Important Commands

**Frontend (local):**
```bash
cd /mnt/c/hackathon/New\ folder\ \(2\)/ERC20pq/webgraph/quantum-canary
npm run dev
```

**Deploy Frontend:**
```bash
git add .
git commit -m "Your message"
git push  # Vercel auto-deploys
```

**Subgraph (Digital Ocean):**
```bash
ssh user@157.245.7.229
cd ~/your-subgraph-directory
graph codegen
graph build
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 qcanary
```

**Test Subgraph:**
```bash
curl http://localhost:8000/subgraphs/name/qcanary \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ zktransfers(first: 5) { id from to amount } }"}'
```

### Terminal Commands
```
help              - Show all commands
test subgraph     - Test connection
show zk           - Show all ZK transfers
show zk 24        - Show last 24 hours
stats             - Global statistics
proofs failed     - Show failed proofs (after contract update)
status            - Network info
clear             - Clear terminal
```

---

## 🐛 Known Issues & Solutions

### Issue: "show zk" shows 0 without time parameter
**Solution:** Fixed! Always provide timestamp_gt (defaults to "0" for all time)

### Issue: Timestamp shows 1970
**Solution:** Fixed! Multiply by 1000 (blockchain uses seconds, JS uses milliseconds)

### Issue: GraphQL field names case-sensitive
**Solution:** Fixed! Use lowercase: `zktransfers`, `zkstats`, `zkproofFaileds`

### Issue: Failed proofs not tracked
**Solution:** Pending - Update contract to emit ZKProofFailed event before revert

---

## 📊 Current Data (as of tonight)

**Tenderly Subgraph:**
- Total ZK Transfers: 8
- Total Regular Transfers: 10
- Total Failed Proofs: 0 (not tracked yet)
- Subgraph Status: Synced and working ✅

**From/To Addresses (top sender):**
- Main sender: `0xd32e40436e4f6c892918c6a19af75bf997cde0f9`
- Recipients: Multiple addresses
- Amounts: 10 ETH and 100k tokens

---

## 🎯 Success Metrics for Tomorrow

- [ ] Contract updated with ZKProofFailed event
- [ ] Contract redeployed to Tenderly
- [ ] Subgraph tracking failed proofs
- [ ] `proofs failed` command shows real data
- [ ] Contract deployed to Base
- [ ] Base subgraph running
- [ ] Network switcher in frontend
- [ ] Can demo ZK protection working (theft fails!)

---

## 💡 Demo Script for Hackathon

**Story:** "Quantum computers will break current crypto. We're ready."

**Demo Flow:**
1. Show terminal - retro 80s vibe
2. `stats` - Show live ZK transfers
3. `show zk` - Show quantum-resistant transfers
4. Attempt theft demo (without ZK proof) → FAILS
5. `proofs failed` - Show the failed attack
6. Legitimate transfer (with ZK proof) → SUCCEEDS
7. `show zk` - See it appear in real-time
8. Switch networks → Base (real tokens!)

---

## 🔗 Useful Links

- **Contract Update Guide:** `thegraphfiles/CONTRACT_UPDATE.md`
- **Deployment Guide:** `thegraphfiles/DEPLOYMENT.md`
- **Ready to Deploy Status:** `quantum-canary/READY_TO_DEPLOY.md`
- **The Graph Docs:** https://thegraph.com/docs/
- **LayerZero Docs:** https://layerzero.gitbook.io/

---

## 🚀 You're Almost There!

Everything is working! Just need to:
1. Add failure tracking (contract update)
2. Deploy to Base (real network)
3. Polish the demo

**The hard part is done.** Tomorrow is polish and deployment! 🎉

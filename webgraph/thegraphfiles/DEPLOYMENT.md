# Subgraph Deployment Guide

## Overview
The updated subgraph now tracks BOTH:
- `Transfer` events (standard ERC20, baseline tracking)
- `ZKTransfer` events (quantum-resistant transfers with ZK proof verification)

## Before Deploying

### 1. Get Your Contract Details from Tenderly
You need two pieces of information:
- **Contract Address**: The deployed ERC21PQToken address on Tenderly
- **Start Block**: The block number where the contract was deployed

### 2. Update subgraph.yaml
Edit `subgraph.yaml` and replace the TODOs:

```yaml
source:
  address: '0xYOUR_CONTRACT_ADDRESS_HERE'  # Replace this
  startBlock: YOUR_START_BLOCK_HERE         # Replace this
```

## Deployment Steps

### On Your Digital Ocean Server

1. **SSH into your server:**
   ```bash
   ssh user@157.245.7.229
   ```

2. **Navigate to subgraph directory:**
   ```bash
   cd /path/to/your/subgraph
   ```

3. **Copy updated files:**
   Upload these files from `thegraphfiles/`:
   - `schema.graphql` (replaces existing)
   - `subgraph.yaml` (replaces existing)
   - `src/mapping.ts` (replaces existing)
   - `abiERC21PQToken.json` (already there)

4. **Install dependencies (if needed):**
   ```bash
   npm install
   ```

5. **Generate types:**
   ```bash
   graph codegen
   ```

6. **Build the subgraph:**
   ```bash
   graph build
   ```

7. **Deploy locally:**
   ```bash
   graph create --node http://localhost:8020/ ethereum-basic-event-handlers
   graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 ethereum-basic-event-handlers
   ```

## Testing

### From the Quantum Canary frontend:

1. **Test connection:**
   ```
   test subgraph
   ```
   Should show: "✓ Subgraph connected!"

2. **View ZK transfers:**
   ```
   show zk
   ```

3. **View statistics:**
   ```
   stats
   ```

## Schema Changes

### New Entities:
- **ZKTransfer**: Tracks successful quantum-resistant transfers
  - Always has `success: true` (failures revert and don't emit events)
  - Includes: from, to, amount, nonce, timestamp, blockNumber, transactionHash

- **ZKStats**: Global statistics singleton
  - Tracks totalZKTransfers and totalTransfers
  - Auto-updates on each transfer

### Preserved Entities:
- **Transfer**: Original ERC20 Transfer tracking (unchanged)

## Important Notes

1. **Failed ZK Proofs**: The contract reverts on failed proofs without emitting events. The Graph cannot index reverted transactions. Only successful ZK transfers are tracked.

2. **For Demo Purposes**: If you need to show "failed proofs" in the frontend, you have options:
   - Use simulated/demo data
   - Query Tenderly API for reverted transactions
   - Modify contract to emit event before revert (requires redeployment)

3. **Backwards Compatible**: Old Transfer queries still work. The new ZKTransfer tracking runs alongside.

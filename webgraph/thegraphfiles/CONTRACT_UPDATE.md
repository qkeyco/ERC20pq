# Contract Update Guide - Add ZKProofFailed Event

## Overview
To enable failed proof tracking in The Graph, you need to add a `ZKProofFailed` event to your ERC21PQToken contract and emit it **before** the revert happens.

## Current Contract Issue
Right now, when a ZK proof fails, the contract reverts:
```solidity
if (!verifyProof(...)) {
    revert InvalidProof();  // Transaction fails - no events emitted
}
```

The Graph cannot index reverted transactions, so failures are invisible.

## Solution: Emit Event Before Revert

### 1. Add the Event Definition
Add this event near your other event definitions in the contract:

```solidity
// Add this with your other events
event ZKProofFailed(
    address indexed from,
    address indexed to,
    uint256 amount
);
```

### 2. Update the transferZK Function
Find your `transferZK` function and modify the proof verification section:

**Before:**
```solidity
function transferZK(
    address to,
    uint256 amount,
    uint256 nonce,
    bytes calldata proof
) external {
    // ... existing code ...

    if (!verifyProof(...)) {
        revert InvalidProof();
    }

    // ... rest of function ...
}
```

**After:**
```solidity
function transferZK(
    address to,
    uint256 amount,
    uint256 nonce,
    bytes calldata proof
) external {
    // ... existing code ...

    if (!verifyProof(...)) {
        emit ZKProofFailed(msg.sender, to, amount);  // ← ADD THIS LINE
        revert InvalidProof();
    }

    // ... rest of function ...
}
```

## Important Notes

1. **Event MUST be emitted before revert** - Events in reverted transactions are not indexed
2. **Only add the event emission** - Don't change any other logic
3. **The subgraph is already configured** - Once you redeploy with this change, The Graph will automatically start tracking failures

## Deployment Steps

1. Make the contract changes above
2. Test locally with Foundry:
   ```bash
   forge test -v
   ```
3. Redeploy to Tenderly:
   ```bash
   forge script script/Deploy.s.sol --rpc-url <TENDERLY_RPC> --broadcast
   ```
4. Update `subgraph.yaml` with new contract address and deployment block
5. Redeploy subgraph (see DEPLOYMENT.md)
6. The frontend will automatically start showing failed proofs!

## What Happens After Update

Once deployed:
- ✅ Successful ZK transfers emit `ZKTransfer` event (already working)
- ✅ Failed ZK proofs emit `ZKProofFailed` event (new!)
- ✅ The Graph indexes both
- ✅ Frontend `proofs failed` command shows real data
- ✅ Alert system triggers on threshold exceeded

## Example Event Flow

**Successful Transfer:**
1. User calls `transferZK()` with valid proof
2. Proof verifies ✓
3. `ZKTransfer` event emitted
4. Transfer completes
5. The Graph indexes success

**Failed Transfer:**
1. User calls `transferZK()` with invalid proof
2. Proof verification fails ✗
3. `ZKProofFailed` event emitted ← **NEW**
4. Transaction reverts with `InvalidProof`
5. The Graph indexes the failure ← **NEW**
6. User transaction fails, no tokens moved

## Testing the Change

After redeploying:

1. **In your frontend terminal:**
   ```
   proofs failed
   ```
   Should show: "✓ No failed proofs in 24h" (with no warning message)

2. **Trigger a failed proof** (send invalid proof):
   ```
   proofs failed
   ```
   Should now show the failed attempt!

3. **Check stats:**
   ```
   stats
   ```
   Should show non-zero `Total ZK Failures` when failures occur

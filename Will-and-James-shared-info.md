# ERC-21 PQ Token - Graph Integration Info

Shared configuration for Will's Graph AMP setup.

## Network Configuration

### Tenderly Base (Primary Demo Network)
- **Chain ID**: 8462 (0x210E)
- **RPC URL**: `https://virtual.base.eu.rpc.tenderly.co/18d3110d-0934-4f12-b889-58fa6fa45d72`
- **Block Explorer**: Tenderly Dashboard

**Deployed Contracts:**
- Token: `0x7F56E701a5E3cB764Aaf4C0605699dB517F4Fce8`
- Merchant: `0x9aA36e49a11a4832B57C954c605692327b2DDd4f`
- Verifier: `0x715F0Ac0DeB4c92874C818cD70B348073c93c322`
- DEX: `0x1E72A76a28649fb2c97863807928E900F2B2B938`

### Tenderly Ethereum (Secondary)
- **Chain ID**: 73571 (0x11F63)
- **RPC URL**: `https://virtual.mainnet.us-west.rpc.tenderly.co/8d34857c-35dd-4e13-b36d-2688a4377b1f`

**Deployed Contracts:**
- Token: `0x9a1766F6CC8d02CC5C9b449958409A8F025b03BC`
- Merchant: `0x056cb77995eC5ef2da35CfD02a547058c6D14d84`

---

## ABI Location

Full ABI: `out/ERC21PQToken.sol/ERC21PQToken.json`

Subgraph ABI: `subgraph/abis/ERC21PQToken.json`

---

## Events to Index

### Core Events

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
event HDCommitmentBound(address indexed account, bytes32 commitment);
event ZKGuardEnabled(address indexed account);
event ZKGuardDisabled(address indexed account);
event ZKTransfer(address indexed from, address indexed to, uint256 amount, uint256 nonce);
event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason);
event ZKProofFailed(address indexed from, address indexed to, uint256 amount, string reason);
event ZKDisableFailed(address indexed account, string reason);
```

### Key Events for Demo

1. **ZKTransfer** - Successful ZK-verified transfers (Alice pays for pizza)
2. **TransferBlocked** - Failed theft attempts (Will tries to steal)
3. **ZKGuardEnabled** - User enables quantum protection
4. **HDCommitmentBound** - User sets up HD commitment

---

## Subgraph Schema

```graphql
type Account @entity {
  id: Bytes!
  balance: BigInt!
  hdCommitment: Bytes
  zkGuardEnabled: Boolean!
  zkNonce: BigInt!
}

type ZKTransfer @entity(immutable: true) {
  id: Bytes!
  from: Account!
  to: Account!
  amount: BigInt!
  nonce: BigInt!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type TransferBlocked @entity(immutable: true) {
  id: Bytes!
  from: Account!
  to: Account!
  amount: BigInt!
  reason: String!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}

type TokenStats @entity {
  id: ID!
  totalSupply: BigInt!
  totalTransfers: BigInt!
  totalZKTransfers: BigInt!
  totalGuardedAccounts: BigInt!
  totalBlockedAttempts: BigInt!
}
```

---

## Example Queries

### Get blocked theft attempts
```graphql
{
  transferBlockeds(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    from { id }
    to { id }
    amount
    reason
    transactionHash
    blockTimestamp
  }
}
```

### Get ZK transfers
```graphql
{
  zkTransfers(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    from { id }
    to { id }
    amount
    nonce
    transactionHash
  }
}
```

### Get token stats
```graphql
{
  tokenStats(id: "token-stats") {
    totalSupply
    totalZKTransfers
    totalBlockedAttempts
    totalGuardedAccounts
  }
}
```

### Get guarded accounts
```graphql
{
  accounts(where: { zkGuardEnabled: true }) {
    id
    balance
    zkNonce
  }
}
```

---

## Demo Flow for Graph AMP

1. **Alice sets up protection** → `HDCommitmentBound` + `ZKGuardEnabled`
2. **Alice pays for pizza** → `ZKTransfer` (with nonce)
3. **Will steals key and tries transfer** → `TransferBlocked` (reason: "ZK guard enabled")
4. **Stats update** → `totalBlockedAttempts` increments

---

## Contact

- James: Working on dApp + Snap + Contracts
- Will: Working on Graph AMP integration

Demo URL: `http://localhost:3000` (or deployed Vercel URL)

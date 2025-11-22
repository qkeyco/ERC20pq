# ERC-21 PQ Snap

MetaMask Snap for ERC-21 ZK-guarded transfers with STARK proofs (quantum-resistant).

## Features

- **ethvaultpq_bindHD** - Bind HD commitment to token contract
- **ethvaultpq_enableZKGuard** - Enable quantum lock
- **ethvaultpq_disableZKGuard** - Disable quantum lock (requires STARK proof)
- **ethvaultpq_transferZK** - Transfer with STARK proof
- **ethvaultpq_getInfo** - Get account info

## Local Development (Port 8080)

### Prerequisites

- Node.js >= 18.6.0
- Yarn
- MetaMask Flask (for Snap testing)

### Install Dependencies

```bash
cd snap
yarn install
```

### Build

```bash
yarn build
```

### Start Development Server (Port 8080)

```bash
yarn start
```

This will serve the Snap at `http://localhost:8080`.

### Connect to MetaMask Flask

1. Install [MetaMask Flask](https://metamask.io/flask/)
2. Open your dapp or browser console
3. Connect to the local Snap:

```javascript
await ethereum.request({
  method: 'wallet_requestSnaps',
  params: {
    'local:http://localhost:8080': {},
  },
});
```

## Publish to npm (for production)

### Prerequisites

- npm account with publish access
- Authenticated: `npm login`

### Publish

```bash
# Build first
yarn build

# Update version if needed
npm version patch

# Publish to npm
npm publish --access public
```

### Install from npm

Once published, users can install with:

```javascript
await ethereum.request({
  method: 'wallet_requestSnaps',
  params: {
    'npm:@erc21pq/snap': {},
  },
});
```

## Usage Example

```javascript
// Connect Snap
const snapId = 'local:http://localhost:8080';

// Bind HD commitment
await ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: {
      method: 'ethvaultpq_bindHD',
      params: { tokenAddress: '0x...' },
    },
  },
});

// Enable ZK guard
await ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: {
      method: 'ethvaultpq_enableZKGuard',
      params: { tokenAddress: '0x...' },
    },
  },
});

// Transfer with STARK proof
await ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: {
      method: 'ethvaultpq_transferZK',
      params: {
        tokenAddress: '0x...',
        to: '0x...',
        amount: '100',
      },
    },
  },
});

// Disable ZK guard (requires proof)
await ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: {
      method: 'ethvaultpq_disableZKGuard',
      params: { tokenAddress: '0x...' },
    },
  },
});
```

## Security

- HD secret is stored securely in Snap state
- STARK proofs are quantum-resistant (no elliptic curves)
- No trusted setup required
- Proofs are 1024 bytes (larger than SNARKs but more secure)

## License

MIT

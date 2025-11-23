# Claude Code Rules for ERC20pq

## Project Guidelines

### Commits
- **Make regular commits as you go** - This is required by hackathon rules
- Commit after completing each significant feature or milestone
- Use descriptive commit messages that explain what was added/changed

### Development Workflow
1. Complete a feature or significant change
2. Run tests: `forge test`
3. Commit with descriptive message
4. Continue to next feature

### Tech Stack
- **Smart Contracts**: Foundry, Solidity 0.8.28
- **ZK Proofs**: STARKs (quantum-resistant, no trusted setup)
- **Cross-chain**: LayerZero OFT
- **Frontend**: React + Vite + Tailwind
- **Snap**: MetaMask Snap for ZK proof generation
- **Indexing**: The Graph

### Key Integrations
- LayerZero (cross-chain)
- The Graph (event indexing)
- Protocol Labs (IPFS/Filecoin ready)

### Testing
- Run all tests: `forge test -v`
- Target: All tests passing before commits

### Deployment
- Local: `forge script script/Deploy.s.sol:DeployLocal --broadcast`
- Testnet: `forge script script/Deploy.s.sol:DeployScript --rpc-url <RPC_URL> --broadcast`
- **Private Key**: Use Anvil default key for Tenderly deployments:
  ```bash
  export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
  ```

### Network Configuration
- **Network**: Tenderly Fork of Base Mainnet
- **Chain ID**: 8453
- **RPC URL**: https://virtual.base.us-west.rpc.tenderly.co/faa3abed-5400-4dc8-87ec-6091314a56cf
- **Admin RPC**: https://virtual.base.us-west.rpc.tenderly.co/2d65fb3a-1263-493d-bd81-9c4b76763a73
- **LayerZero Endpoint**: 0x1a44076050125825900e736c501f859c50fE728c (Base V2)

### Deployed Contracts (Tenderly Base)
- **Token**: 0xfa59549200102B7d50E9E8de3989DF40DEb55deC
- **Merchant**: 0xA335539253B9F81CA57A3940F59635A3b1EEEb24
- **Verifier**: 0xF937ED3f883065Cd982c22030D62C0C293718035
- **DEX**: 0x7485df74312d9b444aC4E004cAC4Ccd48b6f9cF3
- **MockUSD**: 0x88aa4F7840F7F3560872825DccD38AAC079CFf3d

### Snap Deployment
- Local development: `cd snap && yarn build && yarn start` (serves on port 8080)
- NPM publish: `cd snap && npm publish` (for MetaMask Flask)

### Server Management
- **IMPORTANT**: Do not spawn multiple dev servers. Manage existing ones.
- **Standard Ports**:
  - dApp: **port 3000** (`cd dapp && npm run dev`)
  - Snap: **port 8080** (`cd snap && yarn start`)
- Before starting a server, check if it's already running
- Kill unused servers: `lsof -ti:3000 | xargs kill -9`
- Demo page route: `http://localhost:3000/#/demo`

### Project Structure
```
ERC20pq/
├── src/           # Solidity contracts
├── test/          # Foundry tests
├── script/        # Deployment scripts
├── circuits/      # Cairo programs for STARK proofs
├── snap/          # MetaMask Snap (port 8080)
├── dapp/          # React frontend
└── subgraph/      # The Graph subgraph
```

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

### Network Configuration
- **Network**: Tenderly Fork of Ethereum Mainnet
- **Chain ID**: 73571
- **LayerZero Endpoint**: Use appropriate endpoint for Tenderly fork

### Snap Deployment
- Local development: `cd snap && yarn build && yarn start` (serves on port 8080)
- NPM publish: `cd snap && npm publish` (for MetaMask Flask)

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

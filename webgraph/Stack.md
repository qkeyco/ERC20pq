# Quantum Canary Stack (Updated)

## Overview
Monorepo Next.js app, Vercel deploy. Green 80s terminal theme (VT323 font, #00ff00 text, black bg, CRT CSS). Layout: Flex (lg:flex-row) - left 2/3 Xterm, right 1/3 sidebar (outputs, animations, extinguisher). No cookies. Subgraph: Test on Tenderly, migrate plan below.

## Core Dependencies
- next@14.x
- xterm@5.x + xterm-addon-fit@0.x (Terminal + resize)
- @apollo/client@3.x + graphql@16.x (Subgraph queries)
- react-spring@9.x (Sidebar animations)
- tailwindcss@3.x (Styling: flex, CRT effects)

## Dev Dependencies
- typescript@5.x
- eslint@8.x + prettier@3.x

## Project Structure
- /monorepo/
  - /frontend/ (Quantum Canary site)
    - /app/ (page.tsx: main layout)
    - /components/ (Terminal.tsx, Sidebar.tsx, WizardPrompt.tsx, AlertExtinguisher.tsx)
    - /lib/ (graphql.ts, commands.ts: { 'show zk': handler }, mockData.ts)
    - /public/ (fonts/vt323.woff, assets/green-logo.png)
    - /styles/ (globals.css: .terminal { color: #00ff00; text-shadow: 0 0 5px #00ff00; } .monitor { border: 5px solid #ccc; box-shadow: 0 0 20px #ffcc00; })
  - /subgraph/ (If building: schema.graphql, subgraph.yaml)

## Subgraph Setup Steps
1. Install graph-cli: npm i -g @graphprotocol/graph-cli
2. Init: graph init --product hosted-service yourusername/quantum-canary
3. Define schema.graphql: entities like Proof { id: ID!, success: Boolean!, timestamp: BigInt!, chainId: BigInt! }
4. Mapping.ts: Handle ProofAttempted event (assemblyscript).
5. YAML: dataSources.network: 'mainnet' (start as 'tenderly' custom RPC: your URL), abi from contract.
6. Deploy: graph deploy --node https://api.thegraph.com/deploy/ yourusername/quantum-canary
7. Queries: e.g., { proofs(first: 100, where: { success: false }) { timestamp } } – Count fails, alert if > $THRESHOLD in 24h.
Migration: Edit YAML network to 'mainnet', RPC to public, redeploy. Update frontend .env SUBGRAPH_URL.

## Integration Snippets
- GraphQL: client.query({ query: gql`{ proofs(where: { timestamp_gt: ${now - hours*3600} }) { success, timestamp, chainId } }` })
- Commands: In Terminal.tsx: term.onData(data => parseCommand(data, updateSidebar))
- Sidebar: Use react-spring for fade-in on data update.
- Alert: if (fails.length > process.env.ALERT_THRESHOLD) show red box with ASCII extinguisher.
- Migration: In vercel env, swap SUBGRAPH_URL; add chain config for mainnet.

## Build Steps
1. yarn create next-app frontend --typescript
2. yarn add <deps>
3. Add Xterm to page: <div className="flex"><Terminal className="w-2/3" /><Sidebar className="w-1/3" /></div>
4. vercel

Footer: "ETHGlobal BA Demo – No data stored."
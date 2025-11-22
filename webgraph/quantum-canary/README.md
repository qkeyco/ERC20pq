# Quantum Canary Dashboard

Real-time monitoring dashboard for the ERC-21 quantum-resistant token protocol. Built for ETHGlobal Buenos Aires hackathon.

## Features

- **Retro 80s Terminal UI** - Green VT323 font, CRT monitor effects, scanlines
- **Real-time Subgraph Monitoring** - Connected to The Graph on Digital Ocean
- **Interactive CLI** - Xterm.js powered terminal with command interface
- **Live Status Display** - Sidebar with ✓/✗ indicators for command results
- **Network Switching Ready** - Easy migration from Tenderly to mainnet

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Xterm.js (terminal emulation)
- Apollo Client (GraphQL/subgraph queries)
- React Spring (animations)
- Tailwind CSS (styling)

## Getting Started

### Install Dependencies

```bash
npm install
```

### Environment Variables

Copy `.env.local` and update if needed:

```env
NEXT_PUBLIC_SUBGRAPH_URL=http://157.245.7.229:8000/subgraphs/name/ethereum-basic-event-handlers/graphql
NEXT_PUBLIC_ALERT_THRESHOLD=20
NEXT_PUBLIC_NETWORK=tenderly-eth
NEXT_PUBLIC_CHAIN_ID=73571
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Available Commands

In the terminal:

- `help` - Show all available commands
- `test subgraph` - Test connection to The Graph subgraph (✓/✗ in sidebar)
- `status` - Show current network status
- `clear` - Clear terminal
- `show zk [hours]` - Show ZK proofs (coming soon)
- `proofs failed` - Check failed proof threshold (coming soon)
- `chain switch` - Switch networks (coming soon)

## Deployment

### Vercel

```bash
npm run build
vercel deploy
```

Or connect your GitHub repo to Vercel for automatic deployments.

### Environment Variables on Vercel

Add the same `.env.local` variables to your Vercel project settings.

## Subgraph Migration

When moving from Tenderly to Mainnet:

1. Update `docker-compose.yml` in subgraph with mainnet RPC
2. Update contract address in `subgraph.yaml`
3. Redeploy subgraph: `graph deploy`
4. Update `NEXT_PUBLIC_SUBGRAPH_URL` in Vercel env vars
5. Redeploy frontend

## Project Structure

```
quantum-canary/
├── app/
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main page (terminal + sidebar)
├── components/
│   ├── Terminal.tsx        # Xterm.js terminal component
│   └── Sidebar.tsx         # Status display sidebar
├── lib/
│   ├── apollo.ts           # Apollo Client setup
│   └── commands.ts         # Command parser & handlers
├── styles/
│   └── globals.css         # Terminal styling, CRT effects
├── public/
│   └── fonts/              # VT323 font (optional local)
└── .env.local              # Environment config
```

## Future Enhancements

- [ ] ProofAttempted event tracking (when ERC-21 contract deployed)
- [ ] Alert system for failed proof threshold
- [ ] Terminal PNG overlay for retro hardware look
- [ ] Multi-chain support (Base, mainnet)
- [ ] Quantum threat visualization
- [ ] Export data functionality

## ETHGlobal Buenos Aires

Demo showcasing:
- Real-time ZK proof monitoring
- Quantum threat detection via failed proof alerts
- Cross-chain ERC-21 protocol
- LayerZero integration

---

**No cookies. No data stored.** This is a monitoring dashboard only.

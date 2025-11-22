# Quick Start Guide - Quantum Canary Dashboard

## What's Been Built

✅ **Complete Next.js 14 application** ready for Vercel deployment
✅ **Retro terminal interface** with authentic Xterm.js integration
✅ **Live subgraph connection** to your Digital Ocean server
✅ **Working test command** with sidebar ✓/✗ display
✅ **80s CRT styling** - green terminal, scanlines, monitor border

## File Structure

```
quantum-canary/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   └── page.tsx            # Main page (terminal + sidebar layout)
├── components/
│   ├── Terminal.tsx        # Xterm terminal with command handling
│   └── Sidebar.tsx         # Status display with animations
├── lib/
│   ├── apollo.ts           # Apollo Client for subgraph queries
│   └── commands.ts         # Command parser & handlers
├── styles/
│   └── globals.css         # Terminal styling, CRT effects, animations
├── .env.local              # Environment config (subgraph URL, etc.)
├── package.json            # Dependencies installed ✓
└── README.md               # Full documentation
```

## Run Locally (First Time)

```bash
cd quantum-canary
npm run dev
```

Open **http://localhost:3000**

## Test Commands

Type these in the terminal:

1. `help` - See all commands
2. `test subgraph` - Query your DO subgraph (sidebar shows ✓ or ✗)
3. `status` - Show network info
4. `clear` - Clear terminal

## Expected Behavior

### Boot Sequence
Terminal shows:
```
Initializing Quantum Canary...
Loading quantum-resistant protocols...
ECC Integrity: 100%
Connected to Tenderly ETH Virtual Network
Chain ID: 73571

Type "help" for available commands.

quantum-canary>
```

### Test Subgraph Command
- Type: `test subgraph`
- **Success (✓)**: Sidebar shows green checkmark, displays "No transfers found (empty result - this is expected)"
- **Error (✗)**: Sidebar shows red X with error message

## Deploy to Vercel

### Option 1: CLI
```bash
npm run build
vercel deploy
```

### Option 2: GitHub
1. Push to GitHub repo
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUBGRAPH_URL`
   - `NEXT_PUBLIC_ALERT_THRESHOLD`
   - `NEXT_PUBLIC_NETWORK`
   - `NEXT_PUBLIC_CHAIN_ID`

## Next Steps

### When ERC-21 Contract is Deployed

1. **Update Subgraph Schema** (`thegraphfiles/schema.graphql.md`):
   ```graphql
   type ProofAttempt @entity(immutable: true) {
     id: Bytes!
     user: Bytes! # address
     success: Boolean!
     timestamp: BigInt!
     chainId: BigInt!
   }
   ```

2. **Update Subgraph Mapping** (`thegraphfiles/src.mapping.ts.md`):
   ```typescript
   export function handleProofAttempted(event: ProofAttemptedEvent): void {
     let entity = new ProofAttempt(...)
     entity.user = event.params.user
     entity.success = event.params.success
     entity.timestamp = event.block.timestamp
     entity.chainId = event.chainId
     entity.save()
   }
   ```

3. **Update Frontend Query** (`lib/commands.ts`):
   - Replace `GET_TRANSFERS` with `GET_PROOF_ATTEMPTS`
   - Add `show zk` command to query proofs by time range
   - Add `proofs failed` command with threshold check

4. **Redeploy Subgraph**:
   ```bash
   cd ../subgraph
   graph deploy
   ```

5. **Test with Real Data**:
   - Run authorized proofs on Tenderly → should see ✓
   - Run failed proofs → should see ✗ and alert

## Customization Ideas

### Add Terminal PNG Frame
Create a transparent PNG with monitor bezel, add to `public/`:
```css
.terminal-wrapper {
  background-image: url('/terminal-frame.png');
  background-size: contain;
  padding: 40px;
}
```

### Change Colors
Edit `styles/globals.css`:
```css
--terminal-green: #00ff00;  /* Change to amber: #ffb000 */
--monitor-glow: #ffcc00;    /* Change to blue: #00ccff */
```

### Add More Commands
Edit `lib/commands.ts`:
```typescript
commands['my-command'] = async (args) => ({
  status: 'success',
  message: 'Custom output',
  data: { ... }
});
```

## Troubleshooting

### Port Already in Use
```bash
npx kill-port 3000
npm run dev
```

### Subgraph Not Responding
- Check DO server is running: `curl http://157.245.7.229:8000/`
- Check `.env.local` has correct URL
- Test in browser: http://157.245.7.229:8000/subgraphs/name/ethereum-basic-event-handlers/graphql

### Build Errors
```bash
rm -rf .next node_modules
npm install
npm run build
```

## Tips for Hackathon Demo

1. **Prepare terminal commands** - Practice typing them smoothly
2. **Show boot sequence** - Reload page to show green terminal init
3. **Demo test command** - Type `test subgraph` to show ✓/✗ system
4. **Explain migration** - Show how easy it is to switch from Tenderly to mainnet
5. **Highlight retro UI** - Point out scanlines, CRT effects, monitor border

---

**Ready to go!** The project is fully functional and Vercel-ready. Just `npm run dev` to start!

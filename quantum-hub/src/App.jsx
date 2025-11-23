import React from 'react';

const links = [
  {
    title: 'QUANTUM CANARY',
    url: 'https://www.quantumcanary.online',
    description: 'Main Dashboard'
  },
  {
    title: 'WALLET 1',
    url: 'https://wallet.quantumcanary.online',
    description: 'Primary Quantum Wallet'
  },
  {
    title: 'WALLET 2',
    url: 'https://wallet2.quantumcanary.online',
    description: 'Secondary Quantum Wallet'
  },
  {
    title: 'THE GRAPH AMP',
    url: 'http://159.203.84.39:7402/?pgsql=postgres&username=postgres&db=amp&ns=public',
    description: 'SQL Analytics Interface'
  },
  {
    title: 'GRAPHIQL',
    url: 'http://157.245.7.229:8000/subgraphs/name/qcanary/graphql',
    description: 'GraphQL Query Interface'
  }
];

function App() {
  const handleClick = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="monitor scanlines">
      <div className="container terminal-box">
        <h1 className="terminal-text-bright title">
          ╔═══════════════════════════════╗
          <br />
          ║   ERC-21 PQ QUANTUM HUB      ║
          <br />
          ╚═══════════════════════════════╝
        </h1>

        <div className="terminal-text" style={{ textAlign: 'center', marginBottom: '30px', fontSize: '24px' }}>
          &gt; SELECT DESTINATION
        </div>

        {links.map((link, index) => (
          <button
            key={index}
            className="terminal-button"
            onClick={() => handleClick(link.url)}
          >
            [{index + 1}] {link.title}
            <div style={{ fontSize: '20px', opacity: 0.8, marginTop: '5px' }}>
              {link.description}
            </div>
          </button>
        ))}

        <div className="terminal-text" style={{ textAlign: 'center', marginTop: '40px', fontSize: '20px', opacity: 0.6 }}>
          ┌─────────────────────────────────┐
          <br />
          │ QUANTUM-RESISTANT INFRASTRUCTURE │
          <br />
          │ POWERED BY STARK PROOFS         │
          <br />
          └─────────────────────────────────┘
        </div>
      </div>
    </div>
  );
}

export default App;

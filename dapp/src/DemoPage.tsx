import React from 'react';

const DemoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-8">
        <h1 className="text-6xl font-bold text-center mb-6">
          <span className="text-blue-400">ERC-21</span>
        </h1>
        <h2 className="text-4xl font-bold text-center mb-4">
          Quantum-Resistant Token Standard
        </h2>
        <p className="text-xl text-gray-300 text-center max-w-2xl mb-8">
          Protect your assets from quantum computing threats with STARK-based ownership proofs
        </p>
        <div className="animate-bounce mt-8">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>

      {/* The Quantum Threat - Image Section */}
      <div className="min-h-screen bg-gray-800 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-8 text-red-400">
            ⚠️ The Quantum Threat is Real
          </h2>

          {/* Composite Image Area */}
          <div className="relative w-full aspect-video bg-gray-700 rounded-xl overflow-hidden mb-8 shadow-2xl">
            {/* Background: Vitalik with quantum computer */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src="/images/Vitalik-Buterin-Warns-That-Quantum-Computers-Could-Break-Bitcoin-And-Ethereum-By-2028.avif"
                alt="Vitalik warns quantum computers could break Bitcoin and Ethereum by 2028"
                className="w-full h-full object-cover opacity-80"
              />
            </div>

            {/* Overlay: Price crash chart */}
            <div className="absolute bottom-4 left-4 w-2/5 bg-black bg-opacity-70 rounded-lg p-3">
              <img
                src="/images/Ethrprice20th.png"
                alt="ETH price crash after Vitalik's quantum computing talk"
                className="w-full h-auto rounded"
              />
              <p className="text-red-400 text-sm mt-2 text-center font-bold">
                Market reaction after Vitalik's quantum computing talk
              </p>
            </div>

          </div>

          <p className="text-xl text-gray-300 text-center max-w-3xl mx-auto">
            When quantum computers can break ECDSA, <strong className="text-red-400">every wallet with a revealed public key is vulnerable</strong>.
            That's over $2 trillion in crypto assets at risk.
          </p>
        </div>
      </div>

      {/* ERC-21 Solution Diagram */}
      <div className="min-h-screen bg-gray-900 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-green-400">
            🛡️ ERC-21: The Solution
          </h2>

          {/* Main Diagram */}
          <div className="bg-gray-800 rounded-xl p-8 shadow-2xl mb-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-blue-400 mb-4">Dual-Proof Security Model</h3>
              <p className="text-gray-300">Your tokens require TWO independent proofs to spend</p>
            </div>

            {/* Lock Mechanism Diagram */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* ECC Proof */}
              <div className="bg-gray-700 rounded-lg p-6 border-2 border-yellow-500">
                <div className="text-center">
                  <div className="text-4xl mb-4">🔑</div>
                  <h4 className="text-xl font-bold text-yellow-400 mb-2">ECC Signature</h4>
                  <p className="text-gray-300 text-sm mb-4">Standard Ethereum signature</p>
                  <div className="bg-yellow-900 bg-opacity-50 rounded p-2">
                    <p className="text-yellow-300 text-xs">secp256k1</p>
                  </div>
                </div>
              </div>

              {/* Plus Sign */}
              <div className="flex items-center justify-center">
                <div className="text-6xl font-bold text-white">+</div>
              </div>

              {/* STARK Proof */}
              <div className="bg-gray-700 rounded-lg p-6 border-2 border-purple-500">
                <div className="text-center">
                  <div className="text-4xl mb-4">🔐</div>
                  <h4 className="text-xl font-bold text-purple-400 mb-2">STARK Proof</h4>
                  <p className="text-gray-300 text-sm mb-4">Quantum-resistant HD proof</p>
                  <div className="bg-purple-900 bg-opacity-50 rounded p-2">
                    <p className="text-purple-300 text-xs">Hash-based (no trusted setup)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center mb-8">
              <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Result */}
            <div className="bg-green-900 bg-opacity-30 rounded-lg p-6 border-2 border-green-500">
              <div className="text-center">
                <h4 className="text-2xl font-bold text-green-400 mb-4">✅ Transfer Succeeds</h4>
                <p className="text-gray-300">Only when BOTH proofs are valid</p>
              </div>
            </div>
          </div>

          {/* Lock Toggle Explanation */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gray-800 rounded-lg p-6">
              <h4 className="text-xl font-bold text-blue-400 mb-4 flex items-center">
                <span className="text-2xl mr-2">🔓</span> Guard OFF
              </h4>
              <p className="text-gray-300 mb-4">Standard ERC-20 behavior</p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li>• Normal transfers work</li>
                <li>• Only ECC signature required</li>
                <li>• Vulnerable to quantum attack</li>
              </ul>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500">
              <h4 className="text-xl font-bold text-green-400 mb-4 flex items-center">
                <span className="text-2xl mr-2">🔒</span> Guard ON
              </h4>
              <p className="text-gray-300 mb-4">Quantum-resistant mode</p>
              <ul className="text-gray-400 space-y-2 text-sm">
                <li>• Must use transferZK()</li>
                <li>• Requires STARK proof of HD secret</li>
                <li>• <strong className="text-green-400">Quantum-safe!</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* The Thief Scenario */}
      <div className="min-h-screen bg-gray-800 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-red-400">
            🦹 Will the Thief Scenario
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* The Attack */}
            <div className="bg-red-900 bg-opacity-30 rounded-xl p-8 border-2 border-red-500">
              <h3 className="text-2xl font-bold text-red-400 mb-6">The Attack</h3>

              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">1️⃣</span>
                  <div>
                    <p className="text-white font-bold">Will steals Alice's private key</p>
                    <p className="text-gray-400 text-sm">Phishing, malware, social engineering...</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-3">2️⃣</span>
                  <div>
                    <p className="text-white font-bold">Imports into MetaMask</p>
                    <p className="text-gray-400 text-sm">Full control of Alice's account</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-3">3️⃣</span>
                  <div>
                    <p className="text-white font-bold">Tries to transfer tokens</p>
                    <p className="text-gray-400 text-sm">Standard ERC-20 transfer call</p>
                  </div>
                </div>
              </div>
            </div>

            {/* The Defense */}
            <div className="bg-green-900 bg-opacity-30 rounded-xl p-8 border-2 border-green-500">
              <h3 className="text-2xl font-bold text-green-400 mb-6">ERC-21 Defense</h3>

              <div className="space-y-4">
                <div className="flex items-start">
                  <span className="text-2xl mr-3">🛑</span>
                  <div>
                    <p className="text-white font-bold">Transfer REVERTS!</p>
                    <p className="text-gray-400 text-sm">ZKGuardEnabled_UseTransferZK()</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-3">❌</span>
                  <div>
                    <p className="text-white font-bold">Can't generate STARK proof</p>
                    <p className="text-gray-400 text-sm">HD secret is in Alice's Snap, not exported</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <p className="text-white font-bold">Funds are SAFE</p>
                    <p className="text-gray-400 text-sm">Alice's balance unchanged</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The Key Insight */}
          <div className="bg-blue-900 bg-opacity-30 rounded-xl p-8 border-2 border-blue-400">
            <h3 className="text-2xl font-bold text-blue-400 mb-4 text-center">
              🔑 The Key Insight: Account Origin
            </h3>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-5xl mb-4">👤</div>
                <h4 className="text-xl font-bold text-green-400 mb-2">Alice's Snap</h4>
                <p className="text-gray-300 mb-4">GENERATED the address</p>
                <div className="bg-gray-800 rounded p-4">
                  <p className="text-green-400 font-mono text-sm">
                    HD Secret: ✅ Present<br/>
                    Can prove: ✅ YES
                  </p>
                </div>
              </div>

              <div className="text-center">
                <div className="text-5xl mb-4">🦹</div>
                <h4 className="text-xl font-bold text-red-400 mb-2">Will's MetaMask</h4>
                <p className="text-gray-300 mb-4">IMPORTED the key</p>
                <div className="bg-gray-800 rounded p-4">
                  <p className="text-red-400 font-mono text-sm">
                    HD Secret: ❌ None<br/>
                    Can prove: ❌ NO
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-xl text-gray-300">
                Even with the <strong>same private key</strong>, Will cannot prove he <strong>originated</strong> the address.
              </p>
              <p className="text-lg text-blue-400 mt-2">
                The HD secret stays in the Snap and is NEVER exported.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="min-h-screen bg-gray-900 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-purple-400">
            🔬 Technical Architecture
          </h2>

          {/* Flow Diagram */}
          <div className="bg-gray-800 rounded-xl p-8 mb-12">
            <h3 className="text-2xl font-bold text-center mb-8 text-blue-400">
              Transfer Flow
            </h3>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Step 1 */}
              <div className="bg-gray-700 rounded-lg p-4 text-center flex-1">
                <div className="text-3xl mb-2">📱</div>
                <p className="font-bold text-white">MetaMask Snap</p>
                <p className="text-gray-400 text-sm">Generate STARK proof</p>
              </div>

              <div className="text-2xl text-gray-500">→</div>

              {/* Step 2 */}
              <div className="bg-gray-700 rounded-lg p-4 text-center flex-1">
                <div className="text-3xl mb-2">📝</div>
                <p className="font-bold text-white">transferZK()</p>
                <p className="text-gray-400 text-sm">Submit to contract</p>
              </div>

              <div className="text-2xl text-gray-500">→</div>

              {/* Step 3 */}
              <div className="bg-gray-700 rounded-lg p-4 text-center flex-1">
                <div className="text-3xl mb-2">🔍</div>
                <p className="font-bold text-white">STARK Verifier</p>
                <p className="text-gray-400 text-sm">On-chain verification</p>
              </div>

              <div className="text-2xl text-gray-500">→</div>

              {/* Step 4 */}
              <div className="bg-gray-700 rounded-lg p-4 text-center flex-1">
                <div className="text-3xl mb-2">✅</div>
                <p className="font-bold text-white">Transfer</p>
                <p className="text-gray-400 text-sm">Execute or revert</p>
              </div>
            </div>
          </div>

          {/* Public Inputs */}
          <div className="bg-gray-800 rounded-xl p-8 mb-12">
            <h3 className="text-2xl font-bold text-center mb-6 text-purple-400">
              STARK Public Inputs
            </h3>

            <div className="font-mono bg-gray-900 rounded-lg p-6">
              <p className="text-gray-400 mb-2">// Verified on-chain</p>
              <p className="text-green-400">publicInputs[0] = <span className="text-white">from</span>      // Sender address</p>
              <p className="text-green-400">publicInputs[1] = <span className="text-white">to</span>        // Recipient address</p>
              <p className="text-green-400">publicInputs[2] = <span className="text-white">amount</span>    // Transfer amount</p>
              <p className="text-green-400">publicInputs[3] = <span className="text-white">nonce</span>     // Replay protection</p>
              <p className="text-green-400">publicInputs[4] = <span className="text-white">commitment</span> // HD commitment hash</p>
            </div>
          </div>

          {/* Why STARKs */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h4 className="text-lg font-bold text-green-400 mb-2">Quantum-Resistant</h4>
              <p className="text-gray-400 text-sm">Hash-based cryptography, no elliptic curves to break</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🚫</div>
              <h4 className="text-lg font-bold text-blue-400 mb-2">No Trusted Setup</h4>
              <p className="text-gray-400 text-sm">Unlike SNARKs, no toxic waste or ceremony required</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">📈</div>
              <h4 className="text-lg font-bold text-purple-400 mb-2">Scalable</h4>
              <p className="text-gray-400 text-sm">Polylogarithmic verification time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Canary */}
      <div className="min-h-screen bg-gray-800 py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-yellow-400">
            🐤 Digital Canary: Early Warning System
          </h2>

          <div className="bg-gray-900 rounded-xl p-8 mb-12">
            <div className="text-center mb-8">
              <p className="text-xl text-gray-300">
                Failed theft attempts are <strong className="text-yellow-400">indexed by The Graph</strong> and can trigger alerts
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-xl font-bold text-red-400 mb-4">When Attack Fails</h4>
                <div className="font-mono bg-gray-900 rounded p-4 text-sm">
                  <p className="text-purple-400">event ZKProofFailed(</p>
                  <p className="text-gray-300 ml-4">address from,</p>
                  <p className="text-gray-300 ml-4">address to,</p>
                  <p className="text-gray-300 ml-4">uint256 amount,</p>
                  <p className="text-gray-300 ml-4">string reason</p>
                  <p className="text-purple-400">);</p>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h4 className="text-xl font-bold text-green-400 mb-4">Alert Actions</h4>
                <ul className="text-gray-300 space-y-3">
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Push notification to owner
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Log attempt details
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Trigger security protocols
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    Evidence for investigation
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-blue-900 py-20 px-8 flex items-center">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-bold mb-8">
            Protect Your Assets <span className="text-blue-400">Today</span>
          </h2>

          <p className="text-xl text-gray-300 mb-12">
            Don't wait for quantum computers to break your wallet. Enable ERC-21 protection now.
          </p>

          <div className="space-y-4">
            <a
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-colors"
            >
              Launch dApp
            </a>

            <p className="text-gray-400 text-sm">
              Requires MetaMask Flask for unsigned Snap
            </p>
          </div>

          <div className="mt-16 pt-8 border-t border-gray-700">
            <p className="text-gray-500">
              Built with LayerZero • The Graph • STARKs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoPage;

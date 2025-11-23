import React from 'react';

const DemoPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-terminal-bg terminal-text scanlines crt-flicker">
      {/* Hero Section */}
      <div className="h-screen flex flex-col items-center justify-center px-8 border-b-2 border-terminal-green">
        <pre className="terminal-text-bright text-4xl md:text-6xl text-center mb-6">
╔═══════════════════════════════════╗
║         ERC-21                    ║
╚═══════════════════════════════════╝
        </pre>
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 terminal-text-bright font-vt323">
          QUANTUM-RESISTANT TOKEN STANDARD
        </h2>
        <p className="text-lg md:text-xl terminal-text text-center max-w-2xl mb-8 font-vt323">
          &gt; PROTECT YOUR ASSETS FROM QUANTUM COMPUTING THREATS
          <br />
          &gt; WITH STARK-BASED OWNERSHIP PROOFS
        </p>
        <div className="animate-bounce mt-8">
          <div className="terminal-text-bright text-2xl">V</div>
        </div>
      </div>

      {/* The Quantum Threat - Image Section */}
      <div className="min-h-screen py-20 px-8 border-b-2 border-terminal-green">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 status-error font-vt323">
            [!] THE QUANTUM THREAT IS REAL
          </h2>

          {/* Composite Image Area */}
          <div className="relative w-full aspect-video terminal-box rounded-xl overflow-hidden mb-8">
            {/* Background: Vitalik with quantum computer */}
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src="/images/Vitalik-Buterin-Warns-That-Quantum-Computers-Could-Break-Bitcoin-And-Ethereum-By-2028.avif"
                alt="Vitalik warns quantum computers could break Bitcoin and Ethereum by 2028"
                className="w-full h-full object-cover opacity-50"
              />
            </div>

            {/* Overlay: Price crash chart */}
            <div className="absolute bottom-4 left-4 w-2/5 terminal-box rounded-lg p-3">
              <img
                src="/images/Ethrprice20th.png"
                alt="ETH price crash after Vitalik's quantum computing talk"
                className="w-full h-auto rounded"
              />
              <p className="status-error text-sm mt-2 text-center font-bold font-vt323">
                &gt; MARKET REACTION AFTER QUANTUM TALK
              </p>
            </div>
          </div>

          <p className="text-lg md:text-xl terminal-text text-center max-w-3xl mx-auto font-vt323">
            &gt; WHEN QUANTUM COMPUTERS CAN BREAK ECDSA,
            <br />
            <span className="status-error font-bold">&gt; EVERY WALLET WITH A REVEALED PUBLIC KEY IS VULNERABLE</span>
            <br />
            &gt; THAT'S OVER $2 TRILLION IN CRYPTO ASSETS AT RISK.
          </p>
        </div>
      </div>

      {/* ERC-21 Solution Diagram */}
      <div className="min-h-screen py-20 px-8 border-b-2 border-terminal-green">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 status-success font-vt323">
            [+] ERC-21: THE SOLUTION
          </h2>

          {/* Main Diagram */}
          <div className="terminal-box rounded-xl p-8 mb-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold terminal-text-bright mb-4 font-vt323">&gt; DUAL-PROOF SECURITY MODEL</h3>
              <p className="terminal-text font-vt323">&gt; YOUR TOKENS REQUIRE TWO INDEPENDENT PROOFS TO SPEND</p>
            </div>

            {/* Lock Mechanism Diagram */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {/* ECC Proof */}
              <div className="terminal-box rounded-lg p-6 border-2 border-terminal-yellow">
                <div className="text-center font-vt323">
                  <div className="text-4xl mb-4 terminal-text">[ KEY ]</div>
                  <h4 className="text-xl font-bold status-warning mb-2">ECC SIGNATURE</h4>
                  <p className="terminal-text text-sm mb-4">&gt; STANDARD ETHEREUM SIGNATURE</p>
                  <div className="bg-black rounded p-2">
                    <p className="status-warning text-xs">SECP256K1</p>
                  </div>
                </div>
              </div>

              {/* Plus Sign */}
              <div className="flex items-center justify-center">
                <div className="text-6xl font-bold terminal-text-bright">+</div>
              </div>

              {/* STARK Proof */}
              <div className="terminal-box rounded-lg p-6 border-2 border-terminal-green">
                <div className="text-center font-vt323">
                  <div className="text-4xl mb-4 terminal-text">[ LOCK ]</div>
                  <h4 className="text-xl font-bold status-success mb-2">STARK PROOF</h4>
                  <p className="terminal-text text-sm mb-4">&gt; QUANTUM-RESISTANT HD PROOF</p>
                  <div className="bg-black rounded p-2">
                    <p className="status-success text-xs">HASH-BASED (NO TRUSTED SETUP)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow Down */}
            <div className="flex justify-center mb-8">
              <div className="terminal-text-bright text-4xl">V</div>
            </div>

            {/* Result */}
            <div className="terminal-box rounded-lg p-6 border-2 border-terminal-green">
              <div className="text-center font-vt323">
                <h4 className="text-2xl font-bold status-success mb-4">[+] TRANSFER SUCCEEDS</h4>
                <p className="terminal-text">&gt; ONLY WHEN BOTH PROOFS ARE VALID</p>
              </div>
            </div>
          </div>

          {/* Lock Toggle Explanation */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="terminal-box rounded-lg p-6">
              <h4 className="text-xl font-bold terminal-text mb-4 flex items-center font-vt323">
                <span className="text-2xl mr-2 status-warning">[ ]</span> GUARD OFF
              </h4>
              <p className="terminal-text mb-4 font-vt323">&gt; STANDARD ERC-20 BEHAVIOR</p>
              <ul className="terminal-text space-y-2 text-sm font-vt323">
                <li>&gt; NORMAL TRANSFERS WORK</li>
                <li>&gt; ONLY ECC SIGNATURE REQUIRED</li>
                <li className="status-error">&gt; VULNERABLE TO QUANTUM ATTACK</li>
              </ul>
            </div>

            <div className="terminal-box rounded-lg p-6 border-2 border-terminal-green">
              <h4 className="text-xl font-bold status-success mb-4 flex items-center font-vt323">
                <span className="text-2xl mr-2">[X]</span> GUARD ON
              </h4>
              <p className="terminal-text mb-4 font-vt323">&gt; QUANTUM-RESISTANT MODE</p>
              <ul className="terminal-text space-y-2 text-sm font-vt323">
                <li>&gt; MUST USE TRANSFERZK()</li>
                <li>&gt; REQUIRES STARK PROOF OF HD SECRET</li>
                <li className="status-success font-bold">&gt; QUANTUM-SAFE!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* The Thief Scenario */}
      <div className="min-h-screen py-20 px-8 border-b-2 border-terminal-green">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 status-error font-vt323">
            [!] THE THIEF SCENARIO
          </h2>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* The Attack */}
            <div className="terminal-box rounded-xl p-8 border-2 border-red-500" style={{ borderColor: '#ff0000' }}>
              <h3 className="text-2xl font-bold status-error mb-6 font-vt323">&gt; THE ATTACK</h3>

              <div className="space-y-4 font-vt323">
                <div className="flex items-start">
                  <span className="terminal-text mr-3">[1]</span>
                  <div>
                    <p className="terminal-text-bright font-bold">&gt; THIEF STEALS ALICE'S PRIVATE KEY</p>
                    <p className="terminal-text text-sm">&gt; PHISHING, MALWARE, SOCIAL ENGINEERING...</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="terminal-text mr-3">[2]</span>
                  <div>
                    <p className="terminal-text-bright font-bold">&gt; IMPORTS INTO METAMASK</p>
                    <p className="terminal-text text-sm">&gt; FULL CONTROL OF ALICE'S ACCOUNT</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="terminal-text mr-3">[3]</span>
                  <div>
                    <p className="terminal-text-bright font-bold">&gt; TRIES TO TRANSFER TOKENS</p>
                    <p className="terminal-text text-sm">&gt; STANDARD ERC-20 TRANSFER CALL</p>
                  </div>
                </div>
              </div>
            </div>

            {/* The Defense */}
            <div className="terminal-box rounded-xl p-8 border-2 border-terminal-green">
              <h3 className="text-2xl font-bold status-success mb-6 font-vt323">&gt; ERC-21 DEFENSE</h3>

              <div className="space-y-4 font-vt323">
                <div className="flex items-start">
                  <span className="status-error mr-3">[!]</span>
                  <div>
                    <p className="terminal-text-bright font-bold">&gt; TRANSFER REVERTS!</p>
                    <p className="terminal-text text-sm">&gt; ZKGUARDENABLED_USETRANSFERZK()</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="status-error mr-3">[X]</span>
                  <div>
                    <p className="terminal-text-bright font-bold">&gt; CAN'T GENERATE STARK PROOF</p>
                    <p className="terminal-text text-sm">&gt; HD SECRET IS IN ALICE'S SNAP, NOT EXPORTED</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <span className="status-success mr-3">[+]</span>
                  <div>
                    <p className="terminal-text-bright font-bold">&gt; FUNDS ARE SAFE</p>
                    <p className="terminal-text text-sm">&gt; ALICE'S BALANCE UNCHANGED</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* The Key Insight */}
          <div className="terminal-box rounded-xl p-8 border-2 border-terminal-green">
            <h3 className="text-2xl font-bold terminal-text-bright mb-4 text-center font-vt323">
              &gt; THE KEY INSIGHT: ACCOUNT ORIGIN
            </h3>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center font-vt323">
                <div className="text-5xl mb-4 terminal-text">[@]</div>
                <h4 className="text-xl font-bold status-success mb-2">ALICE'S SNAP</h4>
                <p className="terminal-text mb-4">&gt; GENERATED THE ADDRESS</p>
                <div className="terminal-box rounded p-4">
                  <p className="status-success font-mono text-sm">
                    HD SECRET: [PRESENT]<br/>
                    CAN PROVE: [YES]
                  </p>
                </div>
              </div>

              <div className="text-center font-vt323">
                <div className="text-5xl mb-4 terminal-text">[?]</div>
                <h4 className="text-xl font-bold status-error mb-2">THIEF'S METAMASK</h4>
                <p className="terminal-text mb-4">&gt; IMPORTED THE KEY</p>
                <div className="terminal-box rounded p-4">
                  <p className="status-error font-mono text-sm">
                    HD SECRET: [NONE]<br/>
                    CAN PROVE: [NO]
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center font-vt323">
              <p className="text-xl terminal-text">
                &gt; EVEN WITH THE <span className="terminal-text-bright">SAME PRIVATE KEY</span>, THIEF CANNOT PROVE
                <br />
                &gt; HE <span className="terminal-text-bright">ORIGINATED</span> THE ADDRESS.
              </p>
              <p className="text-lg status-success mt-2">
                &gt; THE HD SECRET STAYS IN THE SNAP AND IS NEVER EXPORTED.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="min-h-screen py-20 px-8 border-b-2 border-terminal-green">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 terminal-text-bright font-vt323">
            [TECH] TECHNICAL ARCHITECTURE
          </h2>

          {/* Flow Diagram */}
          <div className="terminal-box rounded-xl p-8 mb-12">
            <h3 className="text-2xl font-bold text-center mb-8 terminal-text-bright font-vt323">
              &gt; TRANSFER FLOW
            </h3>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 font-vt323">
              {/* Step 1 */}
              <div className="terminal-box rounded-lg p-4 text-center flex-1 border border-terminal-green">
                <div className="text-3xl mb-2 terminal-text">[1]</div>
                <p className="font-bold terminal-text-bright">METAMASK SNAP</p>
                <p className="terminal-text text-sm">&gt; GENERATE STARK PROOF</p>
              </div>

              <div className="text-2xl terminal-text">-&gt;</div>

              {/* Step 2 */}
              <div className="terminal-box rounded-lg p-4 text-center flex-1 border border-terminal-green">
                <div className="text-3xl mb-2 terminal-text">[2]</div>
                <p className="font-bold terminal-text-bright">TRANSFERZK()</p>
                <p className="terminal-text text-sm">&gt; SUBMIT TO CONTRACT</p>
              </div>

              <div className="text-2xl terminal-text">-&gt;</div>

              {/* Step 3 */}
              <div className="terminal-box rounded-lg p-4 text-center flex-1 border border-terminal-green">
                <div className="text-3xl mb-2 terminal-text">[3]</div>
                <p className="font-bold terminal-text-bright">STARK VERIFIER</p>
                <p className="terminal-text text-sm">&gt; ON-CHAIN VERIFICATION</p>
              </div>

              <div className="text-2xl terminal-text">-&gt;</div>

              {/* Step 4 */}
              <div className="terminal-box rounded-lg p-4 text-center flex-1 border border-terminal-green">
                <div className="text-3xl mb-2 terminal-text">[4]</div>
                <p className="font-bold terminal-text-bright">TRANSFER</p>
                <p className="terminal-text text-sm">&gt; EXECUTE OR REVERT</p>
              </div>
            </div>
          </div>

          {/* Public Inputs */}
          <div className="terminal-box rounded-xl p-8 mb-12">
            <h3 className="text-2xl font-bold text-center mb-6 terminal-text-bright font-vt323">
              &gt; STARK PUBLIC INPUTS
            </h3>

            <div className="font-mono terminal-box rounded-lg p-6">
              <p className="terminal-text mb-2">// VERIFIED ON-CHAIN</p>
              <p className="status-success">publicInputs[0] = <span className="terminal-text-bright">from</span>      // SENDER ADDRESS</p>
              <p className="status-success">publicInputs[1] = <span className="terminal-text-bright">to</span>        // RECIPIENT ADDRESS</p>
              <p className="status-success">publicInputs[2] = <span className="terminal-text-bright">amount</span>    // TRANSFER AMOUNT</p>
              <p className="status-success">publicInputs[3] = <span className="terminal-text-bright">nonce</span>     // REPLAY PROTECTION</p>
              <p className="status-success">publicInputs[4] = <span className="terminal-text-bright">commitment</span> // HD COMMITMENT HASH</p>
            </div>
          </div>

          {/* Why STARKs */}
          <div className="grid md:grid-cols-3 gap-6 font-vt323">
            <div className="terminal-box rounded-lg p-6 text-center border border-terminal-green">
              <div className="text-4xl mb-4 terminal-text">[+]</div>
              <h4 className="text-lg font-bold status-success mb-2">QUANTUM-RESISTANT</h4>
              <p className="terminal-text text-sm">&gt; HASH-BASED CRYPTOGRAPHY<br />&gt; NO ELLIPTIC CURVES TO BREAK</p>
            </div>

            <div className="terminal-box rounded-lg p-6 text-center border border-terminal-green">
              <div className="text-4xl mb-4 terminal-text">[X]</div>
              <h4 className="text-lg font-bold terminal-text-bright mb-2">NO TRUSTED SETUP</h4>
              <p className="terminal-text text-sm">&gt; UNLIKE SNARKS<br />&gt; NO TOXIC WASTE OR CEREMONY</p>
            </div>

            <div className="terminal-box rounded-lg p-6 text-center border border-terminal-green">
              <div className="text-4xl mb-4 terminal-text">[^]</div>
              <h4 className="text-lg font-bold terminal-text-bright mb-2">SCALABLE</h4>
              <p className="terminal-text text-sm">&gt; POLYLOGARITHMIC<br />&gt; VERIFICATION TIME</p>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Canary */}
      <div className="min-h-screen py-20 px-8 border-b-2 border-terminal-green">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 status-warning font-vt323">
            [CANARY] DIGITAL CANARY: EARLY WARNING SYSTEM
          </h2>

          <div className="terminal-box rounded-xl p-8 mb-12">
            <div className="text-center mb-8 font-vt323">
              <p className="text-xl terminal-text">
                &gt; FAILED THEFT ATTEMPTS ARE <span className="status-warning font-bold">INDEXED BY THE GRAPH</span>
                <br />
                &gt; AND CAN TRIGGER ALERTS
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 font-vt323">
              <div className="terminal-box rounded-lg p-6 border border-red-500" style={{ borderColor: '#ff0000' }}>
                <h4 className="text-xl font-bold status-error mb-4">&gt; WHEN ATTACK FAILS</h4>
                <div className="font-mono terminal-box rounded p-4 text-sm">
                  <p className="terminal-text-bright">event ZKProofFailed(</p>
                  <p className="terminal-text ml-4">address from,</p>
                  <p className="terminal-text ml-4">address to,</p>
                  <p className="terminal-text ml-4">uint256 amount,</p>
                  <p className="terminal-text ml-4">string reason</p>
                  <p className="terminal-text-bright">);</p>
                </div>
              </div>

              <div className="terminal-box rounded-lg p-6 border border-terminal-green">
                <h4 className="text-xl font-bold status-success mb-4">&gt; ALERT ACTIONS</h4>
                <ul className="terminal-text space-y-3">
                  <li className="flex items-center">
                    <span className="status-success mr-2">[+]</span>
                    PUSH NOTIFICATION TO OWNER
                  </li>
                  <li className="flex items-center">
                    <span className="status-success mr-2">[+]</span>
                    LOG ATTEMPT DETAILS
                  </li>
                  <li className="flex items-center">
                    <span className="status-success mr-2">[+]</span>
                    TRIGGER SECURITY PROTOCOLS
                  </li>
                  <li className="flex items-center">
                    <span className="status-success mr-2">[+]</span>
                    EVIDENCE FOR INVESTIGATION
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="min-h-screen py-20 px-8 flex items-center">
        <div className="max-w-4xl mx-auto text-center font-vt323">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 terminal-text-bright">
            PROTECT YOUR ASSETS <span className="status-success">TODAY</span>
          </h2>

          <p className="text-xl terminal-text mb-12">
            &gt; DON'T WAIT FOR QUANTUM COMPUTERS TO BREAK YOUR WALLET.
            <br />
            &gt; ENABLE ERC-21 PROTECTION NOW.
          </p>

          <div className="space-y-4">
            <a
              href="/"
              className="inline-block terminal-button font-bold py-4 px-8 rounded-lg text-xl"
            >
              [ LAUNCH DAPP ]
            </a>

            <p className="terminal-text text-sm">
              &gt; REQUIRES METAMASK FLASK FOR UNSIGNED SNAP
            </p>
          </div>

          <div className="mt-16 pt-8 border-t border-terminal-green">
            <p className="terminal-text">
              &gt; BUILT WITH LAYERZERO • THE GRAPH • STARKS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoPage;

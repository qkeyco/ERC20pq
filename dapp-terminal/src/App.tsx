import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

// Snap ID - npm published snap
const SNAP_ID = 'npm:@jamesptagg/erc21pq-snap';

// Network configurations
const NETWORKS = {
  'tenderly-eth': {
    name: 'Tenderly Ethereum',
    chainId: '0x11F63', // 73571
    rpcUrl: 'https://virtual.mainnet.us-west.rpc.tenderly.co/8d34857c-35dd-4e13-b36d-2688a4377b1f',
    token: '0x9a1766F6CC8d02CC5C9b449958409A8F025b03BC',
    merchant: '0x056cb77995eC5ef2da35CfD02a547058c6D14d84',
  },
  'tenderly-base': {
    name: 'Tenderly Base',
    chainId: '0x210E', // 8462
    rpcUrl: 'https://virtual.base.eu.rpc.tenderly.co/18d3110d-0934-4f12-b889-58fa6fa45d72',
    token: '0x7F56E701a5E3cB764Aaf4C0605699dB517F4Fce8',
    merchant: '0x9aA36e49a11a4832B57C954c605692327b2DDd4f',
  },
};

type NetworkKey = keyof typeof NETWORKS;

interface AccountInfo {
  address: string;
  balance: string;
  commitment: string;
  nonce: string;
  isGuarded: boolean;
}

function App() {
  const [account, setAccount] = useState<string>('');
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [snapInstalled, setSnapInstalled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string>('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkKey>('tenderly-eth');
  const [currentChainId, setCurrentChainId] = useState<string>('');

  // Check if MetaMask chain matches selected network (normalize to lowercase for comparison)
  const expectedChainId = NETWORKS[selectedNetwork].chainId.toLowerCase();
  const networkMismatch = currentChainId && currentChainId.toLowerCase() !== expectedChainId;

  // Listen for chain changes
  useEffect(() => {
    const checkChain = async () => {
      if ((window as any).ethereum) {
        const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
        setCurrentChainId(chainId);
      }
    };
    checkChain();

    const handleChainChanged = (chainId: string) => {
      setCurrentChainId(chainId);
      // Auto-sync dropdown to match MetaMask network
      const matchingNetwork = Object.entries(NETWORKS).find(
        ([_, net]) => net.chainId.toLowerCase() === chainId.toLowerCase()
      );
      if (matchingNetwork) {
        setSelectedNetwork(matchingNetwork[0] as NetworkKey);
      }
    };

    if ((window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if ((window as any).ethereum) {
        (window as any).ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  // Get current network config - use functions to always get fresh values
  const getTokenAddress = () => NETWORKS[selectedNetwork].token;
  const getMerchantAddress = () => NETWORKS[selectedNetwork].merchant;

  // Switch network in MetaMask
  const switchNetwork = async (networkKey: NetworkKey) => {
    const netConfig = NETWORKS[networkKey];
    setTxStatus(`> SWITCHING TO ${netConfig.name.toUpperCase()}...`);
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: netConfig.chainId }],
      });
      setSelectedNetwork(networkKey);
      setTxStatus(`> SWITCHED TO ${netConfig.name.toUpperCase()}`);
      // Force refresh after state update
      setTimeout(() => {
        if (account && snapInstalled) {
          setAccountInfo(null);
          // Manually call contract with new addresses
          const tokenAddr = NETWORKS[networkKey].token;
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const contract = new ethers.Contract(tokenAddr, [
            'function balanceOf(address) view returns (uint256)',
            'function hdCommitment(address) view returns (bytes32)',
            'function zkNonce(address) view returns (uint256)',
            'function zkGuardEnabled(address) view returns (bool)',
          ], provider);

          Promise.all([
            contract.balanceOf(account),
            contract.hdCommitment(account),
            contract.zkNonce(account),
            contract.zkGuardEnabled(account),
          ]).then(([balance, commitment, nonce, isGuarded]) => {
            setAccountInfo({
              address: account,
              balance: ethers.formatEther(balance),
              commitment: commitment,
              nonce: nonce.toString(),
              isGuarded: isGuarded,
            });
            setTxStatus('');
          }).catch(err => {
            console.error('Failed to load info:', err);
            setTxStatus('> ERROR: FAILED TO LOAD ACCOUNT INFO');
          });
        }
      }, 100);
    } catch (switchError: any) {
      // Chain not added, add it
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: netConfig.chainId,
              chainName: netConfig.name,
              rpcUrls: [netConfig.rpcUrl],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            }],
          });
          setSelectedNetwork(networkKey);
          setTxStatus(`> ADDED AND SWITCHED TO ${netConfig.name.toUpperCase()}`);
        } catch (addError) {
          console.error('Failed to add network:', addError);
          setTxStatus('> ERROR: FAILED TO ADD NETWORK');
        }
      } else {
        console.error('Failed to switch network:', switchError);
        setTxStatus('> ERROR: FAILED TO SWITCH NETWORK');
      }
    }
  };

  // Check if MetaMask is installed and connect
  useEffect(() => {
    const init = async () => {
      const provider = await detectEthereumProvider();
      if (provider) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_accounts',
        });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }

        // Check if Snap is already installed
        try {
          const snaps = await (window as any).ethereum.request({
            method: 'wallet_getSnaps',
          });
          if (snaps[SNAP_ID]) {
            setSnapInstalled(true);
          }
        } catch (e) {
          console.log('Could not check snaps');
        }
      }
    };
    init();
  }, []);

  // Auto-refresh info when account or network changes
  useEffect(() => {
    if (account && snapInstalled) {
      refreshInfo();
    }
  }, [account, snapInstalled, selectedNetwork]);

  // Connect wallet
  const connectWallet = async () => {
    try {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts',
      });
      setAccount(accounts[0]);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  // Install Snap
  const installSnap = async () => {
    try {
      await (window as any).ethereum.request({
        method: 'wallet_requestSnaps',
        params: {
          [SNAP_ID]: {},
        },
      });
      setSnapInstalled(true);
      setTxStatus('> SNAP INSTALLED SUCCESSFULLY');
    } catch (error) {
      console.error('Failed to install snap:', error);
      setTxStatus('> ERROR: FAILED TO INSTALL SNAP');
    }
  };

  // Get account info directly from contract (no Snap needed)
  const refreshInfo = async () => {
    if (!account) {
      setTxStatus('> ERROR: CONNECT WALLET FIRST');
      return;
    }
    setTxStatus('> LOADING ACCOUNT INFO...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);

      // Check network matches selected
      const network = await provider.getNetwork();
      const expectedId = BigInt(parseInt(NETWORKS[selectedNetwork].chainId, 16));
      if (network.chainId !== expectedId) {
        setTxStatus(`> ERROR: WRONG NETWORK (CHAIN ${network.chainId}). EXPECTED ${NETWORKS[selectedNetwork].name.toUpperCase()} (CHAIN ${expectedId})`);
        return;
      }

      const contract = new ethers.Contract(getTokenAddress(), [
        'function balanceOf(address) view returns (uint256)',
        'function hdCommitment(address) view returns (bytes32)',
        'function zkNonce(address) view returns (uint256)',
        'function zkGuardEnabled(address) view returns (bool)',
      ], provider);

      const [balance, commitment, nonce, isGuarded] = await Promise.all([
        contract.balanceOf(account),
        contract.hdCommitment(account),
        contract.zkNonce(account),
        contract.zkGuardEnabled(account),
      ]);

      setAccountInfo({
        address: account,
        balance: ethers.formatEther(balance),
        commitment,
        nonce: nonce.toString(),
        isGuarded,
      });
      setTxStatus('');
    } catch (error: any) {
      console.error('Failed to get info:', error);
      setTxStatus(`> ERROR: ${error.message || 'FAILED TO LOAD INFO'}`);
    }
  };

  // Helper to send transaction from Snap result
  const sendSnapTx = async (result: { to: string; data: string }) => {
    const txHash = await (window as any).ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: account,
        to: result.to,
        data: result.data,
      }],
    });
    return txHash;
  };

  // Wait for transaction to be mined
  const waitForTx = async (txHash: string) => {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    let receipt = null;
    while (!receipt) {
      receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return receipt;
  };

  // Setup Quantum Protection (single transaction)
  const setupProtection = async () => {
    setLoading(true);
    setTxStatus('> SETTING UP QUANTUM PROTECTION...');
    try {
      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_setupProtection',
            params: { tokenAddress: getTokenAddress() },
          },
        },
      });
      const txHash = await sendSnapTx(result);
      setTxStatus(`> PROTECTION ENABLED | TX: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`> ERROR: ${error.message}`);
    }
    setLoading(false);
  };

  // Enable ZK Guard
  const enableGuard = async () => {
    setLoading(true);
    setTxStatus('> ENABLING ZK GUARD...');
    try {
      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_enableZKGuard',
            params: { tokenAddress: getTokenAddress() },
          },
        },
      });
      const txHash = await sendSnapTx(result);
      setTxStatus(`> ZK GUARD ENABLED | TX: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`> ERROR: ${error.message}`);
    }
    setLoading(false);
  };

  // Disable ZK Guard
  const disableGuard = async () => {
    setLoading(true);
    setTxStatus('> DISABLING ZK GUARD WITH STARK PROOF...');
    try {
      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_disableZKGuard',
            params: { tokenAddress: getTokenAddress(), from: account },
          },
        },
      });
      const txHash = await sendSnapTx(result);
      setTxStatus(`> ZK GUARD DISABLED | TX: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`> ERROR: ${error.message}`);
    }
    setLoading(false);
  };

  // PQ Send (ZK Transfer)
  const pqSend = async () => {
    if (!recipient || !amount) {
      setTxStatus('> ERROR: ENTER RECIPIENT AND AMOUNT');
      return;
    }
    setLoading(true);
    setTxStatus('> GENERATING ZK PROOF AND SENDING...');
    try {
      // Get nonce from contract (dapp has correct network)
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(getTokenAddress(), [
        'function zkNonce(address) view returns (uint256)',
        'function hdCommitment(address) view returns (bytes32)',
      ], provider);
      const [nonce, commitment] = await Promise.all([
        contract.zkNonce(account),
        contract.hdCommitment(account),
      ]);

      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_transferZK',
            params: {
              tokenAddress: getTokenAddress(),
              to: recipient,
              amount: amount,
              from: account,
              nonce: nonce.toString(),
              commitment: commitment,
            },
          },
        },
      });
      const txHash = await sendSnapTx(result);
      setTxStatus(`> CONFIRMING...`);

      // Wait for confirmation
      await waitForTx(txHash);

      setTxStatus(`> TRANSFER SUCCESSFUL | TX: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
      setRecipient('');
      setAmount('');
    } catch (error: any) {
      setTxStatus(`> ERROR: ${error.message}`);
    }
    setLoading(false);
  };

  // Simulate Thief - try transfer without ZK proof (emits event for Graph)
  const simulateThief = async () => {
    setLoading(true);
    setTxStatus('> THIEF ATTEMPTING TO STEAL TOKENS...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(getTokenAddress(), [
        'function tryTransfer(address to, uint256 amount) returns (bool)',
      ], signer);

      // Try transfer without ZK proof - emits TransferBlocked event for Graph indexing
      const tx = await contract.tryTransfer(getMerchantAddress(), ethers.parseEther('100'));
      const receipt = await tx.wait();

      // Check if transfer succeeded (returns false if blocked)
      // Look for TransferBlocked event in logs
      const blocked = receipt.logs.some((log: any) => {
        try {
          const iface = new ethers.Interface([
            'event TransferBlocked(address indexed from, address indexed to, uint256 amount, string reason)'
          ]);
          iface.parseLog({ topics: log.topics, data: log.data });
          return true;
        } catch {
          return false;
        }
      });

      if (blocked) {
        setTxStatus('> THEFT BLOCKED! ZK GUARD PROTECTED YOUR TOKENS. EVENT LOGGED.');
      } else {
        setTxStatus('> SECURITY BREACH! TOKENS STOLEN!');
        await refreshInfo();
      }
    } catch (error: any) {
      setTxStatus(`> ERROR: ${error.message.slice(0, 50)}...`);
    }
    setLoading(false);
  };

  // Pay Pizza
  const payPizza = async () => {
    setLoading(true);
    setTxStatus('> PAYING FOR PIZZA WITH ZK PROOF...');
    try {
      // Get nonce from contract (dapp has correct network)
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(getTokenAddress(), [
        'function zkNonce(address) view returns (uint256)',
        'function hdCommitment(address) view returns (bytes32)',
      ], provider);
      const [nonce, commitment] = await Promise.all([
        contract.zkNonce(account),
        contract.hdCommitment(account),
      ]);

      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_transferZK',
            params: {
              tokenAddress: getTokenAddress(),
              to: getMerchantAddress(),
              amount: '10', // Pizza price
              from: account,
              nonce: nonce.toString(),
              commitment: commitment,
            },
          },
        },
      });
      const txHash = await sendSnapTx(result);
      setTxStatus(`> CONFIRMING...`);

      // Wait for confirmation
      await waitForTx(txHash);

      setTxStatus(`> PIZZA PAID | TX: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`> ERROR: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-terminal-bg p-4 md:p-8 scanlines crt-flicker">
      <div className="max-w-4xl mx-auto monitor p-6">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-terminal-green pb-6">
          <pre className="terminal-text-bright text-2xl md:text-4xl mb-2">
╔══════════════════════════════╗
║  ERC-21 PQ TOKEN            ║
║  QUANTUM-RESISTANT OWNERSHIP║
╚══════════════════════════════╝
          </pre>
          <p className="terminal-text text-base md:text-lg">
            &gt; STATUS: ONLINE | PROTECTION: ACTIVE
          </p>
        </div>

        {/* Network Selector */}
        <div className="mb-6 flex justify-center">
          <select
            value={selectedNetwork}
            onChange={(e) => switchNetwork(e.target.value as NetworkKey)}
            className="terminal-input px-4 py-2 rounded font-vt323"
          >
            {Object.entries(NETWORKS).map(([key, net]) => (
              <option key={key} value={key} className="bg-black text-terminal-green">
                {net.name}
              </option>
            ))}
          </select>
        </div>

        {/* Network Mismatch Warning */}
        {networkMismatch && (
          <div className="mb-4 alert-box alert-error">
            <p className="font-vt323 text-sm">
              [!] NETWORK MISMATCH | CHAIN {parseInt(currentChainId, 16)}
              <br />
              [!] SWITCH TO "{NETWORKS[selectedNetwork].name.toUpperCase()}" | CHAIN {parseInt(expectedChainId, 16)}
            </p>
          </div>
        )}

        {/* Main Card */}
        <div className="terminal-box rounded-lg p-6">
          {/* Connection Status */}
          {!account ? (
            <button
              onClick={connectWallet}
              className="w-full terminal-button py-3 px-6 rounded-lg font-vt323 text-xl"
            >
              [ CONNECT WALLET ]
            </button>
          ) : (
            <>
              {/* Account Info */}
              <div className="mb-6 p-4 terminal-box rounded-lg">
                <div className="terminal-text text-sm mb-1">&gt; YOUR WALLET</div>
                <div className="font-mono text-xs terminal-text truncate">{account}</div>
                {accountInfo ? (
                  <div className="mt-4 space-y-2 font-vt323">
                    <div className="flex justify-between items-center">
                      <span className="terminal-text">&gt; BALANCE:</span>
                      <span className="terminal-text-bright text-xl">{parseFloat(accountInfo.balance).toFixed(2)} USDPQ</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="terminal-text">&gt; PROTECTION:</span>
                      <span className={accountInfo.isGuarded ? 'status-success font-bold' : 'status-warning'}>
                        {accountInfo.isGuarded ? '[QUANTUM LOCK ON]' : '[STANDARD MODE]'}
                      </span>
                    </div>
                    {accountInfo.commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                      <div className="text-xs terminal-text">
                        &gt; TRANSFERS: {accountInfo.nonce}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-sm terminal-text">
                    &gt; CLICK REFRESH TO LOAD BALANCE
                  </div>
                )}
                <button
                  onClick={refreshInfo}
                  className="mt-4 terminal-button px-4 py-1 rounded text-sm"
                >
                  [ REFRESH ]
                </button>
              </div>

              {/* Snap Installation */}
              {!snapInstalled && (
                <div className="mb-4">
                  <div className="alert-box alert-warning mb-3">
                    <p className="font-vt323 text-sm font-bold">[!] REQUIRES METAMASK FLASK</p>
                    <p className="font-vt323 text-xs mt-1">
                      &gt; UNSIGNED SNAP REQUIRES FLASK DEVELOPER VERSION
                    </p>
                    <p className="font-vt323 text-xs mt-1">
                      &gt; WARNING: FLASK HANDLES REAL FUNDS. USE WITH CAUTION.
                    </p>
                  </div>
                  <button
                    onClick={installSnap}
                    className="w-full terminal-button py-3 rounded-lg font-vt323 text-lg"
                  >
                    [ INSTALL ERC-21 SNAP ]
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-4">
                {/* Setup quantum protection if no commitment yet */}
                {accountInfo && accountInfo.commitment === '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <button
                    onClick={setupProtection}
                    disabled={loading}
                    className="w-full terminal-button py-3 rounded-lg font-vt323 text-lg"
                  >
                    {loading ? '[ SETTING UP... ]' : '[ SETUP QUANTUM PROTECTION ]'}
                  </button>
                )}

                {/* Quantum Lock Toggle */}
                {accountInfo && accountInfo.commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <div className="flex items-center justify-between p-4 terminal-box rounded-lg">
                    <div className="font-vt323">
                      <div className="terminal-text-bright text-lg">&gt; QUANTUM LOCK</div>
                      <div className="text-sm terminal-text">
                        {accountInfo.isGuarded ? 'PROTECTED WITH STARK PROOFS' : 'STANDARD TRANSFERS ENABLED'}
                      </div>
                    </div>
                    <button
                      onClick={accountInfo.isGuarded ? disableGuard : enableGuard}
                      disabled={loading}
                      className={`terminal-toggle ${accountInfo.isGuarded ? 'active' : ''} ${loading ? 'opacity-50' : ''}`}
                    >
                      <span />
                    </button>
                  </div>
                )}

                {/* PQ Send Form */}
                <div className="p-4 terminal-box rounded-lg space-y-3">
                  <h3 className="font-vt323 terminal-text-bright text-lg">&gt; PQ SEND</h3>
                  <input
                    type="text"
                    placeholder="RECIPIENT ADDRESS"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full terminal-input p-2 rounded"
                  />
                  <input
                    type="text"
                    placeholder="AMOUNT"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full terminal-input p-2 rounded"
                  />
                  <button
                    onClick={pqSend}
                    disabled={loading}
                    className="w-full terminal-button py-2 rounded-lg font-vt323"
                  >
                    {loading ? '[ PROCESSING... ]' : '[ SEND WITH ZK PROOF ]'}
                  </button>
                </div>

                <button
                  onClick={payPizza}
                  disabled={loading}
                  className="w-full terminal-button py-3 rounded-lg font-vt323 text-lg"
                >
                  {loading ? '[ PROCESSING... ]' : '[ PAY PIZZA (10 USDPQ) ]'}
                </button>

                {/* Simulate Thief - demo security */}
                {accountInfo && accountInfo.isGuarded && (
                  <button
                    onClick={simulateThief}
                    disabled={loading}
                    className="w-full terminal-button py-3 rounded-lg font-vt323 text-lg border-red-500 text-red-500"
                    style={{ borderColor: '#ff0000', color: '#ff0000', textShadow: '0 0 5px #ff0000' }}
                  >
                    {loading ? '[ ATTEMPTING... ]' : '[ SIMULATE THIEF (TRY TO STEAL) ]'}
                  </button>
                )}
              </div>

              {/* Transaction Status */}
              {txStatus && (
                <div className={`mt-4 p-3 rounded-lg text-sm font-vt323 ${
                  txStatus.includes('ERROR') ? 'alert-box alert-error' :
                  txStatus.includes('BLOCKED') || txStatus.includes('SUCCESS') ? 'alert-box alert-success' :
                  'terminal-box'
                }`}>
                  {txStatus}
                </div>
              )}
            </>
          )}
        </div>

        {/* Demo Info */}
        <div className="mt-6 text-center terminal-text font-vt323 text-sm border-t-2 border-terminal-green pt-6">
          <p>&gt; EVEN IF AN ATTACKER GETS YOUR PRIVATE KEY,</p>
          <p>&gt; THEY CANNOT MOVE YOUR LOCKED TOKENS.</p>
          <p className="mt-2 terminal-text-bright text-base">&gt; OWNERSHIP = ZK PROOF, NOT ECDSA</p>
        </div>
      </div>
    </div>
  );
}

export default App;

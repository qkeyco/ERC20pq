import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

// Snap ID - update with actual published snap ID
const SNAP_ID = 'local:http://localhost:8080';

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
    chainId: '0x2105', // 8453
    rpcUrl: 'https://virtual.base.us-west.rpc.tenderly.co/faa3abed-5400-4dc8-87ec-6091314a56cf',
    token: '0x420366e5f35d53a2c0E3192f0C8fc6449509C875',
    merchant: '0x4eE979DDDb05523A85C40795c0389B9e08e3c693',
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

  // Get current network config - use functions to always get fresh values
  const getTokenAddress = () => NETWORKS[selectedNetwork].token;
  const getMerchantAddress = () => NETWORKS[selectedNetwork].merchant;

  // Switch network in MetaMask
  const switchNetwork = async (networkKey: NetworkKey) => {
    const netConfig = NETWORKS[networkKey];
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: netConfig.chainId }],
      });
      setSelectedNetwork(networkKey);
      setTxStatus(`Switched to ${netConfig.name}`);
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
          setTxStatus(`Added and switched to ${netConfig.name}`);
        } catch (addError) {
          console.error('Failed to add network:', addError);
          setTxStatus('Failed to add network');
        }
      } else {
        console.error('Failed to switch network:', switchError);
        setTxStatus('Failed to switch network');
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
      setTxStatus('Snap installed successfully!');
    } catch (error) {
      console.error('Failed to install snap:', error);
      setTxStatus('Failed to install snap');
    }
  };

  // Get account info directly from contract (no Snap needed)
  const refreshInfo = async () => {
    if (!account) {
      setTxStatus('Please connect wallet first');
      return;
    }
    setTxStatus('Loading account info...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);

      // Check network
      const network = await provider.getNetwork();
      if (network.chainId !== 73571n) {
        setTxStatus(`Wrong network (chain ${network.chainId}). Click the globe icon in MetaMask and select "EthereumPQ" (chain 73571)`);
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
      setTxStatus(`Error: ${error.message || 'Failed to load info'}`);
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
    setTxStatus('Setting up quantum protection...');
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
      setTxStatus(`Protection enabled! Tx: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  // Enable ZK Guard
  const enableGuard = async () => {
    setLoading(true);
    setTxStatus('Enabling ZK guard...');
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
      setTxStatus(`ZK guard enabled! Tx: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  // Disable ZK Guard
  const disableGuard = async () => {
    setLoading(true);
    setTxStatus('Disabling ZK guard with STARK proof...');
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
      setTxStatus(`ZK guard disabled! Tx: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  // PQ Send (ZK Transfer)
  const pqSend = async () => {
    if (!recipient || !amount) {
      setTxStatus('Please enter recipient and amount');
      return;
    }
    setLoading(true);
    setTxStatus('Generating ZK proof and sending...');
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
      setTxStatus(`Confirming...`);

      // Wait for confirmation
      await waitForTx(txHash);

      setTxStatus(`Transfer successful! Tx: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
      setRecipient('');
      setAmount('');
    } catch (error: any) {
      setTxStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  // Simulate Thief - try regular transfer (will fail)
  const simulateThief = async () => {
    setLoading(true);
    setTxStatus('🦹 Thief attempting to steal tokens...');
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(getTokenAddress(), [
        'function transfer(address to, uint256 amount) returns (bool)',
      ], signer);

      // Try regular transfer - this will fail if ZK guard is enabled
      // Force send with manual gas limit to bypass estimation and show MetaMask confirmation
      const tx = await contract.transfer(getMerchantAddress(), ethers.parseEther('100'), {
        gasLimit: 100000,
      });
      await tx.wait();

      setTxStatus('❌ Security breach! Tokens stolen!');
    } catch (error: any) {
      if (error.message.includes('ZKGuardEnabled') || error.message.includes('reverted')) {
        setTxStatus('✅ Theft BLOCKED! ZK Guard protected your tokens. Attacker needs your HD secret.');
      } else {
        setTxStatus(`✅ Theft blocked: ${error.message.slice(0, 50)}...`);
      }
    }
    setLoading(false);
  };

  // Pay Pizza
  const payPizza = async () => {
    setLoading(true);
    setTxStatus('Paying for pizza with ZK proof...');
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
      setTxStatus(`Confirming...`);

      // Wait for confirmation
      await waitForTx(txHash);

      setTxStatus(`Pizza paid! Tx: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
    } catch (error: any) {
      setTxStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            ERC-21 PQ Token
          </h1>
          <p className="text-white/80">
            Quantum-resistant ownership with ZK proofs
          </p>
        </div>

        {/* Network Selector */}
        <div className="mb-4 flex justify-center">
          <select
            value={selectedNetwork}
            onChange={(e) => switchNetwork(e.target.value as NetworkKey)}
            className="bg-white/10 text-white border border-white/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {Object.entries(NETWORKS).map(([key, net]) => (
              <option key={key} value={key} className="text-gray-900">
                {net.name}
              </option>
            ))}
          </select>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Connection Status */}
          {!account ? (
            <button
              onClick={connectWallet}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
            >
              Connect Wallet
            </button>
          ) : (
            <>
              {/* Account Info */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-500">Your Wallet</div>
                <div className="font-mono text-xs truncate text-gray-600">{account}</div>
                {accountInfo ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Balance:</span>
                      <span className="font-semibold text-lg">{parseFloat(accountInfo.balance).toFixed(2)} USDPQ</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Protection:</span>
                      <span className={accountInfo.isGuarded ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                        {accountInfo.isGuarded ? '🔒 Quantum Lock ON' : '🔓 Standard Mode'}
                      </span>
                    </div>
                    {accountInfo.commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                      <div className="text-xs text-gray-400">
                        Transfers: {accountInfo.nonce}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-500">
                    Click Refresh to load your balance
                  </div>
                )}
                <button
                  onClick={refreshInfo}
                  className="mt-3 text-sm text-purple-600 hover:text-purple-800"
                >
                  ↻ Refresh
                </button>
              </div>

              {/* Snap Installation */}
              {!snapInstalled && (
                <div className="mb-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                    <p className="text-amber-800 text-sm font-medium">⚠️ Requires MetaMask Flask</p>
                    <p className="text-amber-700 text-xs mt-1">
                      This demo uses an unsigned Snap. You need{' '}
                      <a href="https://metamask.io/flask/" target="_blank" rel="noopener noreferrer" className="underline">
                        MetaMask Flask
                      </a>
                      {' '}(developer version) to run it.
                    </p>
                    <p className="text-amber-600 text-xs mt-1">
                      ⚡ Warning: Flask handles real funds. Use with caution.
                    </p>
                  </div>
                  <button
                    onClick={installSnap}
                    className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
                  >
                    Install ERC-21 Snap
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Setup quantum protection if no commitment yet */}
                {accountInfo && accountInfo.commitment === '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <button
                    onClick={setupProtection}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Setting up...' : '🔐 Setup Quantum Protection'}
                  </button>
                )}

                {/* Quantum Lock Toggle */}
                {accountInfo && accountInfo.commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-semibold">Quantum Lock</div>
                      <div className="text-sm text-gray-500">
                        {accountInfo.isGuarded ? 'Protected with STARK proofs' : 'Standard transfers enabled'}
                      </div>
                    </div>
                    <button
                      onClick={accountInfo.isGuarded ? disableGuard : enableGuard}
                      disabled={loading}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                        accountInfo.isGuarded ? 'bg-green-500' : 'bg-gray-300'
                      } ${loading ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          accountInfo.isGuarded ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* PQ Send Form */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <h3 className="font-semibold">PQ Send</h3>
                  <input
                    type="text"
                    placeholder="Recipient address"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                  <input
                    type="text"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 border rounded"
                  />
                  <button
                    onClick={pqSend}
                    disabled={loading}
                    className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Send with ZK Proof'}
                  </button>
                </div>

                <button
                  onClick={payPizza}
                  disabled={loading}
                  className="w-full bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600 transition disabled:opacity-50"
                >
                  {loading ? 'Processing...' : '🍕 Pay Pizza (10 USDPQ)'}
                </button>

                {/* Simulate Thief - demo security */}
                {accountInfo && accountInfo.isGuarded && (
                  <button
                    onClick={simulateThief}
                    disabled={loading}
                    className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Attempting...' : '🦹 Simulate Thief (Try to Steal)'}
                  </button>
                )}
              </div>

              {/* Transaction Status */}
              {txStatus && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm">
                  {txStatus}
                </div>
              )}
            </>
          )}
        </div>

        {/* Demo Info */}
        <div className="mt-6 text-center text-white/70 text-sm">
          <p>Even if an attacker gets your private key,</p>
          <p>they cannot move your locked tokens.</p>
          <p className="mt-2 font-semibold">Ownership = ZK Proof, not ECDSA</p>
        </div>
      </div>
    </div>
  );
}

export default App;

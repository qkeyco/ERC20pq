import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

// Snap ID - update with actual published snap ID
const SNAP_ID = 'local:http://localhost:8080';

// Contract addresses - Tenderly Fork (Chain ID: 73571)
const TOKEN_ADDRESS = '0x011b5b823663C76dc70411C2be32124372464575';
const MERCHANT_ADDRESS = '0x242f9504864776Be37752050EdA0F4ac33a565C4';

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

  // Auto-refresh info when account changes
  useEffect(() => {
    if (account && snapInstalled) {
      refreshInfo();
    }
  }, [account, snapInstalled]);

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
        setTxStatus(`Wrong network! You're on chain ${network.chainId}. Please switch to Tenderly Fork (73571)`);
        return;
      }

      const contract = new ethers.Contract(TOKEN_ADDRESS, [
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

  // Bind HD Commitment
  const bindHD = async () => {
    setLoading(true);
    setTxStatus('Binding HD commitment...');
    try {
      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_bindHD',
            params: { tokenAddress: TOKEN_ADDRESS },
          },
        },
      });
      const txHash = await sendSnapTx(result);
      setTxStatus(`Commitment bound! Tx: ${txHash.slice(0, 10)}...`);
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
            params: { tokenAddress: TOKEN_ADDRESS },
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
            params: { tokenAddress: TOKEN_ADDRESS, from: account },
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
      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_transferZK',
            params: {
              tokenAddress: TOKEN_ADDRESS,
              to: recipient,
              amount: amount,
              from: account,
            },
          },
        },
      });
      const txHash = await sendSnapTx(result);
      setTxStatus(`Transfer successful! Tx: ${txHash.slice(0, 10)}...`);
      await refreshInfo();
      setRecipient('');
      setAmount('');
    } catch (error: any) {
      setTxStatus(`Error: ${error.message}`);
    }
    setLoading(false);
  };

  // Pay Pizza
  const payPizza = async () => {
    setLoading(true);
    setTxStatus('Paying for pizza with ZK proof...');
    try {
      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_transferZK',
            params: {
              tokenAddress: TOKEN_ADDRESS,
              to: MERCHANT_ADDRESS,
              amount: '10', // Pizza price
              from: account,
            },
          },
        },
      });
      const txHash = await sendSnapTx(result);
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
                      <span className="font-semibold text-lg">{parseFloat(accountInfo.balance).toFixed(2)} LZPQ</span>
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
                <button
                  onClick={installSnap}
                  className="w-full bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600 transition mb-4"
                >
                  Install ERC-21 Snap
                </button>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Setup quantum protection if no commitment yet */}
                {accountInfo && accountInfo.commitment === '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                  <button
                    onClick={bindHD}
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
                  {loading ? 'Processing...' : '🍕 Pay Pizza (10 LZPQ)'}
                </button>
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

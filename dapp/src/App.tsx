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
      }
    };
    init();
  }, []);

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

  // Get account info
  const refreshInfo = async () => {
    if (!account) return;
    try {
      const result = await (window as any).ethereum.request({
        method: 'wallet_invokeSnap',
        params: {
          snapId: SNAP_ID,
          request: {
            method: 'ethvaultpq_getInfo',
            params: { tokenAddress: TOKEN_ADDRESS },
          },
        },
      });
      setAccountInfo(result);
    } catch (error) {
      console.error('Failed to get info:', error);
    }
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
      setTxStatus(`Commitment bound! Tx: ${result.txHash.slice(0, 10)}...`);
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
      setTxStatus(`ZK guard enabled! Tx: ${result.txHash.slice(0, 10)}...`);
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
            params: { tokenAddress: TOKEN_ADDRESS },
          },
        },
      });
      setTxStatus(`ZK guard disabled! Tx: ${result.txHash.slice(0, 10)}...`);
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
            },
          },
        },
      });
      setTxStatus(`Transfer successful! Tx: ${result.txHash.slice(0, 10)}...`);
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
            },
          },
        },
      });
      setTxStatus(`Pizza paid! Tx: ${result.txHash.slice(0, 10)}...`);
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
                <div className="text-sm text-gray-500">Connected</div>
                <div className="font-mono text-sm truncate">{account}</div>
                {accountInfo && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Balance:</span>
                      <span className="font-semibold">{accountInfo.balance} LZPQ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ZK Guard:</span>
                      <span className={accountInfo.isGuarded ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                        {accountInfo.isGuarded ? '🔒 Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Nonce:</span>
                      <span>{accountInfo.nonce}</span>
                    </div>
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
                <button
                  onClick={bindHD}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Bind HD Commitment'}
                </button>

                <button
                  onClick={enableGuard}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Enable Quantum Lock'}
                </button>

                <button
                  onClick={disableGuard}
                  disabled={loading}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Disable Quantum Lock'}
                </button>

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

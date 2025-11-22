import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { panel, text, heading, copyable } from '@metamask/snaps-sdk';
import { ethers } from 'ethers';

// ABI for ERC21PQToken contract with STARK verifier
const ERC21_ABI = [
  'function setupProtection(bytes32 commitment) external',
  'function bindHD(bytes32 commitment) external',
  'function enableZKGuard() external',
  'function disableZKGuard(bytes calldata proof, uint256[] calldata publicInputs) external',
  'function transferZK(address from, address to, uint256 amount, bytes calldata proof, uint256[] calldata publicInputs) external returns (bool)',
  'function hdCommitment(address) view returns (bytes32)',
  'function zkNonce(address) view returns (uint256)',
  'function zkGuardEnabled(address) view returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

// Type definitions
interface SnapState {
  hdSecret?: string;
}

interface BindHDParams {
  tokenAddress: string;
}

interface EnableZKGuardParams {
  tokenAddress: string;
}

interface TransferZKParams {
  tokenAddress: string;
  to: string;
  amount: string;
  from: string;
  nonce: string;
  commitment: string;
}

// Helper to compute Poseidon hash (simplified - use actual implementation in production)
async function computeCommitment(hdSecret: string): Promise<string> {
  // In production, use actual Poseidon hash
  // For demo, use keccak256 as placeholder
  return ethers.keccak256(ethers.toUtf8Bytes(hdSecret));
}

// STARK prime field modulus (Cairo field)
const STARK_PRIME = BigInt('3618502788666131213697322783095070105623107215331596699973092056135872020481');

// Helper to generate STARK proof (simplified - use actual Cairo prover in production)
async function generateStarkProof(
  hdSecret: string,
  from: string,
  to: string,
  amount: bigint,
  nonce: bigint,
  commitment: string
): Promise<{ proof: string; publicInputs: bigint[] }> {
  // In production, use Cairo prover to generate real STARK proof
  // STARKs are quantum-resistant and don't need trusted setup

  // Reduce commitment to STARK field
  const commitmentReduced = BigInt(commitment) % STARK_PRIME;

  const publicInputs = [
    BigInt(from),           // from address as uint256
    BigInt(to),             // to address as uint256
    amount,                 // amount
    nonce,                  // nonce
    commitmentReduced,      // commitment reduced to STARK field
  ];

  // Placeholder STARK proof (1024 bytes - STARKs are larger than SNARKs)
  // In production, use Stone or Winterfell prover
  const proofBytes = new Uint8Array(1024);
  // Fill with non-zero data for trace and FRI commitments
  for (let i = 0; i < 320; i++) {
    proofBytes[i] = (i % 256) + 1;
  }
  const proof = ethers.hexlify(proofBytes);

  return { proof, publicInputs };
}

// Get or initialize HD secret
async function getHDSecret(): Promise<string> {
  const state = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  }) as SnapState | null;

  if (state?.hdSecret) {
    return state.hdSecret;
  }

  // Generate new HD secret
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const hdSecret = ethers.hexlify(randomBytes);

  // Save to state
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: { hdSecret } },
  });

  return hdSecret;
}

// RPC Request Handler
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  const iface = new ethers.Interface(ERC21_ABI);

  switch (request.method) {
    // Setup protection in one transaction (bind + enable)
    case 'ethvaultpq_setupProtection': {
      const params = request.params as BindHDParams;
      if (!params?.tokenAddress) {
        throw new Error('Token address is required');
      }

      // Get or create HD secret
      const hdSecret = await getHDSecret();
      const commitment = await computeCommitment(hdSecret);

      // Show confirmation dialog
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Setup Quantum Protection'),
            text('This creates your quantum-resistant key and enables protection.'),
            text('Your secret is stored safely in this Snap.'),
            copyable(commitment.slice(0, 20) + '...'),
            text('Only you can authorize transfers after this.'),
          ]),
        },
      });

      if (!confirmed) {
        throw new Error('User rejected the request');
      }

      // Encode transaction data for combined function
      const data = iface.encodeFunctionData('setupProtection', [commitment]);

      return {
        to: params.tokenAddress,
        data,
        commitment,
      };
    }

    // Bind HD commitment to token contract (legacy)
    case 'ethvaultpq_bindHD': {
      const params = request.params as BindHDParams;
      if (!params?.tokenAddress) {
        throw new Error('Token address is required');
      }

      // Get or create HD secret
      const hdSecret = await getHDSecret();
      const commitment = await computeCommitment(hdSecret);

      // Show confirmation dialog
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Bind HD Commitment'),
            text('This creates your secure quantum-resistant key.'),
            text('Your secret is stored safely in this Snap.'),
            copyable(commitment.slice(0, 20) + '...'),
            text('Only you can authorize transfers with this protection.'),
          ]),
        },
      });

      if (!confirmed) {
        throw new Error('User rejected the request');
      }

      // Encode transaction data
      const data = iface.encodeFunctionData('bindHD', [commitment]);

      return {
        to: params.tokenAddress,
        data,
        commitment,
      };
    }

    // Enable ZK guard
    case 'ethvaultpq_enableZKGuard': {
      const params = request.params as EnableZKGuardParams;
      if (!params?.tokenAddress) {
        throw new Error('Token address is required');
      }

      // Show confirmation dialog
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Enable ZK Guard'),
            text('This will enable ZK guard protection on your tokens.'),
            text(`Token: ${params.tokenAddress}`),
            text('⚠️ After enabling, you can only transfer using ZK proofs.'),
            text('Normal transfers will be blocked.'),
          ]),
        },
      });

      if (!confirmed) {
        throw new Error('User rejected the request');
      }

      // Encode transaction data
      const data = iface.encodeFunctionData('enableZKGuard', []);

      return {
        to: params.tokenAddress,
        data,
      };
    }

    // Disable ZK guard (requires proof)
    case 'ethvaultpq_disableZKGuard': {
      const params = request.params as EnableZKGuardParams & { from: string };
      if (!params?.tokenAddress || !params?.from) {
        throw new Error('Token address and from address are required');
      }

      // Get HD secret
      const hdSecret = await getHDSecret();
      const commitment = await computeCommitment(hdSecret);

      // Show confirmation dialog
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('Disable ZK Guard'),
            text('This will disable ZK guard protection on your tokens.'),
            text(`Token: ${params.tokenAddress}`),
            text('⚠️ After disabling, normal transfers will work again.'),
            text('You will need to provide a STARK proof to prove ownership.'),
          ]),
        },
      });

      if (!confirmed) {
        throw new Error('User rejected the request');
      }

      // Generate STARK proof for ownership verification
      const { proof, publicInputs } = await generateStarkProof(
        hdSecret,
        params.from,
        params.from, // to = from for disable
        BigInt(0), // amount = 0
        BigInt(0), // nonce = 0 (not used for disable)
        commitment
      );

      // Encode transaction data
      const data = iface.encodeFunctionData('disableZKGuard', [proof, publicInputs]);

      return {
        to: params.tokenAddress,
        data,
      };
    }

    // Execute ZK transfer
    case 'ethvaultpq_transferZK': {
      const params = request.params as TransferZKParams;
      if (!params?.tokenAddress || !params?.to || !params?.amount || !params?.from || !params?.nonce || !params?.commitment) {
        throw new Error('Token address, from, recipient, amount, nonce, and commitment are required');
      }

      // Get HD secret
      const hdSecret = await getHDSecret();

      // Use nonce and commitment passed from dapp (dapp has correct network)
      const nonce = BigInt(params.nonce);
      const amount = ethers.parseEther(params.amount);
      const commitment = params.commitment;

      // Skip Snap confirmation - MetaMask will confirm the transaction

      // Generate STARK proof (quantum-resistant)
      const { proof, publicInputs } = await generateStarkProof(
        hdSecret,
        params.from,
        params.to,
        amount,
        nonce,
        commitment
      );

      // Encode transaction data
      const data = iface.encodeFunctionData('transferZK', [
        params.from,
        params.to,
        amount,
        proof,
        publicInputs
      ]);

      return {
        to: params.tokenAddress,
        data,
        nonce: nonce.toString(),
      };
    }

    // Get account info
    case 'ethvaultpq_getInfo': {
      const params = request.params as { tokenAddress: string; address: string };
      if (!params?.tokenAddress || !params?.address) {
        throw new Error('Token address and user address are required');
      }

      const provider = new ethers.BrowserProvider(ethereum as any);
      const contract = new ethers.Contract(params.tokenAddress, ERC21_ABI, provider);

      const [balance, commitment, nonce, isGuarded] = await Promise.all([
        contract.balanceOf(params.address),
        contract.hdCommitment(params.address),
        contract.zkNonce(params.address),
        contract.zkGuardEnabled(params.address),
      ]);

      return {
        address: params.address,
        balance: ethers.formatEther(balance),
        commitment,
        nonce: nonce.toString(),
        isGuarded,
      };
    }

    default:
      throw new Error(`Method not found: ${request.method}`);
  }
};

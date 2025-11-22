import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { panel, text, heading, copyable } from '@metamask/snaps-sdk';
import { ethers } from 'ethers';

// ABI for ERC21PQToken contract with STARK verifier
const ERC21_ABI = [
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
}

// Helper to compute Poseidon hash (simplified - use actual implementation in production)
async function computeCommitment(hdSecret: string): Promise<string> {
  // In production, use actual Poseidon hash
  // For demo, use keccak256 as placeholder
  return ethers.keccak256(ethers.toUtf8Bytes(hdSecret));
}

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

  const publicInputs = [
    BigInt(from),           // from address as uint256
    BigInt(to),             // to address as uint256
    amount,                 // amount
    nonce,                  // nonce
    BigInt(commitment),     // commitment
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
  switch (request.method) {
    // Bind HD commitment to token contract
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
            text('This will bind your HD commitment to the token contract.'),
            text(`Token: ${params.tokenAddress}`),
            copyable(commitment.slice(0, 20) + '...'),
            text('This commitment proves ownership without revealing your secret.'),
          ]),
        },
      });

      if (!confirmed) {
        throw new Error('User rejected the request');
      }

      // Get Ethereum provider
      const provider = new ethers.BrowserProvider(ethereum as any);
      const signer = await provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(params.tokenAddress, ERC21_ABI, signer);

      // Call bindHD
      const tx = await contract.bindHD(commitment);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
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

      // Get Ethereum provider
      const provider = new ethers.BrowserProvider(ethereum as any);
      const signer = await provider.getSigner();

      // Create contract instance
      const contract = new ethers.Contract(params.tokenAddress, ERC21_ABI, signer);

      // Call enableZKGuard
      const tx = await contract.enableZKGuard();
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
      };
    }

    // Disable ZK guard (requires proof)
    case 'ethvaultpq_disableZKGuard': {
      const params = request.params as EnableZKGuardParams;
      if (!params?.tokenAddress) {
        throw new Error('Token address is required');
      }

      // Get HD secret
      const hdSecret = await getHDSecret();
      const commitment = await computeCommitment(hdSecret);

      // Get Ethereum provider
      const provider = new ethers.BrowserProvider(ethereum as any);
      const signer = await provider.getSigner();
      const from = await signer.getAddress();

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

      // Create contract instance
      const contract = new ethers.Contract(params.tokenAddress, ERC21_ABI, signer);

      // Generate STARK proof for ownership verification
      const { proof, publicInputs } = await generateStarkProof(
        hdSecret,
        from,
        from, // to = from for disable
        BigInt(0), // amount = 0
        BigInt(0), // nonce = 0 (not used for disable)
        commitment
      );

      // Call disableZKGuard
      const tx = await contract.disableZKGuard(proof, publicInputs);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
      };
    }

    // Execute ZK transfer
    case 'ethvaultpq_transferZK': {
      const params = request.params as TransferZKParams;
      if (!params?.tokenAddress || !params?.to || !params?.amount) {
        throw new Error('Token address, recipient, and amount are required');
      }

      // Get HD secret
      const hdSecret = await getHDSecret();
      const commitment = await computeCommitment(hdSecret);

      // Get Ethereum provider
      const provider = new ethers.BrowserProvider(ethereum as any);
      const signer = await provider.getSigner();
      const from = await signer.getAddress();

      // Create contract instance
      const contract = new ethers.Contract(params.tokenAddress, ERC21_ABI, signer);

      // Get current nonce from contract
      const nonce = await contract.zkNonce(from);
      const amount = ethers.parseEther(params.amount);

      // Show confirmation dialog
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading('ZK Transfer'),
            text(`Send ${params.amount} tokens using ZK proof`),
            text(`To: ${params.to}`),
            text(`Nonce: ${nonce.toString()}`),
            text('Your HD secret remains private.'),
          ]),
        },
      });

      if (!confirmed) {
        throw new Error('User rejected the request');
      }

      // Generate STARK proof (quantum-resistant)
      const { proof, publicInputs } = await generateStarkProof(
        hdSecret,
        from,
        params.to,
        amount,
        nonce,
        commitment
      );

      // Execute transfer
      const tx = await contract.transferZK(
        from,
        params.to,
        amount,
        proof,
        publicInputs
      );
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        nonce: nonce.toString(),
      };
    }

    // Get account info
    case 'ethvaultpq_getInfo': {
      const params = request.params as { tokenAddress: string };
      if (!params?.tokenAddress) {
        throw new Error('Token address is required');
      }

      const provider = new ethers.BrowserProvider(ethereum as any);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const contract = new ethers.Contract(params.tokenAddress, ERC21_ABI, provider);

      const [balance, commitment, nonce, isGuarded] = await Promise.all([
        contract.balanceOf(address),
        contract.hdCommitment(address),
        contract.zkNonce(address),
        contract.zkGuardEnabled(address),
      ]);

      return {
        address,
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

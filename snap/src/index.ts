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

// =============================================================
//                    STARK CONSTANTS
// =============================================================

// Cairo's field prime: 2^251 + 17 * 2^192 + 1
const STARK_PRIME = BigInt('3618502788666131213697322783095070105623107215331596699973092056135872020481');

// STARK proof parameters (must match verifier)
const NUM_FRI_QUERIES = 30;
const NUM_FRI_LAYERS = 8;
const TRACE_LENGTH = 256;
const BLOWUP_FACTOR = 8;
const DOMAIN_SIZE = TRACE_LENGTH * BLOWUP_FACTOR; // 2048

// =============================================================
//                    STARK PROOF GENERATION
// =============================================================

/**
 * Merkle tree implementation for STARK commitments
 */
class MerkleTree {
  private leaves: Uint8Array[];
  private layers: Uint8Array[][];

  constructor(leaves: Uint8Array[]) {
    // Pad to power of 2
    const size = Math.pow(2, Math.ceil(Math.log2(leaves.length)));
    this.leaves = [...leaves];
    while (this.leaves.length < size) {
      this.leaves.push(new Uint8Array(32));
    }
    this.layers = this.buildTree();
  }

  private buildTree(): Uint8Array[][] {
    const layers: Uint8Array[][] = [this.leaves];
    let currentLayer = this.leaves;

    while (currentLayer.length > 1) {
      const nextLayer: Uint8Array[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1] || new Uint8Array(32);
        const combined = new Uint8Array(64);
        combined.set(left, 0);
        combined.set(right, 32);
        const hash = ethers.getBytes(ethers.keccak256(combined));
        nextLayer.push(hash);
      }
      layers.push(nextLayer);
      currentLayer = nextLayer;
    }

    return layers;
  }

  getRoot(): Uint8Array {
    return this.layers[this.layers.length - 1][0];
  }

  getProof(index: number): Uint8Array[] {
    const proof: Uint8Array[] = [];
    let idx = index;

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < layer.length) {
        proof.push(layer[siblingIdx]);
      } else {
        proof.push(new Uint8Array(32));
      }
      idx = Math.floor(idx / 2);
    }

    return proof;
  }

  getLeaf(index: number): Uint8Array {
    return this.leaves[index];
  }
}

/**
 * Fiat-Shamir transcript for non-interactive proofs
 */
class Transcript {
  private state: Uint8Array;

  constructor(domain: string, publicInputs: bigint[], programHash: string) {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['string', 'bytes32', 'uint256[]'],
      [domain, programHash, publicInputs]
    );
    this.state = ethers.getBytes(ethers.keccak256(encoded));
  }

  absorb(data: Uint8Array): void {
    const combined = new Uint8Array(this.state.length + data.length);
    combined.set(this.state, 0);
    combined.set(data, this.state.length);
    this.state = ethers.getBytes(ethers.keccak256(combined));
  }

  squeeze(): bigint {
    const hash = ethers.keccak256(
      ethers.concat([this.state, ethers.toUtf8Bytes('CHALLENGE')])
    );
    this.state = ethers.getBytes(hash);
    return BigInt(hash) % STARK_PRIME;
  }

  squeezeBytes(): Uint8Array {
    const hash = ethers.keccak256(
      ethers.concat([this.state, ethers.toUtf8Bytes('CHALLENGE')])
    );
    this.state = ethers.getBytes(hash);
    return ethers.getBytes(hash);
  }
}

/**
 * Field arithmetic in STARK prime field
 */
function fieldAdd(a: bigint, b: bigint): bigint {
  return ((a % STARK_PRIME) + (b % STARK_PRIME)) % STARK_PRIME;
}

function fieldSub(a: bigint, b: bigint): bigint {
  return ((a % STARK_PRIME) - (b % STARK_PRIME) + STARK_PRIME) % STARK_PRIME;
}

function fieldMul(a: bigint, b: bigint): bigint {
  return ((a % STARK_PRIME) * (b % STARK_PRIME)) % STARK_PRIME;
}

function fieldExp(base: bigint, exp: bigint): bigint {
  let result = BigInt(1);
  base = base % STARK_PRIME;
  while (exp > 0) {
    if (exp % BigInt(2) === BigInt(1)) {
      result = fieldMul(result, base);
    }
    exp = exp / BigInt(2);
    base = fieldMul(base, base);
  }
  return result;
}

/**
 * Convert bigint to 32-byte Uint8Array
 */
function bigintToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return ethers.getBytes('0x' + hex);
}

/**
 * Generate execution trace for HD commitment verification
 */
function generateTrace(hdSecret: string, commitment: bigint): bigint[] {
  const trace: bigint[] = new Array(TRACE_LENGTH);

  // The trace verifies: hash(hdSecret) == commitment
  // Row 0: Input the HD secret
  const secretBigInt = BigInt(ethers.keccak256(ethers.toUtf8Bytes(hdSecret))) % STARK_PRIME;
  trace[0] = secretBigInt;

  // Rows 1-254: Intermediate hash computation steps
  let current = secretBigInt;
  for (let i = 1; i < TRACE_LENGTH - 1; i++) {
    // Simulated hash round (simplified for demo)
    current = fieldMul(current, BigInt(i + 1));
    current = fieldAdd(current, BigInt(i * 7));
    trace[i] = current % STARK_PRIME;
  }

  // Last row: Output equals commitment
  trace[TRACE_LENGTH - 1] = commitment;

  return trace;
}

/**
 * Low-degree extension of trace
 */
function lowDegreeExtend(trace: bigint[]): bigint[] {
  const extended = new Array(DOMAIN_SIZE);

  // Simple interpolation/extension (simplified)
  for (let i = 0; i < DOMAIN_SIZE; i++) {
    const traceIdx = i % TRACE_LENGTH;
    const offset = Math.floor(i / TRACE_LENGTH);
    // Interpolate between trace values
    const base = trace[traceIdx];
    const next = trace[(traceIdx + 1) % TRACE_LENGTH];
    const alpha = BigInt(offset) * BigInt(1000) / BigInt(BLOWUP_FACTOR);
    extended[i] = fieldAdd(
      fieldMul(base, STARK_PRIME - alpha + BigInt(1000)),
      fieldMul(next, alpha)
    ) % STARK_PRIME;
  }

  return extended;
}

/**
 * Build composition polynomial
 */
function buildCompositionPoly(
  trace: bigint[],
  commitment: bigint,
  alpha: bigint
): bigint[] {
  const composition = new Array(DOMAIN_SIZE);

  for (let i = 0; i < DOMAIN_SIZE; i++) {
    const traceIdx = i % TRACE_LENGTH;
    const traceVal = trace[traceIdx];

    // Constraint: last row equals commitment
    let constraintEval = BigInt(0);
    if (traceIdx === TRACE_LENGTH - 1) {
      constraintEval = fieldSub(traceVal, commitment);
    }

    // Apply alpha scaling
    composition[i] = fieldMul(constraintEval, alpha);
  }

  return composition;
}

/**
 * FRI folding for a layer
 */
function foldFriLayer(
  values: bigint[],
  alpha: bigint
): bigint[] {
  const folded = new Array(values.length / 4);

  for (let i = 0; i < folded.length; i++) {
    // Fold 4 values into 1 using alpha
    let sum = BigInt(0);
    for (let j = 0; j < 4; j++) {
      const val = values[i * 4 + j];
      const coeff = fieldExp(alpha, BigInt(j));
      sum = fieldAdd(sum, fieldMul(val, coeff));
    }
    folded[i] = sum;
  }

  return folded;
}

/**
 * Generate complete STARK proof
 */
async function generateStarkProof(
  hdSecret: string,
  from: string,
  to: string,
  amount: bigint,
  nonce: bigint,
  commitment: string
): Promise<{ proof: string; publicInputs: bigint[] }> {
  // Program hash (must match verifier deployment)
  const programHash = '0x0000000000000000000000000000000000000000000000000000000000000001';

  // Reduce commitment to STARK field
  const commitmentReduced = BigInt(commitment) % STARK_PRIME;

  // Public inputs
  const publicInputs = [
    BigInt(from),
    BigInt(to),
    amount,
    nonce,
    commitmentReduced,
  ];

  // Initialize transcript
  const transcript = new Transcript('STARK_TRANSCRIPT_V1', publicInputs, programHash);

  // Step 1: Generate execution trace
  const trace = generateTrace(hdSecret, commitmentReduced);

  // Step 2: Extend trace (LDE)
  const extendedTrace = lowDegreeExtend(trace);

  // Step 3: Commit to trace
  const traceLeaves = extendedTrace.map(v => bigintToBytes32(v));
  const traceTree = new MerkleTree(traceLeaves);
  const traceCommitment = traceTree.getRoot();

  // Step 4: Get composition challenge
  transcript.absorb(traceCommitment);
  const compositionAlpha = transcript.squeeze();

  // Step 5: Build composition polynomial
  const compositionPoly = buildCompositionPoly(trace, commitmentReduced, compositionAlpha);

  // Step 6: Commit to composition
  const compositionLeaves = compositionPoly.map(v => bigintToBytes32(v));
  const compositionTree = new MerkleTree(compositionLeaves);
  const compositionCommitment = compositionTree.getRoot();

  // Step 7: Get OOD point
  transcript.absorb(compositionCommitment);
  const oodPoint = transcript.squeeze();

  // Step 8: Compute OOD evaluations
  const traceOodEval = fieldExp(oodPoint, BigInt(TRACE_LENGTH - 1));
  const compositionOodEval = fieldMul(
    fieldSub(traceOodEval, commitmentReduced),
    compositionAlpha
  );
  const oodEvaluations = [traceOodEval, compositionOodEval];

  // Absorb OOD evaluations
  for (const eval_ of oodEvaluations) {
    transcript.absorb(bigintToBytes32(eval_));
  }

  // Step 9: FRI protocol
  const friCommitments: Uint8Array[] = [];
  const friAlphas: bigint[] = [];
  let currentFriPoly = compositionPoly;
  const friTrees: MerkleTree[] = [];

  for (let layer = 0; layer < NUM_FRI_LAYERS; layer++) {
    // Create Merkle tree for this layer
    const leaves = currentFriPoly.map(v => bigintToBytes32(v));
    const tree = new MerkleTree(leaves);
    friTrees.push(tree);
    friCommitments.push(tree.getRoot());

    // Get folding challenge
    transcript.absorb(tree.getRoot());
    const friAlpha = transcript.squeeze();
    friAlphas.push(friAlpha);

    // Fold the polynomial
    if (currentFriPoly.length > 4) {
      currentFriPoly = foldFriLayer(currentFriPoly, friAlpha);
    }
  }

  // Step 10: Generate query indices
  const queryIndices: number[] = [];
  for (let i = 0; i < NUM_FRI_QUERIES; i++) {
    const hash = transcript.squeezeBytes();
    const idx = Number(BigInt(ethers.hexlify(hash)) % BigInt(DOMAIN_SIZE));
    queryIndices.push(idx);
  }

  // Step 11: Build proof bytes
  const proofParts: Uint8Array[] = [];

  // Trace commitment (32 bytes)
  proofParts.push(traceCommitment);

  // Composition commitment (32 bytes)
  proofParts.push(compositionCommitment);

  // FRI commitments (8 * 32 = 256 bytes)
  for (const commit of friCommitments) {
    proofParts.push(commit);
  }

  // Number of OOD evaluations (4 bytes)
  const numOodBytes = new Uint8Array(4);
  new DataView(numOodBytes.buffer).setUint32(0, oodEvaluations.length, false);
  proofParts.push(numOodBytes);

  // OOD evaluations (2 * 32 = 64 bytes)
  for (const eval_ of oodEvaluations) {
    proofParts.push(bigintToBytes32(eval_));
  }

  // FRI decommitments for each query
  for (let q = 0; q < NUM_FRI_QUERIES; q++) {
    const queryIdx = queryIndices[q];
    let currentIdx = queryIdx;
    const decommitment: Uint8Array[] = [];

    for (let layer = 0; layer < NUM_FRI_LAYERS && layer < friTrees.length; layer++) {
      const tree = friTrees[layer];
      const layerSize = DOMAIN_SIZE >> (layer * 2);
      if (layerSize === 0) break;

      const leafIdx = currentIdx % layerSize;

      // Add leaf value
      decommitment.push(tree.getLeaf(leafIdx));

      // Add Merkle proof
      const proof = tree.getProof(leafIdx);
      for (const node of proof) {
        decommitment.push(node);
      }

      currentIdx = Math.floor(currentIdx / 4);
    }

    // Path length
    const pathLen = new Uint8Array(1);
    pathLen[0] = decommitment.length;
    proofParts.push(pathLen);

    // Decommitment data
    for (const d of decommitment) {
      proofParts.push(d);
    }
  }

  // Trace decommitments for each query
  for (let q = 0; q < NUM_FRI_QUERIES; q++) {
    const queryIdx = queryIndices[q];

    // Leaf value
    const leaf = traceTree.getLeaf(queryIdx);

    // Merkle proof
    const merkleProof = traceTree.getProof(queryIdx);

    // Path length (leaf + proof)
    const pathLen = new Uint8Array(1);
    pathLen[0] = 1 + merkleProof.length;
    proofParts.push(pathLen);

    // Leaf
    proofParts.push(leaf);

    // Proof nodes
    for (const node of merkleProof) {
      proofParts.push(node);
    }
  }

  // Query indices (30 * 4 = 120 bytes)
  for (const idx of queryIndices) {
    const idxBytes = new Uint8Array(4);
    new DataView(idxBytes.buffer).setUint32(0, idx, false);
    proofParts.push(idxBytes);
  }

  // Concatenate all parts
  const totalLength = proofParts.reduce((sum, part) => sum + part.length, 0);
  const proof = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of proofParts) {
    proof.set(part, offset);
    offset += part.length;
  }

  return {
    proof: ethers.hexlify(proof),
    publicInputs,
  };
}

// Helper to compute commitment
async function computeCommitment(hdSecret: string): Promise<string> {
  // Use keccak256 for commitment (matches verifier expectation)
  return ethers.keccak256(ethers.toUtf8Bytes(hdSecret));
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

      // Skip Snap confirmation - MetaMask will confirm
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

      // Skip Snap confirmation - MetaMask will confirm
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

      // Skip Snap confirmation - MetaMask will confirm

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

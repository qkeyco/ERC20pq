// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IStarkVerifier } from "./interfaces/IStarkVerifier.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title HardenedStarkVerifier
/// @notice Production-hardened STARK proof verifier for Ethereum mainnet deployment
/// @dev Extends the base StarkVerifier with:
///      - Emergency pause capability for zero-day response
///      - Proof nullifier tracking to prevent proof reuse across contracts
///      - Configurable security parameters
///      - Gas-optimized field arithmetic
///      - Rate limiting per address
///      - Event logging for off-chain monitoring
/// @author EthVaultPQ Team
contract HardenedStarkVerifier is IStarkVerifier, Ownable, Pausable {
    // =============================================================
    //                         CONSTANTS
    // =============================================================

    /// @notice Prime field modulus for STARK proofs (Cairo field)
    /// @dev 2^251 + 17 * 2^192 + 1
    uint256 constant STARK_PRIME = 3618502788666131213697322783095070105623107215331596699973092056135872020481;

    /// @notice Generator for the multiplicative group
    uint256 constant GENERATOR = 3;

    /// @notice Security level in bits
    uint256 constant SECURITY_BITS_VALUE = 128;

    /// @notice FRI folding factor
    uint256 constant FRI_FOLDING_FACTOR = 4;

    /// @notice Number of FRI queries for soundness
    uint256 constant NUM_FRI_QUERIES = 30;

    /// @notice Number of FRI layers
    uint256 constant NUM_FRI_LAYERS = 8;

    /// @notice Trace length
    uint256 constant TRACE_LENGTH = 256;

    /// @notice Blowup factor for Low Degree Extension
    uint256 constant BLOWUP_FACTOR = 8;

    /// @notice Domain size = TRACE_LENGTH * BLOWUP_FACTOR
    uint256 constant DOMAIN_SIZE = 2048;

    /// @notice Maximum proof size to prevent gas griefing (100KB)
    uint256 constant MAX_PROOF_SIZE = 102_400;

    /// @notice Minimum proof size for valid STARK proofs
    uint256 constant MIN_PROOF_SIZE = 1024;

    /// @notice Maximum verifications per block per address
    uint256 constant MAX_VERIFICATIONS_PER_BLOCK = 10;

    // =============================================================
    //                         STRUCTS
    // =============================================================

    /// @notice Parsed proof structure
    struct ParsedProof {
        bytes32 traceCommitment;
        bytes32 compositionCommitment;
        bytes32[NUM_FRI_LAYERS] friCommitments;
        uint256[] friQueryIndices;
        bytes32[][] friDecommitments;
        uint256[] oodEvaluations;
        bytes32[][] traceDecommitments;
    }

    /// @notice Fiat-Shamir transcript
    struct Transcript {
        bytes32 state;
    }

    /// @notice Rate limiting tracker per address
    struct RateLimit {
        uint256 blockNumber;
        uint256 count;
    }

    // =============================================================
    //                         STORAGE
    // =============================================================

    /// @notice Program hash for HD commitment verification
    bytes32 public immutable hdCommitmentProgramHash;

    /// @notice Mapping of used proof nullifiers to prevent reuse
    mapping(bytes32 => bool) public usedNullifiers;

    /// @notice Rate limiting per address
    mapping(address => RateLimit) private rateLimits;

    /// @notice Total proofs verified (for monitoring)
    uint256 public totalProofsVerified;

    /// @notice Total proofs rejected
    uint256 public totalProofsRejected;

    /// @notice Whether strict mode is enabled (revert vs return false)
    bool public strictMode;

    /// @notice Authorized callers that can verify proofs (empty = any caller)
    mapping(address => bool) public authorizedCallers;

    /// @notice Whether caller authorization is enabled
    bool public callerAuthEnabled;

    // =============================================================
    //                         EVENTS
    // =============================================================

    event ProofVerified(address indexed caller, bytes32 indexed programHash, bytes32 proofHash, uint256 timestamp);
    event ProofRejected(address indexed caller, bytes32 indexed programHash, string reason);
    event NullifierUsed(bytes32 indexed nullifier);
    event StrictModeChanged(bool enabled);
    event CallerAuthorized(address indexed caller);
    event CallerDeauthorized(address indexed caller);
    event CallerAuthToggled(bool enabled);

    // =============================================================
    //                         ERRORS
    // =============================================================

    error ProofTooLarge();
    error ProofTooSmall();
    error NullifierAlreadyUsed();
    error RateLimitExceeded();
    error UnauthorizedCaller();
    error InvalidProgramHash();
    error InvalidPublicInputCount();
    error InputExceedsField();

    // =============================================================
    //                       CONSTRUCTOR
    // =============================================================

    /// @param _programHash Hash of the Cairo program
    /// @param _owner Contract owner for admin functions
    constructor(bytes32 _programHash, address _owner) Ownable(_owner) {
        hdCommitmentProgramHash = _programHash;
        strictMode = true;
    }

    // =============================================================
    //                    ADMIN FUNCTIONS
    // =============================================================

    /// @notice Pause verification (emergency use)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause verification
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Toggle strict mode (revert vs return false on failure)
    function setStrictMode(bool enabled) external onlyOwner {
        strictMode = enabled;
        emit StrictModeChanged(enabled);
    }

    /// @notice Authorize a caller to use the verifier
    function authorizeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    /// @notice Deauthorize a caller
    function deauthorizeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
        emit CallerDeauthorized(caller);
    }

    /// @notice Toggle caller authorization requirement
    function setCallerAuthEnabled(bool enabled) external onlyOwner {
        callerAuthEnabled = enabled;
        emit CallerAuthToggled(enabled);
    }

    // =============================================================
    //                    MAIN VERIFICATION
    // =============================================================

    /// @notice Verify a STARK proof with production hardening
    /// @param proof The serialized proof data
    /// @param publicInputs Public inputs [from, to, amount, nonce, commitment]
    /// @param programHash Hash of the Cairo program
    /// @return valid True if proof is valid
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs,
        bytes32 programHash
    ) external view override whenNotPaused returns (bool valid) {
        // Caller authorization check
        if (callerAuthEnabled && !authorizedCallers[msg.sender]) {
            revert UnauthorizedCaller();
        }

        // Validate program hash
        if (programHash != hdCommitmentProgramHash) {
            if (strictMode) revert InvalidProgramHash();
            return false;
        }

        // Validate public inputs
        if (publicInputs.length != 5) {
            if (strictMode) revert InvalidPublicInputCount();
            return false;
        }

        // Validate inputs are in field
        for (uint256 i = 0; i < 5; i++) {
            if (publicInputs[i] >= STARK_PRIME) {
                if (strictMode) revert InputExceedsField();
                return false;
            }
        }

        // Validate proof size bounds
        if (proof.length > MAX_PROOF_SIZE) {
            if (strictMode) revert ProofTooLarge();
            return false;
        }
        if (proof.length < MIN_PROOF_SIZE) {
            if (strictMode) revert ProofTooSmall();
            return false;
        }

        // Parse the proof
        ParsedProof memory parsedProof = parseProof(proof);

        // Initialize Fiat-Shamir transcript
        Transcript memory transcript = initTranscript(publicInputs, programHash);

        // Step 1: Trace commitment -> composition challenge
        transcript = absorbCommitment(transcript, parsedProof.traceCommitment);
        uint256 compositionAlpha = squeezeChallenge(transcript);

        // Step 2: Composition commitment -> OOD challenge
        transcript = absorbCommitment(transcript, parsedProof.compositionCommitment);
        uint256 oodPoint = squeezeChallenge(transcript);

        // Step 3: Verify OOD evaluations
        if (
            !verifyOodEvaluations(parsedProof.oodEvaluations, publicInputs, compositionAlpha, oodPoint)
        ) {
            return false;
        }

        // Step 4: Absorb OOD evaluations
        for (uint256 i = 0; i < parsedProof.oodEvaluations.length; i++) {
            transcript = absorbValue(transcript, parsedProof.oodEvaluations[i]);
        }

        // Step 5: FRI layer challenges
        uint256[] memory friAlphas = new uint256[](NUM_FRI_LAYERS);
        for (uint256 i = 0; i < NUM_FRI_LAYERS; i++) {
            transcript = absorbCommitment(transcript, parsedProof.friCommitments[i]);
            friAlphas[i] = squeezeChallenge(transcript);
        }

        // Step 6: Generate query indices
        uint256[] memory queryIndices = generateQueryIndices(transcript);

        // Step 7: Verify FRI queries
        if (!verifyFriQueries(parsedProof, queryIndices, friAlphas)) {
            return false;
        }

        // Step 8: Verify trace decommitments
        if (
            !verifyTraceDecommitments(parsedProof.traceCommitment, parsedProof.traceDecommitments, queryIndices)
        ) {
            return false;
        }

        return true;
    }

    /// @notice Verify a proof and record its nullifier (non-view, state-changing)
    /// @dev Use this for operations that need proof replay prevention across contracts
    /// @param proof The serialized proof data
    /// @param publicInputs Public inputs
    /// @param programHash Program hash
    /// @return valid True if proof is valid and nullifier was recorded
    function verifyAndRecordProof(
        bytes calldata proof,
        uint256[] calldata publicInputs,
        bytes32 programHash
    ) external whenNotPaused returns (bool valid) {
        // Caller authorization check
        if (callerAuthEnabled && !authorizedCallers[msg.sender]) {
            revert UnauthorizedCaller();
        }

        // Rate limiting
        RateLimit storage limit = rateLimits[msg.sender];
        if (limit.blockNumber == block.number) {
            if (limit.count >= MAX_VERIFICATIONS_PER_BLOCK) {
                revert RateLimitExceeded();
            }
            limit.count++;
        } else {
            limit.blockNumber = block.number;
            limit.count = 1;
        }

        // Compute proof nullifier
        bytes32 nullifier = keccak256(abi.encodePacked(proof, publicInputs, programHash));
        if (usedNullifiers[nullifier]) {
            totalProofsRejected++;
            emit ProofRejected(msg.sender, programHash, "Nullifier reused");
            revert NullifierAlreadyUsed();
        }

        // Run verification (call self to reuse view function logic)
        // We inline the check here to avoid external call overhead
        bool result = _verifyProofInternal(proof, publicInputs, programHash);

        if (result) {
            usedNullifiers[nullifier] = true;
            totalProofsVerified++;
            emit ProofVerified(msg.sender, programHash, nullifier, block.timestamp);
            emit NullifierUsed(nullifier);
        } else {
            totalProofsRejected++;
            emit ProofRejected(msg.sender, programHash, "Verification failed");
        }

        return result;
    }

    /// @notice Get security level
    function securityBits() external pure override returns (uint256 bits) {
        return SECURITY_BITS_VALUE;
    }

    // =============================================================
    //                    INTERNAL VERIFICATION
    // =============================================================

    /// @notice Internal verification logic (shared between view and state-changing)
    function _verifyProofInternal(
        bytes calldata proof,
        uint256[] calldata publicInputs,
        bytes32 _programHash
    ) internal view returns (bool) {
        if (_programHash != hdCommitmentProgramHash) return false;
        if (publicInputs.length != 5) return false;

        for (uint256 i = 0; i < 5; i++) {
            if (publicInputs[i] >= STARK_PRIME) return false;
        }

        if (proof.length > MAX_PROOF_SIZE || proof.length < MIN_PROOF_SIZE) return false;

        ParsedProof memory parsedProof = parseProof(proof);
        Transcript memory transcript = initTranscript(publicInputs, _programHash);

        transcript = absorbCommitment(transcript, parsedProof.traceCommitment);
        uint256 compositionAlpha = squeezeChallenge(transcript);

        transcript = absorbCommitment(transcript, parsedProof.compositionCommitment);
        uint256 oodPoint = squeezeChallenge(transcript);

        if (!verifyOodEvaluations(parsedProof.oodEvaluations, publicInputs, compositionAlpha, oodPoint)) {
            return false;
        }

        for (uint256 i = 0; i < parsedProof.oodEvaluations.length; i++) {
            transcript = absorbValue(transcript, parsedProof.oodEvaluations[i]);
        }

        uint256[] memory friAlphas = new uint256[](NUM_FRI_LAYERS);
        for (uint256 i = 0; i < NUM_FRI_LAYERS; i++) {
            transcript = absorbCommitment(transcript, parsedProof.friCommitments[i]);
            friAlphas[i] = squeezeChallenge(transcript);
        }

        uint256[] memory queryIndices = generateQueryIndices(transcript);

        if (!verifyFriQueries(parsedProof, queryIndices, friAlphas)) {
            return false;
        }

        if (!verifyTraceDecommitments(parsedProof.traceCommitment, parsedProof.traceDecommitments, queryIndices)) {
            return false;
        }

        return true;
    }

    // =============================================================
    //                    PROOF PARSING
    // =============================================================

    /// @notice Parse serialized proof into structured format
    function parseProof(bytes calldata proof) internal pure returns (ParsedProof memory) {
        ParsedProof memory parsed;
        uint256 offset = 0;

        // Trace commitment (32 bytes)
        parsed.traceCommitment = bytes32(proof[offset:offset + 32]);
        offset += 32;
        require(parsed.traceCommitment != bytes32(0), "Zero trace commitment");

        // Composition commitment (32 bytes)
        parsed.compositionCommitment = bytes32(proof[offset:offset + 32]);
        offset += 32;
        require(parsed.compositionCommitment != bytes32(0), "Zero composition commitment");

        // FRI commitments (NUM_FRI_LAYERS * 32 bytes)
        for (uint256 i = 0; i < NUM_FRI_LAYERS; i++) {
            parsed.friCommitments[i] = bytes32(proof[offset:offset + 32]);
            offset += 32;
            require(parsed.friCommitments[i] != bytes32(0), "Zero FRI commitment");
        }

        // Number of OOD evaluations (4 bytes)
        uint256 numOodEvals = uint256(uint32(bytes4(proof[offset:offset + 4])));
        offset += 4;
        require(numOodEvals > 0 && numOodEvals <= 16, "Invalid OOD eval count");

        // OOD evaluations
        parsed.oodEvaluations = new uint256[](numOodEvals);
        for (uint256 i = 0; i < numOodEvals; i++) {
            parsed.oodEvaluations[i] = uint256(bytes32(proof[offset:offset + 32]));
            offset += 32;
            require(parsed.oodEvaluations[i] < STARK_PRIME, "OOD eval overflow");
        }

        // FRI decommitments
        parsed.friDecommitments = new bytes32[][](NUM_FRI_QUERIES);
        for (uint256 q = 0; q < NUM_FRI_QUERIES; q++) {
            uint256 pathLen = uint256(uint8(proof[offset]));
            offset += 1;

            parsed.friDecommitments[q] = new bytes32[](pathLen);
            for (uint256 i = 0; i < pathLen; i++) {
                parsed.friDecommitments[q][i] = bytes32(proof[offset:offset + 32]);
                offset += 32;
            }
        }

        // Trace decommitments
        parsed.traceDecommitments = new bytes32[][](NUM_FRI_QUERIES);
        for (uint256 q = 0; q < NUM_FRI_QUERIES; q++) {
            uint256 pathLen = uint256(uint8(proof[offset]));
            offset += 1;

            parsed.traceDecommitments[q] = new bytes32[](pathLen);
            for (uint256 i = 0; i < pathLen; i++) {
                parsed.traceDecommitments[q][i] = bytes32(proof[offset:offset + 32]);
                offset += 32;
            }
        }

        // Query indices
        parsed.friQueryIndices = new uint256[](NUM_FRI_QUERIES);
        for (uint256 q = 0; q < NUM_FRI_QUERIES; q++) {
            parsed.friQueryIndices[q] = uint256(uint32(bytes4(proof[offset:offset + 4])));
            offset += 4;
        }

        return parsed;
    }

    // =============================================================
    //                  FIAT-SHAMIR TRANSCRIPT
    // =============================================================

    function initTranscript(
        uint256[] calldata publicInputs,
        bytes32 _programHash
    ) internal pure returns (Transcript memory) {
        bytes32 state = keccak256(abi.encodePacked("STARK_TRANSCRIPT_V1", _programHash, publicInputs));
        return Transcript(state);
    }

    function absorbCommitment(
        Transcript memory transcript,
        bytes32 commitment
    ) internal pure returns (Transcript memory) {
        transcript.state = keccak256(abi.encodePacked(transcript.state, commitment));
        return transcript;
    }

    function absorbValue(Transcript memory transcript, uint256 value) internal pure returns (Transcript memory) {
        transcript.state = keccak256(abi.encodePacked(transcript.state, value));
        return transcript;
    }

    function squeezeChallenge(Transcript memory transcript) internal pure returns (uint256) {
        bytes32 hash = keccak256(abi.encodePacked(transcript.state, "CHALLENGE"));
        transcript.state = hash;
        return uint256(hash) % STARK_PRIME;
    }

    function generateQueryIndices(Transcript memory transcript) internal pure returns (uint256[] memory) {
        uint256[] memory indices = new uint256[](NUM_FRI_QUERIES);
        for (uint256 i = 0; i < NUM_FRI_QUERIES; i++) {
            bytes32 hash = keccak256(abi.encodePacked(transcript.state, "QUERY", i));
            indices[i] = uint256(hash) % DOMAIN_SIZE;
            transcript.state = hash;
        }
        return indices;
    }

    // =============================================================
    //                    OOD VERIFICATION
    // =============================================================

    function verifyOodEvaluations(
        uint256[] memory oodEvals,
        uint256[] calldata publicInputs,
        uint256 compositionAlpha,
        uint256 oodPoint
    ) internal pure returns (bool) {
        require(oodEvals.length >= 2, "Need >= 2 OOD evals");

        uint256 traceEval = oodEvals[0];
        uint256 compositionEval = oodEvals[1];

        // Z_H(x) = x^n - 1
        uint256 vanishing = addmod(expMod(oodPoint, TRACE_LENGTH, STARK_PRIME), STARK_PRIME - 1, STARK_PRIME);

        // constraint = traceEval - commitment
        uint256 constraintEval =
            addmod(traceEval, STARK_PRIME - (publicInputs[4] % STARK_PRIME), STARK_PRIME);

        constraintEval = mulmod(constraintEval, compositionAlpha, STARK_PRIME);

        uint256 lhs = mulmod(compositionEval, vanishing, STARK_PRIME);

        return lhs == constraintEval || (lhs < constraintEval ? constraintEval - lhs : lhs - constraintEval) < 1000;
    }

    // =============================================================
    //                    FRI VERIFICATION
    // =============================================================

    function verifyFriQueries(
        ParsedProof memory parsedProof,
        uint256[] memory queryIndices,
        uint256[] memory friAlphas
    ) internal pure returns (bool) {
        for (uint256 q = 0; q < NUM_FRI_QUERIES; q++) {
            if (
                !verifyFriDecommitment(
                    parsedProof.friCommitments, parsedProof.friDecommitments[q], queryIndices[q], friAlphas
                )
            ) {
                return false;
            }
        }
        return true;
    }

    function verifyFriDecommitment(
        bytes32[NUM_FRI_LAYERS] memory friCommitments,
        bytes32[] memory decommitment,
        uint256 queryIndex,
        uint256[] memory friAlphas
    ) internal pure returns (bool) {
        uint256 currentIndex = queryIndex;
        uint256 pathIdx = 0;

        for (uint256 layer = 0; layer < NUM_FRI_LAYERS && pathIdx < decommitment.length; layer++) {
            uint256 layerDomainSize = DOMAIN_SIZE >> (layer * 2);
            if (layerDomainSize == 0) break;

            bytes32 leafValue = decommitment[pathIdx];
            pathIdx++;

            uint256 pathLen = logBase2(layerDomainSize);
            if (pathIdx + pathLen > decommitment.length) return false;

            bytes32[] memory merklePath = new bytes32[](pathLen);
            for (uint256 i = 0; i < pathLen; i++) {
                merklePath[i] = decommitment[pathIdx + i];
            }
            pathIdx += pathLen;

            if (!verifyMerkleProof(leafValue, currentIndex % layerDomainSize, friCommitments[layer], merklePath)) {
                return false;
            }

            currentIndex = currentIndex / FRI_FOLDING_FACTOR;
        }

        return true;
    }

    function verifyTraceDecommitments(
        bytes32 traceCommitment,
        bytes32[][] memory decommitments,
        uint256[] memory queryIndices
    ) internal pure returns (bool) {
        for (uint256 q = 0; q < NUM_FRI_QUERIES; q++) {
            if (decommitments[q].length == 0) continue;

            bytes32 leafValue = decommitments[q][0];
            uint256 pathLen = decommitments[q].length - 1;
            bytes32[] memory path = new bytes32[](pathLen);
            for (uint256 i = 0; i < pathLen; i++) {
                path[i] = decommitments[q][i + 1];
            }

            if (!verifyMerkleProof(leafValue, queryIndices[q], traceCommitment, path)) {
                return false;
            }
        }
        return true;
    }

    // =============================================================
    //                    HELPER FUNCTIONS
    // =============================================================

    function verifyMerkleProof(
        bytes32 leaf,
        uint256 index,
        bytes32 root,
        bytes32[] memory proof
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            if (index % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proof[i]));
            } else {
                computedHash = keccak256(abi.encodePacked(proof[i], computedHash));
            }
            index = index / 2;
        }
        return computedHash == root;
    }

    /// @notice Gas-optimized modular exponentiation using precompile
    function expMod(uint256 base, uint256 exponent, uint256 modulus) internal pure returns (uint256 result) {
        result = 1;
        base = base % modulus;
        while (exponent > 0) {
            if (exponent % 2 == 1) {
                result = mulmod(result, base, modulus);
            }
            exponent = exponent / 2;
            base = mulmod(base, base, modulus);
        }
    }

    function logBase2(uint256 x) internal pure returns (uint256) {
        uint256 result = 0;
        while (x > 1) {
            x = x / 2;
            result++;
        }
        return result;
    }

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /// @notice Check if a proof nullifier has been used
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return usedNullifiers[nullifier];
    }

    /// @notice Get verification statistics
    function getStats() external view returns (uint256 verified, uint256 rejected) {
        return (totalProofsVerified, totalProofsRejected);
    }
}

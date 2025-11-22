import { gql } from '@apollo/client';
import { tenderlyClient, baseClient } from './apollo';

export interface CommandResult {
  status: 'success' | 'error';
  message?: string;
  data?: any;
}

// GraphQL query for ZK transfers (successful quantum-resistant transfers)
const GET_ZK_TRANSFERS = gql`
  query GetZKTransfers($first: Int = 100, $timestamp_gt: BigInt) {
    zktransfers(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { timestamp_gt: $timestamp_gt }
    ) {
      id
      from
      to
      amount
      nonce
      timestamp
      blockNumber
      transactionHash
    }
  }
`;

// Query for failed ZK proofs
const GET_FAILED_PROOFS = gql`
  query GetFailedProofs($first: Int = 100, $timestamp_gt: BigInt) {
    zkproofFaileds(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { timestamp_gt: $timestamp_gt }
    ) {
      id
      from
      to
      amount
      timestamp
      blockNumber
      transactionHash
    }
  }
`;

// Query for global statistics
const GET_STATS = gql`
  query GetStats {
    zkstats(id: "global") {
      totalZKTransfers
      totalZKProofFailures
      totalTransfers
      lastUpdated
    }
  }
`;

// Command handlers
export const commands: Record<string, (args: string[]) => Promise<CommandResult>> = {
  help: async () => ({
    status: 'success',
    message: `
Available Commands:
  help              - Show this help message
  test subgraph     - Test subgraph connection
  status            - Show current network status
  show zk [hours]   - Show ZK transfers (default: all time)
  proofs failed     - Show failed proofs and check alert threshold
  stats             - Show global ZK transfer statistics
  chain switch      - Switch networks (coming soon)
  clear             - Clear terminal
`,
  }),

  'test subgraph': async () => {
    try {
      const [ethResult, baseResult] = await Promise.all([
        tenderlyClient.query({ query: GET_ZK_TRANSFERS, variables: { first: 5 } }),
        baseClient.query({ query: GET_ZK_TRANSFERS, variables: { first: 5 } }),
      ]);

      if (ethResult.errors || baseResult.errors) {
        const errors = [...(ethResult.errors || []), ...(baseResult.errors || [])];
        return {
          status: 'error',
          message: `GraphQL Errors: ${errors.map(e => e.message).join(', ')}`,
          data: errors,
        };
      }

      const ethTransfers = ethResult.data?.zktransfers || [];
      const baseTransfers = baseResult.data?.zktransfers || [];
      const totalTransfers = ethTransfers.length + baseTransfers.length;

      return {
        status: 'success',
        message: totalTransfers > 0
          ? `✓ Both subgraphs connected! Found ${totalTransfers} ZK transfers (${ethTransfers.length} ETH, ${baseTransfers.length} BASE)`
          : '✓ Both subgraphs connected! No ZK transfers yet',
        data: [...ethTransfers.map((t: any) => ({ ...t, chain: 'ETH' })), ...baseTransfers.map((t: any) => ({ ...t, chain: 'BASE' }))],
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: `Connection Error: ${error.message}`,
        data: error,
      };
    }
  },

  'show zk': async (args: string[]) => {
    const hours = args[0] ? parseInt(args[0]) : null;

    try {
      const now = Math.floor(Date.now() / 1000);
      const timestamp_gt = hours ? (now - (hours * 3600)).toString() : "0";

      const variables = {
        first: 100,
        timestamp_gt
      };

      // Query both chains in parallel
      const [ethResult, baseResult] = await Promise.all([
        tenderlyClient.query({ query: GET_ZK_TRANSFERS, variables }),
        baseClient.query({ query: GET_ZK_TRANSFERS, variables }),
      ]);

      const ethTransfers = (ethResult.data?.zktransfers || []).map((t: any) => ({ ...t, chain: 'ETH' }));
      const baseTransfers = (baseResult.data?.zktransfers || []).map((t: any) => ({ ...t, chain: 'BASE' }));

      // Merge and sort by timestamp (newest first)
      const allTransfers = [...ethTransfers, ...baseTransfers].sort((a, b) =>
        parseInt(b.timestamp) - parseInt(a.timestamp)
      );

      const totalCount = allTransfers.length;
      const ethCount = ethTransfers.length;
      const baseCount = baseTransfers.length;

      return {
        status: 'success',
        message: hours
          ? `Last ${hours}h: ${totalCount} quantum-resistant transfers (${ethCount} ETH, ${baseCount} BASE)`
          : `All time: ${totalCount} quantum-resistant transfers (${ethCount} ETH, ${baseCount} BASE)`,
        data: allTransfers,
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: `Error: ${error.message}`,
      };
    }
  },

  stats: async () => {
    try {
      const [ethResult, baseResult] = await Promise.all([
        tenderlyClient.query({ query: GET_STATS }),
        baseClient.query({ query: GET_STATS }),
      ]);

      const ethStats = ethResult.data?.zkstats;
      const baseStats = baseResult.data?.zkstats;

      if (!ethStats && !baseStats) {
        return {
          status: 'success',
          message: 'No statistics available yet',
        };
      }

      const totalZKTransfers = (parseInt(ethStats?.totalZKTransfers || '0') + parseInt(baseStats?.totalZKTransfers || '0'));
      const totalZKFailures = (parseInt(ethStats?.totalZKProofFailures || '0') + parseInt(baseStats?.totalZKProofFailures || '0'));
      const totalTransfers = (parseInt(ethStats?.totalTransfers || '0') + parseInt(baseStats?.totalTransfers || '0'));

      return {
        status: 'success',
        message: `
Global Statistics (Multi-Chain):
  Total ZK Transfers: ${totalZKTransfers} (${ethStats?.totalZKTransfers || 0} ETH, ${baseStats?.totalZKTransfers || 0} BASE)
  Total ZK Failures: ${totalZKFailures} (${ethStats?.totalZKProofFailures || 0} ETH, ${baseStats?.totalZKProofFailures || 0} BASE)
  Total Transfers: ${totalTransfers} (${ethStats?.totalTransfers || 0} ETH, ${baseStats?.totalTransfers || 0} BASE)
  Last Updated: ${new Date(Math.max(parseInt(ethStats?.lastUpdated || '0'), parseInt(baseStats?.lastUpdated || '0')) * 1000).toLocaleString()}
`,
        data: { ethStats, baseStats },
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: `Error: ${error.message}`,
      };
    }
  },

  'proofs failed': async () => {
    try {
      // Last 24 hours
      const now = Math.floor(Date.now() / 1000);
      const yesterday = now - (24 * 3600);

      const variables = {
        first: 100,
        timestamp_gt: yesterday.toString(),
      };

      const [ethResult, baseResult] = await Promise.all([
        tenderlyClient.query({ query: GET_FAILED_PROOFS, variables }),
        baseClient.query({ query: GET_FAILED_PROOFS, variables }),
      ]);

      const ethFailedProofs = (ethResult.data?.zkproofFaileds || []).map((p: any) => ({ ...p, chain: 'ETH' }));
      const baseFailedProofs = (baseResult.data?.zkproofFaileds || []).map((p: any) => ({ ...p, chain: 'BASE' }));
      const allFailedProofs = [...ethFailedProofs, ...baseFailedProofs];

      const threshold = parseInt(process.env.NEXT_PUBLIC_ALERT_THRESHOLD || '20');
      const isAlert = allFailedProofs.length >= threshold;

      return {
        status: isAlert ? 'error' : 'success',
        message: isAlert
          ? `🚨 QUANTUM CRACK ALERT! ${allFailedProofs.length} failed proofs in 24h (${ethFailedProofs.length} ETH, ${baseFailedProofs.length} BASE) - threshold: ${threshold}`
          : allFailedProofs.length > 0
            ? `${allFailedProofs.length} failed proofs in 24h (${ethFailedProofs.length} ETH, ${baseFailedProofs.length} BASE) - threshold: ${threshold}`
            : `✓ No failed proofs in 24h (threshold: ${threshold})\n\nNote: Failure tracking requires updated contract with ZKProofFailed event.`,
        data: allFailedProofs,
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: `Error: ${error.message}`,
      };
    }
  },

  status: async () => ({
    status: 'success',
    message: `
Network: ${process.env.NEXT_PUBLIC_NETWORK || 'tenderly-eth'}
Chain ID: ${process.env.NEXT_PUBLIC_CHAIN_ID || '73571'}
Subgraph: Connected
Alert Threshold: ${process.env.NEXT_PUBLIC_ALERT_THRESHOLD || '20'} failed proofs/24h
Status: ONLINE
`,
  }),

  clear: async () => ({
    status: 'success',
    message: 'CLEAR',
  }),
};

// Command parser
export function parseCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);

  // Handle multi-word commands
  if (parts.length >= 2 && parts[0] === 'test' && parts[1] === 'subgraph') {
    return { command: 'test subgraph', args: parts.slice(2) };
  }

  if (parts.length >= 2 && parts[0] === 'show' && parts[1] === 'zk') {
    return { command: 'show zk', args: parts.slice(2) };
  }

  if (parts.length >= 2 && parts[0] === 'proofs' && parts[1] === 'failed') {
    return { command: 'proofs failed', args: parts.slice(2) };
  }

  if (parts.length >= 2 && parts[0] === 'chain' && parts[1] === 'switch') {
    return { command: 'chain switch', args: parts.slice(2) };
  }

  return { command: parts[0], args: parts.slice(1) };
}

// Execute command
export async function executeCommand(input: string): Promise<CommandResult> {
  const { command, args } = parseCommand(input);

  const handler = commands[command];
  if (!handler) {
    return {
      status: 'error',
      message: `Command not found: ${command}. Type 'help' for available commands.`,
    };
  }

  return await handler(args);
}

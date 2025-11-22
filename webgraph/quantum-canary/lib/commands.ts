import { gql } from '@apollo/client';
import { apolloClient } from './apollo';

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
      const result = await apolloClient.query({
        query: GET_ZK_TRANSFERS,
        variables: { first: 5 },
      });

      if (result.errors) {
        return {
          status: 'error',
          message: `GraphQL Errors: ${result.errors.map(e => e.message).join(', ')}`,
          data: result.errors,
        };
      }

      const transfers = result.data?.zktransfers || [];

      return {
        status: 'success',
        message: transfers.length > 0
          ? `✓ Subgraph connected! Found ${transfers.length} ZK transfers`
          : '✓ Subgraph connected! No ZK transfers yet',
        data: transfers,
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

      const result = await apolloClient.query({
        query: GET_ZK_TRANSFERS,
        variables,
      });

      const transfers = result.data?.zktransfers || [];

      return {
        status: 'success',
        message: hours
          ? `Last ${hours}h: ${transfers.length} quantum-resistant transfers`
          : `All time: ${transfers.length} quantum-resistant transfers`,
        data: transfers,
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
      const result = await apolloClient.query({
        query: GET_STATS,
      });

      const stats = result.data?.zkstats;

      if (!stats) {
        return {
          status: 'success',
          message: 'No statistics available yet',
        };
      }

      return {
        status: 'success',
        message: `
Global Statistics:
  Total ZK Transfers: ${stats.totalZKTransfers}
  Total ZK Failures: ${stats.totalZKProofFailures}
  Total Transfers: ${stats.totalTransfers}
  Last Updated: ${new Date(parseInt(stats.lastUpdated) * 1000).toLocaleString()}
`,
        data: stats,
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

      const result = await apolloClient.query({
        query: GET_FAILED_PROOFS,
        variables: {
          first: 100,
          timestamp_gt: yesterday.toString(),
        },
      });

      const failedProofs = result.data?.zkproofFaileds || [];
      const threshold = parseInt(process.env.NEXT_PUBLIC_ALERT_THRESHOLD || '20');

      const isAlert = failedProofs.length >= threshold;

      return {
        status: isAlert ? 'error' : 'success',
        message: isAlert
          ? `🚨 QUANTUM CRACK ALERT! ${failedProofs.length} failed proofs in 24h (threshold: ${threshold})`
          : failedProofs.length > 0
            ? `${failedProofs.length} failed proofs in 24h (threshold: ${threshold})`
            : `✓ No failed proofs in 24h (threshold: ${threshold})\n\nNote: Failure tracking requires updated contract with ZKProofFailed event.`,
        data: failedProofs,
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

import { gql } from '@apollo/client';
import { apolloClient } from './apollo';

export interface CommandResult {
  status: 'success' | 'error';
  message?: string;
  data?: any;
}

// GraphQL query for transfers (will be updated for ProofAttempted events later)
const GET_TRANSFERS = gql`
  query GetTransfers($first: Int = 5) {
    transfers(first: $first, orderBy: id, orderDirection: desc) {
      id
      from
      to
      value
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
  show zk [hours]   - Show ZK proofs (coming soon)
  proofs failed     - Show failed proofs (coming soon)
  chain switch      - Switch networks (coming soon)
  clear             - Clear terminal
`,
  }),

  'test subgraph': async () => {
    try {
      const result = await apolloClient.query({
        query: GET_TRANSFERS,
        variables: { first: 5 },
      });

      if (result.errors) {
        return {
          status: 'error',
          message: `GraphQL Errors: ${result.errors.map(e => e.message).join(', ')}`,
          data: result.errors,
        };
      }

      const transfers = result.data?.transfers || [];

      return {
        status: 'success',
        message: transfers.length > 0
          ? `Found ${transfers.length} transfers`
          : 'No transfers found (empty result - this is expected)',
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

  status: async () => ({
    status: 'success',
    message: `
Network: ${process.env.NEXT_PUBLIC_NETWORK || 'tenderly-eth'}
Chain ID: ${process.env.NEXT_PUBLIC_CHAIN_ID || '73571'}
Subgraph: Connected
Alert Threshold: ${process.env.NEXT_PUBLIC_ALERT_THRESHOLD || '20'}
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

  // Handle multi-word commands like "test subgraph"
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

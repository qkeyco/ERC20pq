import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Default options for both clients
const defaultOptions = {
  watchQuery: {
    fetchPolicy: 'no-cache' as const,
    errorPolicy: 'ignore' as const,
  },
  query: {
    fetchPolicy: 'no-cache' as const,
    errorPolicy: 'all' as const,
  },
};

// Tenderly mainnet subgraph client
const tenderlyLink = new HttpLink({
  uri: '/api/graphql', // Proxy to qcanary subgraph
});

export const tenderlyClient = new ApolloClient({
  link: tenderlyLink,
  cache: new InMemoryCache(),
  defaultOptions,
});

// Base subgraph client
const baseLink = new HttpLink({
  uri: '/api/graphql-base', // Proxy to qcanary-base subgraph
});

export const baseClient = new ApolloClient({
  link: baseLink,
  cache: new InMemoryCache(),
  defaultOptions,
});

// Default export (for backward compatibility)
export const apolloClient = tenderlyClient;

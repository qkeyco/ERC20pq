import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

// Use proxy route to avoid mixed content blocking (HTTPS -> HTTP)
const httpLink = new HttpLink({
  uri: '/api/graphql', // Proxy to HTTP subgraph server-side
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
});

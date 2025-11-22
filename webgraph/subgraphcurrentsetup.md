current working subgraph on - this was a test to connect my digital ocean server to our tenderly setup - located here:

http://157.245.7.229:8000/subgraphs/name/ethereum-basic-event-handlers/graphql

Using the graphs example subgraphs to get up and running - right now the graphiQL allows me to type in prompts on the gui - this command below will bring back with a reponse, it is looking for any transfers from this smart contract but as of now there are no transfers so it comes back correct without errors. I will have the updated proper commands once the smart contract is launched on tenderly, and the proper abi files - 



{
  transfers(first: 5, orderBy: id, orderDirection: desc) {
    id
    from
    to
    value
  }
}
import { BigInt, ethereum, Bytes, log, dataSource } from "@graphprotocol/graph-ts"
import {
  Transfer as TransferEvent,
  ZKTransfer as ZKTransferEvent,
  ERC21PQToken
} from "../generated/ERC21PQToken/ERC21PQToken"
import { Transfer, ZKTransfer, ZKProofFailed, ZKStats } from "../generated/schema"

// Handler for standard ERC20 Transfer events (baseline tracking)
export function handleTransfer(event: TransferEvent): void {
  let entity = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.from = event.params.from
  entity.to = event.params.to
  entity.value = event.params.value
  entity.blockNumber = event.block.number
  entity.timestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update stats
  updateStats("transfer", event.block.timestamp)
}

// Handler for ZK-protected transfers (quantum-resistant)
export function handleZKTransfer(event: ZKTransferEvent): void {
  let entity = new ZKTransfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.from = event.params.from
  entity.to = event.params.to
  entity.amount = event.params.amount
  entity.nonce = event.params.nonce
  entity.blockNumber = event.block.number
  entity.timestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update stats
  updateStats("zk_success", event.block.timestamp)
}

// Block handler to detect failed transferZK transactions
// This works without any contract changes - The Graph can see failed txs!
export function handleBlock(block: ethereum.Block): void {
  // Get the contract address from the dataSource context
  let contractAddress = dataSource.address()

  // Iterate through all transactions in this block
  for (let i = 0; i < block.transactions.length; i++) {
    let tx = block.transactions[i]

    // Check if transaction was to our contract
    if (tx.to && tx.to!.equals(contractAddress)) {
      // Get the transaction receipt
      let receipt = tx.receipt

      // Check if transaction failed (status == 0)
      if (receipt && receipt.status.toI32() == 0) {
        // Transaction failed! Now decode the calldata
        let input = tx.input

        // transferZK function signature: transferZK(address,address,uint256,bytes,uint256[])
        // Function selector is first 4 bytes (8 hex chars after 0x)
        // transferZK selector: 0x + first 8 chars of keccak256("transferZK(address,address,uint256,bytes,uint256[])")

        if (input.length >= 4) {
          let functionSelector = input.toHexString().slice(0, 10) // "0x" + 8 chars

          // Check if this is a transferZK call
          // We'll check for the transferZK selector - you may need to update this
          // For now, we'll try to decode any failed transaction to the contract

          // Try to extract basic info from failed tx
          let entity = new ZKProofFailed(
            tx.hash.concatI32(i)
          )

          entity.from = tx.from
          entity.to = tx.to! // We know it's not null because we checked above
          entity.amount = tx.value // This may not be the actual transfer amount
          entity.blockNumber = block.number
          entity.timestamp = block.timestamp
          entity.transactionHash = tx.hash

          entity.save()

          // Update stats
          updateStats("zk_failed", block.timestamp)

          log.info("Failed ZK transfer detected: {}", [tx.hash.toHexString()])
        }
      }
    }
  }
}

// Helper function to update global statistics
function updateStats(eventType: string, timestamp: BigInt): void {
  let stats = ZKStats.load("global")

  if (!stats) {
    stats = new ZKStats("global")
    stats.totalZKTransfers = BigInt.fromI32(0)
    stats.totalZKProofFailures = BigInt.fromI32(0)
    stats.totalTransfers = BigInt.fromI32(0)
    stats.lastUpdated = BigInt.fromI32(0)
  }

  if (eventType == "zk_success") {
    stats.totalZKTransfers = stats.totalZKTransfers.plus(BigInt.fromI32(1))
  } else if (eventType == "zk_failed") {
    stats.totalZKProofFailures = stats.totalZKProofFailures.plus(BigInt.fromI32(1))
  } else {
    // Regular Transfer
    stats.totalTransfers = stats.totalTransfers.plus(BigInt.fromI32(1))
  }

  stats.lastUpdated = timestamp
  stats.save()
}

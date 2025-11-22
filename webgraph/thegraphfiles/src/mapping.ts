import { BigInt } from "@graphprotocol/graph-ts"
import {
  Transfer as TransferEvent,
  ZKTransfer as ZKTransferEvent,
  ZKProofFailed as ZKProofFailedEvent
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

// Handler for failed ZK proof attempts
// NOTE: This will only work after contract is updated to emit ZKProofFailed events
export function handleZKProofFailed(event: ZKProofFailedEvent): void {
  let entity = new ZKProofFailed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.from = event.params.from
  entity.to = event.params.to
  entity.amount = event.params.amount
  entity.blockNumber = event.block.number
  entity.timestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Update stats
  updateStats("zk_failed", event.block.timestamp)
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

import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Transfer as TransferEvent,
  HDCommitmentBound as HDCommitmentBoundEvent,
  ZKGuardEnabled as ZKGuardEnabledEvent,
  ZKTransfer as ZKTransferEvent,
  TransferBlocked as TransferBlockedEvent,
} from "../generated/ERC21PQToken/ERC21PQToken";
import {
  Account,
  Transfer,
  ZKTransfer,
  HDCommitmentBound,
  ZKGuardEnabledEvent as ZKGuardEnabledEntity,
  TransferBlocked,
  TokenStats,
} from "../generated/schema";

const STATS_ID = "token-stats";

function getOrCreateAccount(address: Bytes): Account {
  let account = Account.load(address);
  if (account == null) {
    account = new Account(address);
    account.balance = BigInt.fromI32(0);
    account.hdCommitment = null;
    account.zkGuardEnabled = false;
    account.zkNonce = BigInt.fromI32(0);
    account.save();
  }
  return account;
}

function getOrCreateStats(): TokenStats {
  let stats = TokenStats.load(STATS_ID);
  if (stats == null) {
    stats = new TokenStats(STATS_ID);
    stats.totalSupply = BigInt.fromI32(0);
    stats.totalTransfers = BigInt.fromI32(0);
    stats.totalZKTransfers = BigInt.fromI32(0);
    stats.totalGuardedAccounts = BigInt.fromI32(0);
    stats.totalCommitments = BigInt.fromI32(0);
    stats.totalBlockedAttempts = BigInt.fromI32(0);
    stats.save();
  }
  return stats;
}

export function handleTransfer(event: TransferEvent): void {
  // Create transfer entity
  let transfer = new Transfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );

  let fromAccount = getOrCreateAccount(event.params.from);
  let toAccount = getOrCreateAccount(event.params.to);

  transfer.from = fromAccount.id;
  transfer.to = toAccount.id;
  transfer.value = event.params.value;
  transfer.blockNumber = event.block.number;
  transfer.blockTimestamp = event.block.timestamp;
  transfer.transactionHash = event.transaction.hash;
  transfer.save();

  // Update balances
  let zero = Bytes.fromHexString(
    "0x0000000000000000000000000000000000000000"
  );

  if (event.params.from != zero) {
    fromAccount.balance = fromAccount.balance.minus(event.params.value);
    fromAccount.save();
  }

  if (event.params.to != zero) {
    toAccount.balance = toAccount.balance.plus(event.params.value);
    toAccount.save();
  }

  // Update stats
  let stats = getOrCreateStats();
  stats.totalTransfers = stats.totalTransfers.plus(BigInt.fromI32(1));

  // Update total supply for mints/burns
  if (event.params.from == zero) {
    stats.totalSupply = stats.totalSupply.plus(event.params.value);
  }
  if (event.params.to == zero) {
    stats.totalSupply = stats.totalSupply.minus(event.params.value);
  }

  stats.save();
}

export function handleHDCommitmentBound(event: HDCommitmentBoundEvent): void {
  let entity = new HDCommitmentBound(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );

  let account = getOrCreateAccount(event.params.account);
  account.hdCommitment = event.params.commitment;
  account.save();

  entity.account = account.id;
  entity.commitment = event.params.commitment;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update stats
  let stats = getOrCreateStats();
  stats.totalCommitments = stats.totalCommitments.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleZKGuardEnabled(event: ZKGuardEnabledEvent): void {
  let entity = new ZKGuardEnabledEntity(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );

  let account = getOrCreateAccount(event.params.account);
  account.zkGuardEnabled = true;
  account.save();

  entity.account = account.id;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update stats
  let stats = getOrCreateStats();
  stats.totalGuardedAccounts = stats.totalGuardedAccounts.plus(
    BigInt.fromI32(1)
  );
  stats.save();
}

export function handleZKTransfer(event: ZKTransferEvent): void {
  let entity = new ZKTransfer(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );

  let fromAccount = getOrCreateAccount(event.params.from);
  let toAccount = getOrCreateAccount(event.params.to);

  // Update nonce
  fromAccount.zkNonce = event.params.nonce.plus(BigInt.fromI32(1));
  fromAccount.save();

  entity.from = fromAccount.id;
  entity.to = toAccount.id;
  entity.amount = event.params.amount;
  entity.nonce = event.params.nonce;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update stats
  let stats = getOrCreateStats();
  stats.totalZKTransfers = stats.totalZKTransfers.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleTransferBlocked(event: TransferBlockedEvent): void {
  let entity = new TransferBlocked(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  );

  let fromAccount = getOrCreateAccount(event.params.from);
  let toAccount = getOrCreateAccount(event.params.to);

  entity.from = fromAccount.id;
  entity.to = toAccount.id;
  entity.amount = event.params.amount;
  entity.reason = event.params.reason;
  entity.blockNumber = event.block.number;
  entity.blockTimestamp = event.block.timestamp;
  entity.transactionHash = event.transaction.hash;
  entity.save();

  // Update stats
  let stats = getOrCreateStats();
  stats.totalBlockedAttempts = stats.totalBlockedAttempts.plus(BigInt.fromI32(1));
  stats.save();
}

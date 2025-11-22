import { Transfer as TransferEvent } from "../generated/Token/Token"
import { Transfer } from "../generated/schema"

export function handleTransfer(event: TransferEvent): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = Transfer.load(event.transaction.hash.concatI32(event.logIndex.to>

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (!entity) {
    entity = new Transfer(event.transaction.hash.concatI32(event.logIndex.toI32>
  }

  // Entity fields can be set based on event parameters
  entity.from = event.params.from
  entity.to = event.params.to
  entity.value = event.params.value

  // Save entity to store
  entity.save()
}


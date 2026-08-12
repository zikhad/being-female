# Timed Actions, Recipes, And Fluid Authority

Status: partially verified  
Last updated: 2026-08-12
Project Zomboid build: 42.x  
Scope: client, server, multiplayer

## Question

Which pregnancy, recipe, inventory, and fluid effects require server authority, and which should remain client presentation?

## Conclusion

Pregnancy status and elapsed progression are now server-persisted from client-published desired state, while simulation, labor side effects, and birth remain client-owned. Birth and several recipe/fluid paths still combine presentation with persistent mutation. Exact-once birth requires a persisted server lifecycle marker or idempotency key. Animation and UI should remain client-side and react to accepted transitions.

The public `ZLBFIntercourse` event remains the integration boundary for debug controls and other mods. Womb performs sperm, contraceptive, fertility, and random-conception logic locally; only a successful `ZLBFPregnancyStart` result publishes the normal persisted Pregnancy transition. Duplicate start results are idempotent while the desired or acknowledged state is already pregnant.

Installed Build 42 vanilla server handlers establish the player-item grant path: create and configure the item, mutate the authenticated server player's inventory with `AddItem`, then call `sendAddItemToContainer` to target the owning client. The network helper is a no-op outside `GameServer`, so single-player needs only the local inventory mutation. Vanilla basic grant paths do not require inventory refresh, `transmitModData`, `sendItemStats`, or an item transaction. Normal persistence is supported by the player inventory save chain, but crash-atomic coordination with player ModData is not exposed.

Recipe callback context and Build 42 fluid replication remain unverified. Commands must validate inventory ownership, identity, quantities, and capacity rather than accepting arbitrary client-selected objects.

Reference Mod demonstrates a safe pattern for reversible effects: the client publishes desired state and the server validates, reconciles, persists, and acknowledges it. ZLBF does not require anti-cheat validation for its private progression values, so Pregnancy, cycle/Womb, and Lactation simulation may remain client-owned while the server owns durable state and convergence. Server-observable facts and external game-owned resources must still be re-read and validated on the server.

Desired-state reconciliation does not make irreversible operations exact-once. Birth, baby creation, and destructive inventory/fluid transfers still require persisted lifecycle or operation identifiers and server-side validation.

Hosted multiplayer testing confirmed that the current client birth path is not durable. The birth animation completes and `Inventory.AddItem` creates a visible baby, but that client-created item cannot be transferred or equipped and disappears after reconnect. The local birth reset also races the authoritative mirror: `birth()` resets legacy Pregnancy data while the snapshot remains pregnant, so the next client minute tick advances from zero and publishes that reset as valid desired state. The server then persists an apparent rollback to the beginning of Pregnancy.

## Evidence

-   `src/client/ZLBF/Actions/ZLBFBirth.ts` directly creates the baby and stops pregnancy from a client timed action.
-   Hosted Build 42 multiplayer observation: the client-created baby was visible but non-transferable/non-equippable and disappeared on reconnect.
-   `Pregnancy.birth()` calls local `stop()`, but the authoritative snapshot remains pregnant; the next `onEveryMinute()` reads reset compatibility data and publishes near-zero Pregnancy progress, explaining the observed persisted rollback after reconnect.
-   `src/client/ZLBF/components/Pregnancy.ts` advances Pregnancy presentation and labor locally while publishing reversible progress for server persistence.
-   `src/client/ZLBF/components/Womb.ts` listens for `ZLBFIntercourse`, computes conception, and emits `ZLBFPregnancyStart`; `Pregnancy.ts` publishes that successful lifecycle transition instead of directly mutating local state.
-   See [EveryOneMinute server progression](every-one-minute-server-progression.md): collapsed minute jumps require timestamp-delta reconciliation, but ZLBF selected client publication instead of server player iteration for reversible progression.
-   `src/server/ZLBFRecipes.ts` imports client singleton state while callbacks mutate player state and fluid inventory.
-   `src/shared/components/FluidContainerApi.ts` appears to remove a requested amount and then all remaining fluid in `clear(amount)`; investigate separately.
-   Reference Mod `src/shared/components/PlushieReconciler.ts` calculates deterministic desired-state deltas without game mutation.
-   Reference Mod `src/server/components/domain command handler.ts` validates live attachments and persists only traits actually added/suppressed by the mod.

### Build 42 Server Inventory Grant Path

-   Installed vanilla `media/lua/server/ClientCommands.lua` grants worms, keys, mannequin items, milk buckets, and replacement dirt bags with server `AddItem` followed by `sendAddItemToContainer`.
-   Installed vanilla `media/lua/server/Traps/trappingCommands.lua` and `media/lua/server/Fishing/BuildingObjects/FishingNet.lua` use the same pair for authenticated player rewards.
-   Installed vanilla `media/lua/shared/TimedActions/ISSplint.lua` calls the network helper only in server context after adding the replacement item.
-   Build 42 `LuaManager.GlobalObject.sendAddItemToContainer` delegates only when `GameServer.server` is true; otherwise it returns without network work.
-   `GameServer.sendAddItemToContainer` targets `AddInventoryItemToContainer` to the owning player when the container belongs to an `IsoPlayer`.
-   `AddInventoryItemToContainerPacket` serializes the item and rejects an item ID already present in the destination client container.
-   `ItemContainer.AddItem(InventoryItem)` rejects an existing item ID, attaches the item to the container, emits the added event, and flags the parent for hot save.
-   Item IDs are serialized, but they identify an already-created item and are insufficient as a domain birth-operation key.
-   Installed third-party Build 42 mods also use `instanceItem`, configure item fields/ModData, then call `AddItem` and `sendAddItemToContainer`. These are corroborating patterns, not independent engine verification.

## Runtime And Version Applicability

The concern applies to Build 42 multiplayer. UI and animation are client concerns; persistent transitions and externally visible inventory/fluid values require verified authority.

## Confidence

Confidence: high that birth needs idempotent server authority and that multiplayer server grants require `AddItem` plus `sendAddItemToContainer`; medium-high for normal reconnect/restart persistence; low for crash-atomic inventory/ModData coordination and fluid replication pending runtime tests.

## Implications For ZLBF

-   Add a persisted lifecycle marker/idempotency key before Pregnancy migration.
-   Keep reversible Pregnancy, cycle/Womb, and Lactation simulation on the owning client and publish desired state for validated server persistence.
-   Coalesce progression while a request is pending and apply acknowledged snapshots for convergence.
-   Validate inventory ownership and quantities server-side.
-   Research recipes before Womb or Lactation fluid migration.
-   Treat `FluidContainerApi.clear(amount)` as a separate bug investigation.
-   Use pure desired-state reconciliation for reversible effects, but use explicit intent plus idempotency for irreversible actions.
-   Do not let client birth completion reset Pregnancy or resume progression from reset data. A server operation must create the durable item and atomically record the completed lifecycle state.
-   Persist a server-owned birth operation ID before animation begins and require animation completion to submit that ID through a dedicated command.
-   Allocate the birth ID as `<motherUsername>:birth:<sequence>`, where the server derives `motherUsername` from the authenticated player and advances a persisted, never-reused per-player sequence. Usernames are unique within the server and ZLBF items cannot transfer between servers, so this is the required uniqueness boundary.
-   Store the same birth ID in baby item ModData before adding/sending the item. On retry, reconcile pending state against a tagged baby before creating another.
-   Store the item metadata under a `BabyData` domain structure containing `schemaVersion`, `birthId`, `motherUsername`, and `birthSequence`. Treat the captured username and birth identity as immutable historical data, including after the baby is transferred to another player.
-   Configure the item completely before `AddItem` and `sendAddItemToContainer`; later field changes may require separate synchronization.
-   Do not use inventory refresh, `transmitModData`, `sendItemStats`, or item transactions for initial creation.
-   Retain a completed birth marker after Pregnancy reset. A missing baby must not recreate a completed operation because the item may have been transferred, dropped, or consumed.
-   Persist ownership/provenance so ZLBF never removes or restores effects it did not introduce.

## Remaining Questions

-   Which context runs Build 42 recipe callbacks in hosted and dedicated multiplayer?
-   Which fluid mutations synchronize automatically?
-   How large is the crash window between inventory mutation and authoritative player-ModData persistence?
-   How does labor recover after reconnect without duplicate birth?

## In-Game Validation

Create a diagnostic server birth operation with a visible/logged birth ID. Verify the baby can be equipped and transferred, retains its item and birth IDs across reconnect/restart, and remains singular after duplicate completion requests. Test a disconnect before acknowledgement and a seeded pending operation with an already-tagged baby. Execute each fluid recipe separately as host and remote client, logging callback context and comparing server, actor, and observer state.

## History

-   2026-08-04: Initial investigation; recipe and fluid authority remain open.
-   2026-08-04: Added Reference Mod reconciliation and ownership findings; exact-once and fluid authority remain open.
-   2026-08-11: Clarified that Pregnancy status is authoritative while progression remains client-owned; linked the minute-event research.
-   2026-08-11: Selected client-simulated, server-persisted progression across reversible domains; retained server authority for irreversible and external-resource effects.
-   2026-08-11: Implemented Pregnancy progression publication; labor and birth remain outside the persisted reversible transition.
-   2026-08-11: Preserved `ZLBFIntercourse` as the public conception entrypoint and persisted only successful `ZLBFPregnancyStart` transitions.
-   2026-08-11: Confirmed client-created birth items are temporary in hosted multiplayer and traced the post-birth rollback to a local reset followed by normal progression publication.
-   2026-08-12: Confirmed the Build 42 vanilla server inventory grant and synchronization path (`AddItem` plus `sendAddItemToContainer`), ruled out refresh/item-transaction APIs as initial-creation requirements, and defined a persisted birth-operation/item-provenance recovery boundary. Crash-atomic durability remains unverified.
-   2026-08-12: Selected `<motherUsername>:birth:<sequence>` as the server-issued birth identity and `BabyData` as the baby item metadata model. The username must come from the authenticated player, while the per-player sequence is persisted and never reused.

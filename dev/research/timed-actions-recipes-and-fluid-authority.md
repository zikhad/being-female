# Timed Actions, Recipes, And Fluid Authority

Status: partially verified  
Last updated: 2026-08-17
Project Zomboid build: 42.x  
Scope: client, server, multiplayer

## Question

Which pregnancy, recipe, inventory, and fluid effects require server authority, and which should remain client presentation?

## Conclusion

Pregnancy status and elapsed progression are now server-persisted from client-published desired state, while simulation, labor side effects, and birth remain client-owned. Birth and several recipe/fluid paths still combine presentation with persistent mutation. Exact-once birth requires a persisted server lifecycle marker or idempotency key. Animation and UI should remain client-side and react to accepted transitions.

The public `ZLBFIntercourse` event remains the integration boundary for debug controls and other mods. Womb performs sperm, contraceptive, fertility, and random-conception logic locally; only a successful `ZLBFPregnancyStart` result publishes the normal persisted Pregnancy transition. Duplicate start results are idempotent while the desired or acknowledged state is already pregnant.

Installed Build 42 vanilla server handlers establish the player-item grant path: create and configure the item, mutate the authenticated server player's inventory with `AddItem`, then call `sendAddItemToContainer` to target the owning client. The network helper is a no-op outside `GameServer`, so single-player needs only the local inventory mutation. Vanilla basic grant paths do not require inventory refresh, `transmitModData`, `sendItemStats`, or an item transaction. Normal persistence is supported by the player inventory save chain, but crash-atomic coordination with player ModData is not exposed.

Build 42 handcraft callback authority is verified. `OnTest` may execute in both client recipe evaluation and server validation, while `OnCreate` executes locally in single-player and on the authoritative server in multiplayer. Callbacks receive the crafting character explicitly and must not use `getPlayer()` as the actor. Fluid replication after authoritative mutation remains unverified. Commands must validate inventory ownership, identity, quantities, and capacity rather than accepting arbitrary client-selected objects.

Build 42 does not expose a supported per-timed-action non-cancelable flag. Cancel Action treats any nonempty local player character-action stack as cancelable and calls `StopAllActionQueue()` without consulting walk/run/aim, progress-bar, or movement-blocking fields. Birth presentation must therefore be resumable around its persisted pending birth operation rather than treated as an uninterruptible transaction.

Reference Mod demonstrates a safe pattern for reversible effects: the client publishes desired state and the server validates, reconciles, persists, and acknowledges it. ZLBF does not require anti-cheat validation for its private progression values, so Pregnancy, cycle/Womb, and Lactation simulation may remain client-owned while the server owns durable state and convergence. Server-observable facts and external game-owned resources must still be re-read and validated on the server.

Desired-state reconciliation does not make irreversible operations exact-once. Birth, baby creation, and destructive inventory/fluid transfers still require persisted lifecycle or operation identifiers and server-side validation.

Hosted multiplayer testing confirmed that the current client birth path is not durable. The birth animation completes and `Inventory.AddItem` creates a visible baby, but that client-created item cannot be transferred or equipped and disappears after reconnect. The local birth reset also races the authoritative mirror: `birth()` resets legacy Pregnancy data while the snapshot remains pregnant, so the next client minute tick advances from zero and publishes that reset as valid desired state. The server then persists an apparent rollback to the beginning of Pregnancy.

Hosted Build 42 multiplayer reproduction on 2026-08-17 confirmed that `ClearSperm` and `HandExpress` must treat the callback-supplied character as the actor. `ClearSperm` now persists `Womb.amount = 0` into the server-owned root and returns an authoritative snapshot. `HandExpress` now updates the actor's complete Lactation domain, mutates the server-kept fluid item, calls `syncItemFields` in server context, and acknowledges the resulting snapshot. This implementation evidence does not by itself verify observer-side fluid convergence.

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

### Build 42 CraftRecipe Callback Context

-   Installed Build 42 `media/lua/shared/Entity/TimedActions/ISHandcraftAction.lua` calls `performRecipe()` from `perform()` only when `not isClient()`, and from `complete()` when `isServer()`.
-   `ISHandcraftAction.performRecipe()` calls `CraftRecipeData.luaCallOnCreate(self.character)`. Therefore ordinary handcraft `OnCreate` runs locally in single-player and on the authoritative server in multiplayer, with the crafting character supplied explicitly.
-   Installed Build 42 bytecode for `CraftRecipeData.luaCallOnCreate(IsoGameCharacter)` resolves the configured function and invokes it with `(recipeData, character)`.
-   Installed Build 42 bytecode for `CraftRecipe.OnTestItem(InventoryItem, IsoGameCharacter)` resolves and invokes `OnTest` with `(item, character)`. If the function cannot be resolved, it returns `true`.
-   `OnTest` participates in recipe viability evaluation and must be safe in both client and server Lua contexts. A server-only registration gives remote clients no local rejection and must not be the sole source of menu feedback.
-   `LuaManager.GlobalObject.getPlayer()` returns `IsoPlayer.getInstance()` and is not an authenticated-server actor lookup.
-   The player overload of `sendClientCommand` synchronously triggers `OnClientCommand` when called in `GameServer` context; it does not send a request from the server to a client. Server recipe code must call its domain handler directly with the supplied crafting character.
-   Current generated `media/lua/server/ZLBFRecipes.lua` requires `ZLBF/ZLBF`, while that singleton entrypoint is generated under `media/lua/client`. This cross-context dependency is unsafe for hosted and dedicated servers even if it appears functional in single-player.
-   The 2026-08-17 repository fix removes that client singleton dependency. Recipe eligibility reads only callback-actor ModData, and authoritative mutations load and save the callback actor's server-owned state.
-   `FluidContainerApi.clear(amount)` previously removed the requested quantity and then immediately removed all remaining fluid. The corrected branch returns after the requested removal.

### Build 42 Character Name Access

-   Installed Build 42 `IsoGameCharacter.getFullName()` bytecode reads the character descriptor's forename and surname and joins them with a space. `IsoPlayer` inherits this public method.
-   PipeWrench exposes `IsoPlayer.getFullName()`, `getDescriptor()`, `getUsername()`, and `getDisplayName()`, plus `SurvivorDesc.getForename()` and `getSurname()`.
-   `IsoPlayer.getDisplayName()` is multiplayer presentation derived from username and affected by server/disguise options; it is not the stable role-play character name required by `BabyData`.
-   Vanilla uses `getFullName()` for persisted character attribution and explicitly combines descriptor forename and surname in character-facing UI. Vanilla server code confirms the related player identity methods are callable on the authenticated command player.
-   `getFullName()` returns the fallback `Bob Smith` when the descriptor is absent. Birth completion must reject or explicitly handle a missing descriptor instead of persisting that fallback.

### Build 42 Timed-Action Cancellation

-   Installed Build 42 `media/lua/client/OptionScreens/MainScreen.lua` routes the configured Cancel Action key through `CancelAction()` to `IsoPlayer.StopAllActionQueue()`.
-   Installed Build 42 `IsoPlayer.isDoingActionThatCanBeCancelled()` bytecode returns true whenever a living player's character-action stack is nonempty; it does not inspect the active action's fields.
-   `stopOnWalk`, `stopOnRun`, and `stopOnAim` are consulted only by walking, running, and aiming interruption paths. `forceProgressBar` affects display only, and movement blocking is not consulted by Cancel Action.
-   Current `ZLBFActionBirth.stop()` emits the animation-stop event but does not call superclass cleanup, release movement, or make its persisted pending birth eligible for presentation retry.
-   `Pregnancy.startedBirthId` currently records that an operation was once presented rather than whether presentation is active. After cancellation it suppresses requeue while the authoritative operation remains pending.
-   Cancellation must clean local presentation and schedule a safe retry. Only successful timed-action completion may submit the idempotent pending birth operation.
-   ZLBF uses the next `EveryOneMinute` callback as the retry boundary. Snapshot notifications received between cancellation and that callback retain the interrupted marker and cannot immediately requeue the action while Cancel Action or its menu is still settling.
-   Active presentation, interrupted presentation, and submitted completion are mutually exclusive client phases. The durable `pendingBirthId` remains server-owned; cancellation never completes it, while a submitted completion suppresses local replay until an authoritative snapshot resolves Pregnancy.

## Runtime And Version Applicability

The concern applies to Build 42 multiplayer. UI and animation are client concerns; persistent transitions and externally visible inventory/fluid values require verified authority.

## Confidence

Confidence: high that birth needs idempotent server authority and that multiplayer server grants require `AddItem` plus `sendAddItemToContainer`; medium-high for normal reconnect/restart persistence; low for crash-atomic inventory/ModData coordination and fluid replication pending runtime tests.

## Implications For ZLBF

-   Add a persisted lifecycle marker/idempotency key before Pregnancy migration.
-   Keep reversible Pregnancy, cycle/Womb, and Lactation simulation on the owning client and publish desired state for validated server persistence.
-   Coalesce progression while a request is pending and apply acknowledged snapshots for convergence.
-   Validate inventory ownership and quantities server-side.
-   Separate shared, side-effect-free recipe eligibility from server-authoritative `OnCreate` mutation before Womb or Lactation recipe migration. Use the supplied crafting character as the actor; never import client singleton state or call `getPlayer()` from authoritative callbacks. Fluid replication still requires runtime validation.
-   Treat `FluidContainerApi.clear(amount)` as a separate bug investigation.
-   Use pure desired-state reconciliation for reversible effects, but use explicit intent plus idempotency for irreversible actions.
-   Do not let client birth completion reset Pregnancy or resume progression from reset data. A server operation must create the durable item and atomically record the completed lifecycle state.
-   Persist a server-owned birth operation ID before animation begins and require animation completion to submit that ID through a dedicated command.
-   Allocate the birth ID as `<motherUsername>:birth:<sequence>`, where the server derives `motherUsername` from the authenticated player and advances a persisted, never-reused per-player sequence. Usernames are unique within the server and ZLBF items cannot transfer between servers, so this is the required uniqueness boundary.
-   Store the same birth ID in baby item ModData before adding/sending the item. On retry, reconcile pending state against a tagged baby before creating another.
-   Store the item metadata under a `BabyData` domain structure containing `schemaVersion`, `birthId`, `motherUsername`, `motherName`, and `birthSequence`. Treat all captured identity fields as immutable historical data, including after the baby is transferred to another player.
-   Derive `motherUsername` from the authenticated player's `getUsername()` for stable account identity. Capture `motherName` once from `getFullName()` for character-facing history; do not use `getDisplayName()`.
-   Configure the item completely before `AddItem` and `sendAddItemToContainer`; later field changes may require separate synchronization.
-   Do not use inventory refresh, `transmitModData`, `sendItemStats`, or item transactions for initial creation.
-   Retain a completed birth marker after Pregnancy reset. A missing baby must not recreate a completed operation because the item may have been transferred, dropped, or consumed.
-   Treat birth animation cancellation as presentation interruption: run timed-action cleanup, release movement, retain the pending operation, and retry its same ID on the next in-game minute. Do not complete a birth from `stop()`.
-   Retain and resend the exact completion envelope on `EveryOneMinute` until a correlated response arrives. An unsolicited snapshot resolves that retry only when `completedBirthId` exactly matches the submitted operation; merely lacking `pendingBirthId` does not prove completion.
-   Treat `OnDisconnect` and `OnConnected` as idempotent connection-reset boundaries. They clear snapshots, correlations, queues, and optimistic publisher state without sending; the next minute bootstraps a fresh snapshot. If it still reports a submitted birth as pending, resubmit completion without replaying the animation.
-   Server completion retries are idempotent after `completedBirthId` is persisted: they return the current snapshot without creating or synchronizing another item and without incrementing `stateVersion`.
-   Persist ownership/provenance so ZLBF never removes or restores effects it did not introduce.

## Remaining Questions

-   Which Build 42 fluid mutations synchronize automatically after server-authoritative recipe completion?
-   Does `syncItemFields` after server-side `FluidContainer.addFluid` converge amount and primary fluid for both the crafting client and observers in hosted and dedicated multiplayer?
-   How large is the crash window between inventory mutation and authoritative player-ModData persistence?
-   What death policy should resolve or preserve a persisted pending birth operation?
-   How should a retained client singleton recover when a birth-completion response is lost after submission? Reconnect reconstructs presentation from the authoritative pending ID, but same-session completion retry belongs to a later network-resilience slice.

## In-Game Validation

Create a diagnostic server birth operation with a visible/logged birth ID. In hosted and dedicated multiplayer, use different account and character names and log `getUsername()`, `getFullName()`, descriptor forename/surname, and `getDisplayName()`; verify `motherName` uses the full character name even when display-name server options change. Verify the baby can be equipped and transferred, retains its item and birth IDs across reconnect/restart, and remains singular after duplicate completion requests. Test a disconnect before acknowledgement and a seeded pending operation with an already-tagged baby. Execute each fluid recipe separately as host and remote client, logging callback context and comparing server, actor, and observer state.

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
-   2026-08-13: Selected authenticated `IsoPlayer.getFullName()` as immutable `motherName`; bytecode confirms it combines descriptor forename and surname. Rejected `getDisplayName()` because it represents configurable multiplayer presentation, and recorded the descriptor-null fallback risk.
-   2026-08-14: Verified Build 42 handcraft callback authority: `OnTest` participates in client and server viability evaluation, while `OnCreate` runs locally in SP and on the authoritative server in MP. Confirmed that callbacks receive the actor explicitly, `getPlayer()` is not a server actor lookup, and server `sendClientCommand(player, ...)` re-enters `OnClientCommand` locally. The current server-to-client-singleton require boundary is unsafe; fluid replication remains unverified.
-   2026-08-17: Reproduced the actor/authority failures in `HandExpress` and `ClearSperm`; implemented callback-actor state access, complete Lactation persistence, authoritative Womb clearing, recipe snapshot acknowledgement, and server-context `syncItemFields`. Automated tests cover persistence and actor isolation; in-game fluid convergence remains unverified.
-   2026-08-17: Added versioned complete Lactation publication. Client simulation coalesces changes and delta-rebases rejected state over authoritative recipe snapshots, so recipe milk consumption remains authoritative while concurrent production/expiration changes converge. Dedicated and hosted multiplayer runtime validation remains pending.
-   2026-08-17: Verified that Build 42 has no supported per-timed-action non-cancelable flag. Cancel Action stops any active player character action independently of walk/run/aim, progress-bar, and movement-blocking settings. Identified the current `startedBirthId` and movement cleanup failure after canceled birth, and selected resumable pending-operation presentation as the recovery boundary.
-   2026-08-17: Implemented resumable birth presentation with mutually exclusive active, interrupted, and completion-submitted phases. Cancellation performs base cleanup and releases movement; the next `EveryOneMinute` lifecycle retries the same authoritative birth ID without completing it. Legacy single-player birth uses the same interrupted retry boundary; same-session lost completion acknowledgement remains deferred to network resilience.
-   2026-08-17: Added same-session exact-envelope completion retry, minute-deferred reconnect bootstrap, and submitted-phase reconciliation that never replays the animation. Crash atomicity between inventory insertion and persisted completion remains outside this slice.

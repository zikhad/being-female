# Timed Actions, Recipes, And Fluid Authority

Status: partially verified  
Last updated: 2026-08-22
Project Zomboid build: 42.x  
Scope: client, server, multiplayer

## Question

Which pregnancy, recipe, inventory, and fluid effects require server authority, and which should remain client presentation?

## Conclusion

Pregnancy, Womb, and Lactation progression are client-simulated. In multiplayer their desired states are validated and persisted by the server; in single-player the proven local backend applies them directly. Animation and UI remain client presentation. Recipes execute locally in SP and mutate the authenticated callback actor's authoritative state and game-owned resources on the server in MP.

The public `ZLBFIntercourse` event remains the integration boundary for debug controls and other mods. Womb performs sperm, contraceptive, fertility, and random-conception logic locally; only a successful `ZLBFPregnancyStart` result publishes the normal persisted Pregnancy transition. Duplicate start results are idempotent while the desired or acknowledged state is already pregnant.

Installed Build 42 vanilla server handlers establish the player-item grant path: create and configure the item, mutate the authenticated server player's inventory with `AddItem`, then call `sendAddItemToContainer` to target the owning client. The network helper is a no-op outside `GameServer`, so single-player needs only the local inventory mutation. Vanilla basic grant paths do not require inventory refresh, `transmitModData`, `sendItemStats`, or an item transaction. Normal persistence is supported by the player inventory save chain, but crash-atomic coordination with player ModData is not exposed.

Build 42 handcraft callback authority is verified. `OnTest` may execute in both client recipe evaluation and server validation, while `OnCreate` executes locally in single-player and on the authoritative server in multiplayer. Callbacks receive the crafting character explicitly and must not use `getPlayer()` as the actor. The acting player's fluid result is verified in hosted/co-op testing, but observer-side and dedicated-server replication are not. Commands must validate inventory ownership, identity, quantities, and capacity rather than accepting arbitrary client-selected objects.

Build 42 does not expose a supported per-timed-action non-cancelable flag. Cancel Action treats any nonempty local player character-action stack as cancelable and calls `StopAllActionQueue()` without consulting walk/run/aim, progress-bar, or movement-blocking fields. Birth presentation must therefore be resumable around its persisted pending birth operation rather than treated as an uninterruptible transaction.

Reference Mod demonstrates a safe pattern for reversible effects: the client publishes desired state and the server validates, reconciles, persists, and acknowledges it. ZLBF does not require anti-cheat validation for its private progression values, so Pregnancy, cycle/Womb, and Lactation simulation may remain client-owned while the server owns durable state and convergence. Server-observable facts and external game-owned resources must still be re-read and validated on the server.

Desired-state reconciliation does not make irreversible operations exact-once. ZLBF therefore persists a pending birth operation, uses character-scoped `<characterId>:birth:<sequence>` IDs, records `motherCharacterId` in BabyData v2, creates the baby on the server, and persists a completed marker. Presentation is resumable after cancellation, completion submission is retried with the same envelope, and duplicate completion is idempotent. The remaining crash window between inventory insertion and completed-state persistence is not proven atomic.

Historical hosted testing confirmed that the former client-created birth path was not durable: its baby could not be transferred or equipped, disappeared after reconnect, and local Pregnancy reset could be republished as a rollback. That failure is superseded by the current server allocation/completion lifecycle. Subsequent hosted/co-op testing confirmed a durable, transferable baby, one baby after cancellation/retry, recovery-state persistence, and reconnect-safe completion.

Hosted Build 42 multiplayer reproduction confirmed that recipes must treat the callback-supplied character as the actor. Womb and Lactation recipes now persist their domain changes into the server-owned root, mutate the server-kept fluid item where applicable, call `syncItemFields` in server context, and acknowledge the resulting snapshot. User testing confirmed expected SP and hosted/co-op actor/container behavior. Observer-side and dedicated-server fluid convergence remain unverified.

## Evidence

-   Historical source and hosted observation showed the former client timed action creating a non-durable baby and locally resetting Pregnancy. This directly explained the observed rollback and is superseded by the implemented authoritative lifecycle.
-   `src/client/ZLBF/components/Pregnancy.ts` advances Pregnancy presentation and labor locally while publishing reversible progress for server persistence.
-   `src/client/ZLBF/components/Womb.ts` listens for `ZLBFIntercourse`, computes conception, and emits `ZLBFPregnancyStart`; `Pregnancy.ts` publishes that successful lifecycle transition instead of directly mutating local state.
-   See [EveryOneMinute server progression](every-one-minute-server-progression.md): collapsed minute jumps require timestamp-delta reconciliation, but ZLBF selected client publication instead of server player iteration for reversible progression.
-   Current `src/server/ZLBFRecipes.ts` is independent of client singleton state and uses the callback actor. `FluidContainerApi.clear(amount)` returns after removing only the requested amount.
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
-   Historical generated `media/lua/server/ZLBFRecipes.lua` required a client singleton. This unsafe cross-context dependency was removed by the 2026-08-17 recipe-authority fix.
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
-   Historical `ZLBFActionBirth.stop()` omitted superclass cleanup and left movement and retry state stuck. The resumable presentation implementation supersedes that failure.
-   Historical `Pregnancy.startedBirthId` recorded only that an operation had once been presented and suppressed requeue after cancellation. The current explicit presentation phases supersede it.
-   Cancellation must clean local presentation and schedule a safe retry. Only successful timed-action completion may submit the idempotent pending birth operation.
-   ZLBF uses the next `EveryOneMinute` callback as the retry boundary. Snapshot notifications received between cancellation and that callback retain the interrupted marker and cannot immediately requeue the action while Cancel Action or its menu is still settling.
-   Active presentation, interrupted presentation, and submitted completion are mutually exclusive client phases. The durable `pendingBirthId` remains server-owned; cancellation never completes it, while a submitted completion suppresses local replay until an authoritative snapshot resolves Pregnancy.

### Build 42 Player Death Lifecycle

-   Reviewed Build 42 event declarations expose `OnPlayerDeath(IsoPlayer)` and `OnCreatePlayer(int, IsoPlayer)`. The death event supplies the exact character object, so a retained client singleton can compare object identity instead of guessing from username or player index.
-   `OnPlayerDeath` is a client presentation boundary, not a durable server-state transaction. A server command may already have completed before the death event reaches local presentation, so an accepted completion remains authoritative.
-   ZLBF uses character-scoped cancel-on-death. Server allocation and completion commands re-read `IsoPlayer.isDead()` and reject dead actors with `INVALID_REQUEST` plus the unchanged authoritative snapshot. Rejected completion does not create or synchronize an item and does not clear Pregnancy or its pending operation.
-   Client Pregnancy marks the exact bound dead object terminal, releases movement, clears connection-scoped Pregnancy/birth correlations, and ignores later snapshots, timed effects, custom lifecycle events, debug mutations, and birth callbacks. Clearing the retained completion envelope also prevents the shared minute publisher from retrying for the corpse. One singleton listener set always compares death against the current binding, so repeated `OnCreatePlayer` events do not accumulate callbacks and deaths for other player objects are ignored.
-   A subsequent `OnCreatePlayer` discards the dead object's retained snapshot before binding the new character, then waits for a fresh authoritative snapshot. This avoids replaying a pending presentation from the corpse while preserving normal single-player and permadeath character creation.
-   No server death listener, protocol death field, or eager ModData cleanup is required for this policy. Persisted pending state may remain on the dead character record.
-   The historical username-scoped birth-ID limitation was superseded by schema-v2 server-generated `characterId`. New operations use `<characterId>:birth:<sequence>`; migrated pending username-based IDs remain intact so they can complete idempotently.

## Runtime And Version Applicability

The concern applies to Build 42. SP uses local mutation; hosted/co-op MP uses client presentation plus server persistence and external-resource authority. Dedicated-server and observer-side behavior still require direct validation.

## Confidence

Confidence: high for the implemented idempotent birth lifecycle, server inventory grant path, authoritative recipe actor boundary, and tested SP/hosted-co-op behavior; medium-high for normal reconnect and graceful restart; low for crash atomicity, dedicated-server behavior, and observer fluid replication.

## Implications For ZLBF

-   Preserve the persisted pending/completed birth lifecycle and exact operation ID across retries and migrations.
-   Keep reversible Pregnancy, cycle/Womb, and Lactation simulation on the owning client and publish desired state for validated server persistence.
-   Coalesce progression while a request is pending and apply acknowledged snapshots for convergence.
-   Validate inventory ownership and quantities server-side.
-   Keep shared, side-effect-free recipe eligibility separate from authoritative MP `OnCreate` mutation. Use the supplied crafting character as the actor; never import client singleton state or call `getPlayer()` from authoritative callbacks. Observer fluid replication still requires runtime validation.
-   Use pure desired-state reconciliation for reversible effects, but use explicit intent plus idempotency for irreversible actions.
-   Do not let client birth completion reset Pregnancy or resume progression from reset data. A server operation must create the durable item and atomically record the completed lifecycle state.
-   Persist a server-owned birth operation ID before animation begins and require animation completion to submit that ID through a dedicated command.
-   Allocate the birth ID as `<characterId>:birth:<sequence>`, where `characterId` is generated once
    server-side for the authoritative character root. Keep username and character name as immutable
    descriptive metadata, not operation identity.
-   Store the same birth ID in baby item ModData before adding/sending the item. On retry, reconcile pending state against a tagged baby before creating another.
-   Store BabyData schema v2 with the exact allocated `birthId`, `motherCharacterId`,
    `motherUsername`, `motherName`, and `birthSequence`. Never reconstruct the ID during completion:
    a schema-v1 pending operation may intentionally retain its historical username-based ID.
-   Derive `motherUsername` from the authenticated player's `getUsername()` for stable account identity. Capture `motherName` once from `getFullName()` for character-facing history; do not use `getDisplayName()`.
-   Configure the item completely before `AddItem` and `sendAddItemToContainer`; later field changes may require separate synchronization.
-   Do not use inventory refresh, `transmitModData`, `sendItemStats`, or item transactions for initial creation.
-   Retain a completed birth marker after Pregnancy reset. A missing baby must not recreate a completed operation because the item may have been transferred, dropped, or consumed.
-   Treat birth animation cancellation as presentation interruption: run timed-action cleanup, release movement, retain the pending operation, and retry its same ID on the next in-game minute. Do not complete a birth from `stop()`.
-   Retain and resend the exact completion envelope on `EveryOneMinute` until a correlated response arrives. An unsolicited snapshot resolves that retry only when `completedBirthId` exactly matches the submitted operation; merely lacking `pendingBirthId` does not prove completion.
-   Treat `OnDisconnect` and `OnConnected` as idempotent connection-reset boundaries. They clear snapshots, correlations, queues, and optimistic publisher state without sending; the next minute bootstraps a fresh snapshot. If it still reports a submitted birth as pending, resubmit completion without replaying the animation.
-   Server completion retries are idempotent after `completedBirthId` is persisted: they return the current snapshot without creating or synchronizing another item and without incrementing `stateVersion`.
-   Reject birth allocation and completion whenever the authenticated command player is already dead. Keep the snapshot unchanged, and let client death presentation become terminal until a new player object binds and receives fresh authority.
-   Persist ownership/provenance so ZLBF never removes or restores effects it did not introduce.

## Remaining Questions

-   Which Build 42 fluid mutations synchronize automatically after server-authoritative recipe completion?
-   Does `syncItemFields` after server-side `FluidContainer.addFluid` converge amount and primary fluid for both the crafting client and observers in hosted and dedicated multiplayer?
-   How large is the crash window between inventory mutation and authoritative player-ModData persistence?
-   Does the implemented same-session exact-envelope retry remain correct under deliberately dropped, delayed, and reordered responses?

## In-Game Validation

Repeat the validated hosted/co-op birth and recipe flows as regression coverage, then run them on a dedicated server with two clients. Use distinct account and character names and verify character-scoped birth IDs, `motherName`, BabyData v2, transfer/equip, reconnect/restart persistence, cancellation retry, and duplicate completion. Deliberately drop or delay acknowledgements where instrumentation permits. Execute each fluid recipe as a remote client and compare the server, crafting actor, and observer states.

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
-   2026-08-17: Selected and implemented character-scoped cancel-on-death. Dead allocation/completion requests are rejected without mutation; the exact bound client character becomes presentation-terminal, and replacement characters wait for a fresh snapshot. Username-based birth-ID reuse across permadeath remains a separate provenance limitation.
-   2026-08-21: Selected server-generated per-character UUID identity. New births use
    `<characterId>:birth:<sequence>` and BabyData v2 records `motherCharacterId`; migrated pending
    username-based operations retain and complete with their exact historical ID.
-   2026-08-22: Recorded successful SP and hosted/co-op validation of authoritative recipes, Womb and Lactation fluid mutations for the acting player, resumable/retried birth, reconnect, recovery state, and the schema-v2 character-identity migration. Dedicated-server, observer-fluid, focused BabyData-v2 inspection, packet-loss, and crash-atomicity checks remain open.

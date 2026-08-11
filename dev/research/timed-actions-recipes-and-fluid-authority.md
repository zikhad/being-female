# Timed Actions, Recipes, And Fluid Authority

Status: investigating  
Last updated: 2026-08-11
Project Zomboid build: 42.x  
Scope: client, server, multiplayer

## Question

Which pregnancy, recipe, inventory, and fluid effects require server authority, and which should remain client presentation?

## Conclusion

Pregnancy status and elapsed progression are now server-persisted from client-published desired state, while simulation, labor side effects, and birth remain client-owned. Birth and several recipe/fluid paths still combine presentation with persistent mutation. Exact-once birth requires a persisted server lifecycle marker or idempotency key. Animation and UI should remain client-side and react to accepted transitions.

The public `ZLBFIntercourse` event remains the integration boundary for debug controls and other mods. Womb performs sperm, contraceptive, fertility, and random-conception logic locally; only a successful `ZLBFPregnancyStart` result publishes the normal persisted Pregnancy transition. Duplicate start results are idempotent while the desired or acknowledged state is already pregnant.

Recipe callback context and Build 42 fluid/inventory replication are unverified. Commands must validate inventory ownership, identity, quantities, and capacity rather than accepting arbitrary client-selected objects.

Reference Mod demonstrates a safe pattern for reversible effects: the client publishes desired state and the server validates, reconciles, persists, and acknowledges it. ZLBF does not require anti-cheat validation for its private progression values, so Pregnancy, cycle/Womb, and Lactation simulation may remain client-owned while the server owns durable state and convergence. Server-observable facts and external game-owned resources must still be re-read and validated on the server.

Desired-state reconciliation does not make irreversible operations exact-once. Birth, baby creation, and destructive inventory/fluid transfers still require persisted lifecycle or operation identifiers and server-side validation.

## Evidence

-   `src/client/ZLBF/Actions/ZLBFBirth.ts` directly creates the baby and stops pregnancy from a client timed action.
-   `src/client/ZLBF/components/Pregnancy.ts` advances Pregnancy presentation and labor locally while publishing reversible progress for server persistence.
-   `src/client/ZLBF/components/Womb.ts` listens for `ZLBFIntercourse`, computes conception, and emits `ZLBFPregnancyStart`; `Pregnancy.ts` publishes that successful lifecycle transition instead of directly mutating local state.
-   See [EveryOneMinute server progression](every-one-minute-server-progression.md): collapsed minute jumps require timestamp-delta reconciliation, but ZLBF selected client publication instead of server player iteration for reversible progression.
-   `src/server/ZLBFRecipes.ts` imports client singleton state while callbacks mutate player state and fluid inventory.
-   `src/shared/components/FluidContainerApi.ts` appears to remove a requested amount and then all remaining fluid in `clear(amount)`; investigate separately.
-   Reference Mod `src/shared/components/PlushieReconciler.ts` calculates deterministic desired-state deltas without game mutation.
-   Reference Mod `src/server/components/domain command handler.ts` validates live attachments and persists only traits actually added/suppressed by the mod.

## Runtime And Version Applicability

The concern applies to Build 42 multiplayer. UI and animation are client concerns; persistent transitions and externally visible inventory/fluid values require verified authority.

## Confidence

Confidence: high that birth needs idempotent server authority; low for recipe context and fluid replication pending runtime tests.

## Implications For ZLBF

-   Add a persisted lifecycle marker/idempotency key before Pregnancy migration.
-   Keep reversible Pregnancy, cycle/Womb, and Lactation simulation on the owning client and publish desired state for validated server persistence.
-   Coalesce progression while a request is pending and apply acknowledged snapshots for convergence.
-   Validate inventory ownership and quantities server-side.
-   Research recipes before Womb or Lactation fluid migration.
-   Treat `FluidContainerApi.clear(amount)` as a separate bug investigation.
-   Use pure desired-state reconciliation for reversible effects, but use explicit intent plus idempotency for irreversible actions.
-   Persist ownership/provenance so ZLBF never removes or restores effects it did not introduce.

## Remaining Questions

-   Which context runs Build 42 recipe callbacks in hosted and dedicated multiplayer?
-   Which inventory/fluid mutations synchronize automatically?
-   What stable item identity should commands use?
-   How does labor recover after reconnect without duplicate birth?

## In-Game Validation

Attempt duplicate/cancelled birth around reconnect and verify one result. Execute each fluid recipe as host and remote client, logging callback context and comparing server, actor, and observer state.

## History

-   2026-08-04: Initial investigation; recipe and fluid authority remain open.
-   2026-08-04: Added Reference Mod reconciliation and ownership findings; exact-once and fluid authority remain open.
-   2026-08-11: Clarified that Pregnancy status is authoritative while progression remains client-owned; linked the minute-event research.
-   2026-08-11: Selected client-simulated, server-persisted progression across reversible domains; retained server authority for irreversible and external-resource effects.
-   2026-08-11: Implemented Pregnancy progression publication; labor and birth remain outside the persisted reversible transition.
-   2026-08-11: Preserved `ZLBFIntercourse` as the public conception entrypoint and persisted only successful `ZLBFPregnancyStart` transitions.

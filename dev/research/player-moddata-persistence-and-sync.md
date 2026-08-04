# Player ModData Persistence And Synchronization

Status: investigating  
Last updated: 2026-08-04  
Project Zomboid build: 42.x  
Scope: server, multiplayer

## Question

Can server-side player ModData hold authoritative ZLBF state, and how does it persist or synchronize?

## Conclusion

Server-side `player.getModData()` is a plausible per-character persistence location, but local evidence does not establish nested TSTL-table persistence or automatic server/client replication. Use explicit command responses for client mirrors and do not assume client ModData writes reach the server.

An earlier ZLBF experiment read legacy keys from the server player while gameplay wrote them locally on the client without `transmitModData`; multiplayer snapshots could therefore contain defaults rather than existing client state. Those experimental networking files are not present on the current branch.

Reference Mod provides a useful storage design: one server-owned key containing `{ protocol, authoritative }`, accessed through a wrapper that supports Kahlua `get/set` and property access, seeds missing values, and normalizes partial state every time it is loaded. Its domain handler persists ownership metadata so cleanup reverses only traits and XP effects that Reference Mod actually introduced.

Reference Mod still does not call `transmitModData`, and the inspected code/tests do not prove nested save/reload durability or automatic client replication. Those questions remain open for ZLBF.

## Evidence

-   Historical ZLBF multiplayer experiment: the server read three legacy domain keys from server-side player ModData; those files are absent on this branch.
-   `src/client/ZLBF/components/ModData.ts` and domain components mutate local ModData without an explicit transmission path.
-   Static `KahluaTable` declarations do not establish save timing, nested conversion, or replication.
-   Reference Mod `src/shared/components/ModData.ts` normalizes and writes server state through either Kahlua or property access.
-   Reference Mod `src/server/components/CommandHandler.ts` separates protocol metadata from authoritative domain state and exposes a migration boundary.
-   Reference Mod `src/server/components/domain command handler.ts` records effect ownership/provenance.

## Runtime And Version Applicability

This uncertainty applies to Build 42 multiplayer; single-player can mask client/server separation.

## Confidence

Confidence: medium that server player ModData is a viable store; low for nested persistence and replication semantics.

## Implications For ZLBF

-   Add server-owned normalization and legacy migration.
-   Use command responses as explicit mirror transport.
-   Do not claim authority until domain reads and writes consume server state.
-   Keep wire-schema handling separate from saved-data migration.
-   Track ownership for traits, items, fluids, and lifecycle effects so rollback removes only ZLBF-owned changes.
-   Normalize partial persisted state before domain code runs, but do not confuse filling missing fields with a complete version migration.

## Remaining Questions

-   Do nested TSTL objects persist as Kahlua tables?
-   When is server player ModData saved?
-   Does ModData replicate automatically in either direction?
-   How should existing client-only saves migrate?
-   Should protocol/session bookkeeping be persisted with domain state, or kept connection-scoped to avoid replay-reset mistakes?

## In-Game Validation

Write nested values server-side, compare both sides, save/restart/reconnect, and compare again. Then mutate only the client copy without transmission. Repeat on hosted and dedicated servers with two players.

## History

-   2026-08-04: Initial investigation; persistence and replication remain unverified.
-   2026-08-04: Added Reference Mod server-store, normalization, migration-boundary, and ownership patterns; persistence/replication status remains investigating.

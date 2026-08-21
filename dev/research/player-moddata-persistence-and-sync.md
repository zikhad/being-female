# Player ModData Persistence And Synchronization

Status: partially verified

Last updated: 2026-08-05

Project Zomboid build: 42.12 / 42.x

Scope: server, multiplayer

## Question

Can server-side player ModData hold authoritative ZLBF state, and how does it persist or synchronize?

## Conclusion

Build 42 player ModData is part of the player save chain. Installed Build 42.12 bytecode shows `IsoPlayer.save` reaches `IsoObject.save`, which serializes its nonempty Kahlua table; `KahluaTableImpl.save` recursively supports strings, finite numbers, booleans, and nested tables. This directly supports a nested server-owned ZLBF root made from ordinary generated Lua tables.

Reference Mod implements that boundary under one player key, normalizes and rewrites the root on access, mutates it through the authenticated server player, and returns client-visible results through targeted server commands. It never calls `transmitModData`. The project owner confirms this ModData behavior works in single-player and multiplayer, although that whole-mod runtime report does not isolate restart timing or automatic replication.

ZLBF should therefore persist authoritative domain state only on the server and maintain clients through explicit validated snapshots. It must not rely on client ModData writes or automatic replication. Exact hosted/dedicated restart and disconnect durability remains to be verified in-game.

An earlier ZLBF experiment read legacy keys from the server player while gameplay wrote them locally on the client without a transmission path; multiplayer snapshots could therefore contain defaults rather than existing client state. Those experimental networking files are not present on the current branch.

## Evidence

### Build 42.12 save path

-   Installed game bytecode shows the player save chain reaching `IsoObject.save(ByteBuffer, boolean)` through the `IsoPlayer`, `IsoLivingCharacter`, `IsoGameCharacter`, and `IsoMovingObject` superclass chain.
-   `IsoObject.save` calls `KahluaTable.save(ByteBuffer)` when its ModData table is non-null and nonempty.
-   `KahluaTableImpl.save` recursively serializes supported nested table values. Supported value categories include strings, doubles, booleans, and tables; unsupported key/value pairs are omitted.
-   Generated TSTL objects and arrays are ordinary Lua tables and therefore fit this serialization boundary when they contain only supported primitive values and nested tables.
-   Java userdata, functions, `undefined`, `NaN`, and infinity must not be stored in the authoritative root.

### Reference Mod implementation and runtime evidence

-   Reference Mod `src/shared/components/ModData.ts` reads and writes through Kahlua `get/set` when present, falls back to property access, seeds missing state, normalizes it, and writes the complete root back on every access.
-   Its server command handler stores one player value shaped as `{ protocol, authoritative }`, obtains it from the authenticated event-supplied player, and exposes a separate authoritative migration hook.
-   Its domain handler re-reads server-observed facts, reconciles them, assigns a newly constructed authoritative nested table, and returns a targeted response.
-   Persisted authoritative data contains nested arrays and a keyed numeric table. The generated Lua preserves those as ordinary nested tables.
-   A source and generated-output search found no `transmitModData` call. Its client mirror is updated through command responses rather than player ModData replication.
-   The project owner confirms the ModData behavior works across actual single-player and multiplayer use. This is direct runtime evidence for the implementation as a whole, not an isolated proof of restart timing or automatic replication.

### Transmission and current ZLBF boundary

-   Vanilla Build 42 client UI writes a player preference and then explicitly calls `player:transmitModData()`, demonstrating that the method is an explicit network action rather than a prerequisite for save serialization.
-   Object bytecode treats `transmitModData` as network-oriented: the client sends an object-ModData packet and the server distributes object ModData. ZLBF does not need that broader path because its server is authoritative and clients receive targeted snapshots.
-   Current ZLBF `CommandHandler` correctly uses the event-supplied player and a targeted response, but still returns constant state metadata rather than loading persisted state.
-   Current ZLBF `SyncPublisher` validates and correlates the response before updating its in-memory `SnapshotStore`.
-   Existing client domains still mutate local player ModData without an authoritative server path and must not be treated as multiplayer truth.

## Runtime And Version Applicability

The serialization evidence applies directly to installed Build 42.12 and structurally to Build 42.x. The Reference Mod evidence applies to its deployed Build 42 single-player and multiplayer behavior. Hosted and dedicated save scheduling, immediate disconnect timing, and abnormal shutdown durability remain runtime-sensitive. Single-player can still mask process-boundary mistakes.

## Confidence

Confidence: high that nested supported Lua tables in player ModData are serialized by the Build 42 player save path; high that Reference Mod uses server-owned nested state and explicit responses without `transmitModData`; medium-high that this boundary transfers safely to ZLBF; medium for exact disconnect and save timing.

## Implications For ZLBF

-   Store one server-owned player root such as `{ schemaVersion, stateVersion, domains }`.
-   Store only strings, finite numbers, booleans, and nested tables.
-   Accept only a complete current-schema root. Reset missing, older, or malformed roots to a fresh
    current state; preserve unsupported future roots without rewriting them.
-   Keep an explicit version-dispatch seam for future migrations instead of salvaging individual
    domains implicitly.
-   Keep wire protocol versions separate from persisted-data versions and migrations.
-   Increment `stateVersion` only after a successful authoritative domain transition; read-only snapshot requests must not increment it.
-   Keep connection epochs, pending requests, replay windows, and client revisions out of persistent domain state.
-   Use targeted command responses as the explicit client mirror transport; do not call `transmitModData` for this design.
-   Do not claim domain authority until gameplay reads and writes consume the server-owned root.
-   Track ownership for traits, items, fluids, and lifecycle effects so rollback removes only ZLBF-owned changes.

## Remaining Questions

-   Which exact server save and disconnect points persist a just-written player table?
-   Can abnormal shutdown or immediate disconnect lose the latest mutation?
-   What player ModData does `transmitModData` expose, to which peers, and in which direction?
-   No import is required for the unpublished authoritative format. The proven single-player local
    ModData path remains a separate runtime backend and is not imported by the multiplayer server.

## In-Game Validation

Persist a diagnostic ZLBF root containing schema and state versions, a nested object, numeric-key array, boolean, string, and fractional number. Then:

1. In single-player, write server-side, save/quit normally, restart, and compare the loaded server state with the targeted client snapshot.
2. In hosted multiplayer, repeat across reconnect and host save/quit/restart.
3. On a dedicated server, repeat across reconnect and graceful restart with two players holding distinct values.
4. Modify only the client player's same key without transmission and confirm the server and subsequent snapshot remain unchanged.
5. Modify only server ModData without `transmitModData`; confirm restart persistence and that the client learns the value only through the response.
6. Seed partial or older data and confirm one load normalizes and persists the current schema.
7. Mutate immediately before disconnect and reconnect to test save timing.

## History

-   2026-08-04: Initial investigation; persistence and replication remain unverified.
-   2026-08-04: Added Reference Mod server-store, normalization, migration-boundary, and ownership patterns; persistence/replication status remains investigating.
-   2026-08-05: Confirmed recursive nested-table serialization in the Build 42.12 player save path; recorded Reference Mod runtime evidence and narrowed the remaining uncertainty to save timing, disconnect durability, and legacy migration.

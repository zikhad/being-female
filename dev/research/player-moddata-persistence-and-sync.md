# Player ModData Persistence And Synchronization

Status: partially verified

Last updated: 2026-08-22

Project Zomboid build: 42.12 / 42.x

Scope: server, multiplayer

## Question

Can server-side player ModData hold authoritative BF state, and how does it persist or synchronize?

## Conclusion

Build 42 player ModData is part of the player save chain. Installed Build 42.12 bytecode shows `IsoPlayer.save` reaches `IsoObject.save`, which serializes its nonempty Kahlua table; `KahluaTableImpl.save` recursively supports strings, finite numbers, booleans, and nested tables. This directly supports a nested server-owned BF root made from ordinary generated Lua tables.

Reference Mod implements that boundary under one player key, normalizes and rewrites the root on access, mutates it through the authenticated server player, and returns client-visible results through targeted server commands. It never calls `transmitModData`. The project owner confirms this ModData behavior works in single-player and multiplayer, although that whole-mod runtime report does not isolate restart timing or automatic replication.

BF now persists multiplayer domain state in one strict server-owned schema-v1 root with a required server-generated character identity and maintains clients through explicit validated snapshots. Because this format is unreleased, the final baseline uses a fresh `BF.State` ModData namespace and ignores earlier development roots rather than migrating or salvaging them; future schemas within the final namespace remain protected from downgrade. Single-player intentionally remains on its proven local ModData backend. User testing on 2026-08-22 confirmed the hosted/co-op authoritative path and the separate SP path before this final baseline cleanup. Dedicated-server and abnormal-shutdown durability remain unverified.

Historically, an earlier BF experiment read local keys from the server player while gameplay wrote them only in the client context, so multiplayer snapshots could contain defaults. That design is superseded: multiplayer gameplay consumes the authoritative root, while SP local state is a deliberate separate runtime backend and is never imported by the multiplayer server.

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

### Transmission and current BF boundary

-   Vanilla Build 42 client UI writes a player preference and then explicitly calls `player:transmitModData()`, demonstrating that the method is an explicit network action rather than a prerequisite for save serialization.
-   Object bytecode treats `transmitModData` as network-oriented: the client sends an object-ModData packet and the server distributes object ModData. BF does not need that broader path because its server is authoritative and clients receive targeted snapshots.
-   Current BF `CommandHandler` uses the event-supplied player, validates commands, loads and mutates the server-owned root, and returns targeted authoritative snapshots.
-   Current BF publishers validate and correlate responses before updating their in-memory `SnapshotStore`; hosted/co-op reconnect and persistence behavior has been exercised successfully.
-   Multiplayer persistence uses strict schema v1. Its server-private `characterId` is assigned when the authoritative root is created; new birth IDs are character-scoped and BabyData v1 retains that identity.
-   Single-player client domains intentionally use direct local state and recipes. This runtime split is working behavior, not a legacy import path or multiplayer truth source.

## Runtime And Version Applicability

The serialization evidence applies directly to installed Build 42.12 and structurally to Build 42.x. BF's SP and hosted/co-op paths were exercised on 2026-08-22. The final unreleased schema-v1 baseline intentionally resets earlier development roots and has not been revalidated yet. Dedicated save scheduling, immediate disconnect timing, and abnormal shutdown durability remain runtime-sensitive.

## Confidence

Confidence: high that supported nested Lua tables serialize and that BF's strict root design, SP-local split, and hosted/co-op snapshot transport work in the tested flows; medium-high for the clean schema-v1 baseline from source and automated tests; medium for exact disconnect/save timing; low for abnormal shutdown and dedicated-server durability.

## Implications For BF

-   Store one server-owned player root such as `{ schemaVersion, characterId, stateVersion, domains }`.
-   Generate `characterId` once on the server with `getRandomUUID()` when a character root is
    created. Keep it private to persistence; client snapshots need only gameplay domains.
-   Store only strings, finite numbers, booleans, and nested tables.
-   Accept only a complete current-schema root. Schema v1 requires a bounded nonempty
    `characterId`; malformed roots reset fresh, while unsupported future roots remain untouched.
-   Introduce explicit version migrations only after a released schema needs compatibility; do not
    preserve unreleased development roots.
-   Keep wire protocol versions separate from persisted-data versions and migrations.
-   Increment `stateVersion` only after a successful authoritative domain transition; read-only snapshot requests must not increment it.
-   Keep connection epochs, pending requests, replay windows, and client revisions out of persistent domain state.
-   Use targeted command responses as the explicit client mirror transport; do not call `transmitModData` for this design.
-   Keep multiplayer gameplay reads and writes on the server-owned root; do not reintroduce local-key imports into multiplayer authority.
-   Track ownership for traits, items, fluids, and lifecycle effects so rollback removes only BF-owned changes.

## Remaining Questions

-   Which exact server save and disconnect points persist a just-written player table?
-   Can abnormal shutdown or immediate disconnect lose the latest mutation?
-   What player ModData does `transmitModData` expose, to which peers, and in which direction? This is not required by the current targeted-snapshot design.

## In-Game Validation

Persist a diagnostic BF root containing schema and state versions, a nested object, numeric-key array, boolean, string, and fractional number. Then:

1. In single-player, write server-side, save/quit normally, restart, and compare the loaded server state with the targeted client snapshot.
2. In hosted multiplayer, repeat across reconnect and host save/quit/restart.
3. On a dedicated server, repeat across reconnect and graceful restart with two players holding distinct values.
4. Modify only the client player's same key without transmission and confirm the server and subsequent snapshot remain unchanged.
5. Modify only server ModData without `transmitModData`; confirm restart persistence and that the client learns the value only through the response.
6. Seed malformed or noncurrent development data and confirm it resets to a fresh schema-v1 root;
   reload a valid current root and confirm its character identity remains stable.
7. Mutate immediately before disconnect and reconnect to test save timing.

## History

-   2026-08-04: Initial investigation; persistence and replication remain unverified.
-   2026-08-04: Added Reference Mod server-store, normalization, migration-boundary, and ownership patterns; persistence/replication status remains investigating.
-   2026-08-05: Confirmed recursive nested-table serialization in the Build 42.12 player save path; recorded Reference Mod runtime evidence and narrowed the remaining uncertainty to save timing, disconnect durability, and legacy migration.
-   2026-08-21: Defined schema-v2 character identity: server-only `getRandomUUID()` allocation,
    strict current validation, explicit state-preserving v1 migration, and no wire-protocol change.
-   2026-08-22: Recorded successful existing-character v1-to-v2 migration and SP/hosted-co-op validation. Clarified that SP local state is an intentional runtime backend and that dedicated/abnormal-shutdown durability remains open.
-   2026-08-22: Superseded the unreleased v1-to-v2 migration with a clean schema-v1 baseline that
    requires `characterId`; rotated persistence to `BF.State` so earlier development roots are
    intentionally ignored without compatibility code.

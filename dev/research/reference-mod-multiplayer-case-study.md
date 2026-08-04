# Reference Mod Multiplayer Case Study

Status: partially verified  
Last updated: 2026-08-04  
Project Zomboid build: 42.x  
Scope: client, server, shared, multiplayer

## Question

Which multiplayer patterns used by the PipeWrench-based Reference Mod are proven in its implementation, and which are safe to transfer to ZLBF?

## Source

The inspected project is a private PipeWrench-based Project Zomboid mod referred to throughout these notes as the **Reference Mod**. Repository location, project name, release version, and commit identifiers are intentionally omitted.

Reference Mod is treated as a deployed implementation example, not an authoritative Project Zomboid engine specification. Its code proves how that mod is structured. The project owner additionally confirms from actual use that Reference Mod works as intended in both single-player and multiplayer, providing runtime evidence for its unified command path. This does not by itself prove persistence internals, reconnect safety, or exact-once behavior.

## Observed Architecture

### Entry points and lifecycle

-   The client entrypoint constructs the client domain from the `IsoPlayer` supplied by `OnCreatePlayer`.
-   The client domain component runs observation and synchronization from `EveryOneMinute`.
-   The server entrypoint creates a singleton command handler and registers `OnClientCommand(module, command, player, args)`.
-   The server filters the module and passes the event-supplied player into the handler. Payload identity is not used to choose the affected player.

The periodic publisher avoids relying on `OnCreatePlayer` as a network-ready bootstrap moment. It observes desired state after the player exists and sends only when that state differs from its local reference. This is appropriate for the Reference Mod's reversible, eventually consistent plushie state; it is not sufficient for irreversible ZLBF operations.

### Transport contract

-   `src/shared/constants.ts` defines one module name, a protocol schema version, and request/response command pairs.
-   `src/types.d.ts` defines the generic `{ schemaVersion, revision, data }` envelope.
-   `src/client/components/PlushieSyncPublisher.ts` calls `sendClientCommand(player, module, requestCommand, payload)`.
-   `src/server/components/CommandHandler.ts` performs module/command filtering and calls domain logic for accepted requests.
-   Responses use targeted `sendServerCommand(player, module, responseCommand, payload)` so the event-supplied player receives the reply.
-   Independent generated client, server, and shared Lua entrypoints preserve these signatures and load paths under the Build 42 media layout.

### Authority and reconciliation

-   The client sends a desired set of known plushie names; it does not directly apply traits or XP.
-   `src/server/components/domain command handler.ts` re-reads attachments from the server-side player, rejects unknown or unattached names, reconciles the desired state, mutates traits/XP, persists the result, and replies with applied/rejected names.
-   `src/shared/components/PlushieReconciler.ts` is a pure function that calculates minimal deltas and the next authoritative state.
-   The handler records ownership metadata: traits actually added by Reference Mod and traits actually suppressed by it. Detaching therefore does not remove a trait the player already owned or restore one that Reference Mod never removed.

This desired-state pattern is safely transferable to reversible ZLBF state: clients publish intent, the server validates live facts and persisted state, a pure reconciler computes changes, and only the server commits them.

It does not establish exact-once semantics for birth, item creation, or destructive fluid/inventory operations. Those require persisted lifecycle or operation idempotency.

### Persistence boundary

-   Server ModData under the mod's private key contains `{ protocol, authoritative }`.
-   `src/shared/components/ModData.ts` supports Kahlua `get/set` and property access, seeds missing data, and normalizes data on access.
-   `CommandHandler.ensureServerModData` normalizes protocol fields and delegates authoritative migration.
-   `domain command handler.migrateAuthoritativeData` currently fills missing fields; version-specific migrations remain TODO.
-   No explicit `transmitModData` call exists.

This proves a clean server-owned storage abstraction, but not automatic replication or save/reload durability of nested TSTL data.

## Safe Patterns To Transfer

1. Keep client, server, and shared entrypoints separate so generated Lua loads in the correct context.
2. Centralize module/command routing, envelope construction, response targeting, and common validation.
3. Treat `OnClientCommand`'s player as the authenticated subject.
4. Re-read live game state and validate every client claim server-side.
5. Use pure deterministic reconciliation for repeatable desired-state domains.
6. Track ownership/provenance so cleanup reverses only effects introduced by ZLBF.
7. Separate transport schema handling from persisted-state normalization/migration.
8. Return explicit authoritative results to the requesting client.
9. Test routing, validation, reconciliation, persistence shaping, and generated Lua boundaries separately.

## Patterns Not Safe To Copy Unchanged

### Revision-one reconnect reset

`src/server/components/CommandHandler.ts` resets persisted ordering whenever `payload.revision === 1`. A delayed or replayed revision-one command can reopen acceptance of older operations. Reference Mod tests explicitly preserve this behavior, but deployment history does not make it replay-safe.

ZLBF must use a server-established session/epoch or domain idempotency keys for side-effecting commands. Read-only requests can remain repeatable without persisted ordering.

### Eager client acknowledgment and dropped requests

`PlushieSyncPublisher.send` updates `lastKnownNames` before receiving a server acknowledgment. If a packet is dropped and attachments do not change again, later ticks do not retry. ZLBF should distinguish last observed, last sent, and last acknowledged state, with bounded retry or corrective synchronization.

### Incomplete response correlation

The publisher filters module, command, and schema, but does not reject future, late, duplicate, or unsolicited revisions. ZLBF responses must correlate to an outstanding request or operation.

### Missing runtime payload validation

The generic handler casts raw `args` and dereferences its fields. Domain code assumes `payload.data.desiredNames` is present and iterable. ZLBF must validate table shape, schema, finite positive revisions, domain fields, collection size, and identifiers before state access or mutation.

### Revision committed before domain success

Reference Mod records the accepted revision before domain mutation completes. An exception can make a retry appear stale after a partial or failed operation. ZLBF should validate first, compute the next state, commit domain state and idempotency bookkeeping together as closely as the runtime permits, then respond.

### Stale rejection semantics

Reference Mod returns requested names as rejected for stale commands, while the client merges applied and rejected names into its tracking reference. This can suppress corrective synchronization rather than align the client with authoritative server state. ZLBF rejection replies should carry explicit status and, when useful, the authoritative current state.

### Listener lifecycle

Each publisher instance registers a global server-command listener without disposal or player scoping. ZLBF should ensure one listener per local-player lifecycle, route replies to the intended publisher, and avoid duplicate registrations after reload/reconnect.

### Single-player evidence and transfer boundary

Reference Mod documentation says the same server-authoritative path works in single-player, its tests assert that the publisher sends there, and the project owner confirms that the released mod works as intended in actual single-player and multiplayer use. This is sufficient runtime evidence for the Reference Mod's current architecture.

It is not sufficient to assume ZLBF will work automatically. Reference Mod publishes reversible desired state from `EveryOneMinute`, after the player exists, while an earlier ZLBF bootstrap experiment sent immediately during lifecycle events and observed a dropped command. ZLBF must still validate its own entrypoint timing and delivery in each supported mode.

## ZLBF Architecture Implications

-   Use separate commands per bounded domain instead of one large mutable snapshot.
-   Prefer desired-state commands for reversible state and explicit intents for validated transitions.
-   Keep presentation—UI, sounds, and animations—client-side, driven by authoritative responses.
-   Put mutation, validation, persistence, and ownership tracking on the server.
-   Normalize persisted state on every access and implement explicit version migrations when the shape changes.
-   Introduce persisted lifecycle/idempotency markers before Pregnancy birth or inventory creation.
-   Do not migrate Womb or Lactation fluid operations until recipe and inventory authority are verified.

## Suggested Validation

1. Confirm generated client/server/shared entrypoints load exactly once.
2. Confirm a four-argument client command reaches the event-supplied player handler in hosted and dedicated multiplayer.
3. Confirm targeted server replies reach only the requesting client with two connected players.
4. Reproduce single-player command delivery in ZLBF; Reference Mod establishes that the engine can support the unified path, not that every lifecycle timing is valid.
5. Drop or delay requests/responses and verify bounded retries and response correlation.
6. Save, restart, and reconnect to verify normalized nested authoritative state.
7. Replay a revision-one and duplicate operation to verify no irreversible effect repeats.

## Confidence

Confidence: high for Reference Mod source structure, its deployed SP/MP behavior based on project-owner runtime confirmation, and the transferable reconciliation/validation boundaries; low for engine-level persistence and reconnect semantics not isolated during this research.

## History

-   2026-08-04: Initial case study of the private Reference Mod implementation.
-   2026-08-04: Recorded project-owner confirmation that Reference Mod works as intended in actual single-player and multiplayer use.

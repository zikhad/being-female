# ZLBF Multiplayer Refactor Plan (Build 42, PipeWrench)

## Goal
Refactor `zlbf-pipewrench` from local client-side state mutation to a **server-authoritative multiplayer model** inspired by `naninhas`, while preserving single-player behavior via the same network path.

## Why this refactor
Current ZLBF gameplay state (`Womb`, `Pregnancy`, `Lactation`) is mutated on the client through timed events and local modData. This works in local play but is not safe for multiplayer consistency, replay/out-of-order packets, or reconnect scenarios.

`naninhas` already has a proven architecture for this:
- typed command envelopes (`schemaVersion`, `revision`, `data`)
- request/response command pairs
- server persisted protocol bookkeeping
- explicit request schema mismatch rejection on server
- explicit response schema mismatch ignore on client
- stale/out-of-order request rejection
- reconnect reset handling (`revision === 1` after reconnect)
- tests that lock behavior

## Scope (initial)
In scope:
- Add multiplayer command protocol foundation to ZLBF.
- Add generic server command handling base (module/command filtering, revision checks, response envelope).
- Introduce authoritative state model for domain components.
- Migrate domain logic gradually to server authority.
- Add Jest coverage for transport + domain handlers.

Out of scope (for first pass):
- UI redesigns or deep UX changes.
- Build 41 support additions.
- Broad gameplay balancing changes not required for MP correctness.

## Design principles
1. Server authoritative: client sends intent/snapshot, server validates and applies truth.
2. Unified path: same request/response flow in SP and MP to reduce divergence.
3. Treat transport schema and persisted data schema as separate concerns.
4. Deterministic transitions: isolate pure reconciliation logic where possible.
5. Lua-safe TypeScript: avoid JS patterns that transpile poorly in `typescript-to-lua`.
6. Backward-safe persisted data: schema-aware migration hooks from day one.

## Current baseline in ZLBF (to migrate)
- `src/client/ZLBF/components/Womb.ts`: local mutable womb state (`ZLBFWomb` modData).
- `src/client/ZLBF/components/Pregnancy.ts`: local pregnancy progression + birth workflow.
- `src/client/ZLBF/components/Lactation.ts`: local milk lifecycle state (`ZLBFLactation` modData).
- `src/client/ZLBF/components/ModData.ts`: local wrapper without ensure/migration path.
- No `sendClientCommand` / `sendServerCommand` command flow currently present.

## Target architecture

### 1) Shared protocol layer
Add a shared networking contract similar to naninhas.

Proposed artifacts:
- `src/shared/constants.ts`
  - `NETWORK_MODULE` (e.g. `"ZLBF"`)
  - `PROTOCOL_SCHEMA_VERSION`
  - typed command pairs
- `src/types.d.ts` (or shared type module)
  - `CommandPayload<T>`
  - `ServerProtocolState`
  - `ServerModData<TAuthoritative>`
  - request/response payloads per command

### 2) Server command framework
Add a reusable base command handler.

Proposed artifacts:
- `src/server/components/CommandHandler.ts`
  - ignore unrelated module/command
  - reject unsupported request `schemaVersion` before domain logic
  - load/normalize persisted modData
  - stale/out-of-order filtering by `revision`
  - reconnect reset behavior (`revision=1`)
  - ensure protocol bookkeeping is not mutated on schema mismatch
  - response envelope helper
  - migration hook for authoritative state

- `src/server/ZLBF.ts`
  - register `Events.onClientCommand.addListener`
  - dispatch into domain handlers

### 3) Domain command handlers (incremental migration)
Migrate per bounded context instead of all at once.

Phase order:
1. `Pregnancy` (lowest/moderate data shape complexity)
2. `Womb` (cycle/fertility transitions)
3. `Lactation` (stateful timed progression + multipliers)

Each domain should have:
- request payload (desired or tick intent)
- server validation
- pure reconciliation (if applicable)
- server apply + persist authoritative state
- response payload (applied state + rejections/warnings)

### 4) Client publisher/subscriber layer
Client components should stop directly owning truth for MP-sensitive state.

Proposed behavior:
- publish local intent/snapshot via `sendClientCommand`
- maintain `lastKnown` and monotonic `revision`
- ignore unsupported response `schemaVersion`
- update local mirrors from server responses
- remain tolerant to late replies

### 5) Compatibility boundaries
Keep these boundaries explicit in code and docs:

- Transport compatibility (request/response payloads): reject/ignore mismatches at the network boundary.
- Persisted compatibility (saved authoritative modData): normalize/migrate on load.
- Do not use persistence migration hooks to translate live network payloads.

## Proposed migration strategy

### Phase A - Foundation (no gameplay behavior change yet)
Deliverables:
- protocol constants/types
- generic server handler
- server entry registration
- smoke tests for handler lifecycle

Acceptance:
- Commands can round-trip envelope-level messages.
- Unsupported request schema is rejected safely before domain logic runs.
- Unsupported response schema is ignored safely on the client.
- Stale revision rejection works.
- Reconnect reset behavior works.

### Phase B - Pregnancy server authority
Deliverables:
- `PregnancyCommandHandler`
- `PregnancySyncPublisher` (client)
- migration of pregnancy progress/labor transitions to server-authoritative updates

Acceptance:
- pregnancy progression remains consistent across reconnects.
- stale requests do not regress state.
- birth trigger remains single-execution at labor edge.

### Phase C - Womb server authority
Deliverables:
- `WombCommandHandler`
- `WombSyncPublisher`
- server-side validation of intercourse/cycle progression effects

Acceptance:
- cycle and fertility state are persisted and consistent server-side.
- no client-only divergence after reconnect.

### Phase D - Lactation server authority
Deliverables:
- `LactationCommandHandler`
- `LactationSyncPublisher`
- server-authoritative toggles, expiration, and multiplier transitions

Acceptance:
- milk amount, expiration, and toggle state survive reconnect correctly.
- no duplicate or missing state transitions from out-of-order traffic.

### Phase E - Cleanup + hardening
Deliverables:
- remove dead local-authority code paths
- finalize schema migration guards
- document protocol in README/dev notes

Acceptance:
- all gameplay state transitions flow through authoritative server handlers.
- tests reflect final architecture.

## Data model sketch (first pass)

```ts
// shared envelope
export type CommandPayload<T> = {
  schemaVersion: number;
  revision: number;
  data: T;
};

export type ServerProtocolState = {
  lastClientRevision: number;
  lastSchemaVersion: number;
};

export type ServerModData<TAuthoritative> = {
  protocol: ServerProtocolState;
  authoritative: TAuthoritative;
};
```

Domain authoritative state examples:
- `PregnancyAuthoritativeState`
  - `current`, `progress`, `isInLabor`, optional lifecycle markers
- `WombAuthoritativeState`
  - `amount`, `total`, `cycleDay`, `onContraceptive`, `fertility`, `chances`
- `LactationAuthoritativeState`
  - `isActive`, `milkAmount`, `expiration`, `multiplier`

## Testing strategy

### Unit tests (required)
- `CommandHandler.spec.ts`
  - unrelated command/module ignored
  - unsupported schema rejected before loading modData
  - protocol bookkeeping unchanged on schema mismatch
  - reconnect reset accepted
  - stale rejected
  - ensure/migration behavior
  - response envelope correctness

- Domain handler specs
  - command validation
  - deterministic reconciliation/apply semantics
  - authoritative persistence correctness
  - edge cases (unknown payload values, empty/missing data)

- Publisher specs
  - first send
  - no resend on unchanged state
  - resend on change
  - revision monotonic
  - unsupported response schema ignored explicitly
  - stale/late reply tolerance

### Regression tests (strongly recommended)
- labor transition exact-once behavior
- trait add/remove idempotency
- toggles with fast attach/detach-like event patterns

## Risks and mitigations
1. Risk: duplicated side effects between client and server.
- Mitigation: move mutation into server handlers and keep client as publisher/view.

2. Risk: persisted data shape drift.
- Mitigation: include `ensure` + migration hook before any rollout.

3. Risk: event ordering race conditions.
- Mitigation: revision checks + explicit stale response behavior.

4. Risk: conflating transport schema evolution with persisted-state migration.
- Mitigation: keep explicit schema guards at network boundaries and separate migration hooks for saved data only.

5. Risk: gameplay regressions from migration.
- Mitigation: phase-by-phase migration with parity tests per domain.

## Open decisions (must resolve early)
1. Command granularity:
- One aggregated `SyncState` command vs separate domain commands.
- Recommendation: separate commands per domain for testability and smaller payloads.

2. Tick ownership:
- keep domain timers on client as intent source, or move periodic progression fully server-side.
- Recommendation: server should own progression where possible; client tick only when needed for local trigger input.

3. ModData storage keying:
- one shared key (`ZLBF`) with nested domains vs multiple keys (`ZLBFWomb`, `ZLBFLactation`, ...).
- Recommendation: one shared network protocol key + optional nested domain blocks.

## Suggested first implementation PR
1. Add shared protocol constants/types.
2. Add `src/server/components/CommandHandler.ts` and tests.
3. Add `src/server/ZLBF.ts` event wiring and test.
4. Add a minimal no-op domain command handler + round-trip test.
5. No domain behavior migration in this PR.

Expected value:
- Establishes the MP foundation with minimal gameplay risk.
- Enables incremental domain migration in follow-up PRs.

## Handoff checklist for next coding agent
- Read this file first.
- Verify existing test baseline passes before edits.
- Implement Phase A only unless explicitly asked for more.
- Keep public APIs stable unless migration requires explicit break.
- Add/update Jest tests in every step.
- Document any schema migration introduced.

## Notes captured from naninhas study
- naninhas architecture is reusable almost directly for transport concerns.
- Naninhas now explicitly rejects unsupported request schema on server and explicitly ignores unsupported response schema on client.
- Use reconnect reset behavior from naninhas (`revision==1` after persisted higher revision).
- Keep stale-command response explicit where the client needs correction.
- Project Zomboid usually blocks clients with mismatched mod installs, but schema guards are still valuable as defensive boundaries and testable contracts.
- Migration hooks in the server handler are for persisted `modData` compatibility, not for translating live wire payloads.

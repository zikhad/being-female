# ZLBF Multiplayer Refactor Plan (Server Authoritative)

Status: Planned
Date: 2026-06-30
Owner: ZLBF
Reference model: naninhas multiplayer architecture

## 1. Goal

Make zlbf-pipewrench multiplayer compatible by moving gameplay state ownership from client-side player modData writes to a server-authoritative flow with command/request and snapshot/reply synchronization.

Primary risk today:
- Current client components write directly into player getModData state.
- In multiplayer this can desync, conflict, or be bypassed by stale client state.

Target state:
- Server owns womb, pregnancy, and lactation state.
- Client sends intent only.
- Server validates, applies, persists, and replies with authoritative snapshot.
- Client UI and client-side effects consume snapshots.

## 2. Non-Goals (for first rollout)

- No new gameplay feature additions.
- No balancing redesign.
- No Build 41 compatibility expansion.
- No protocol support for older schemas beyond safe rejection and migration from legacy storage shape.

## 3. Architecture Direction

Adopt the same proven pattern used in naninhas:
- Shared protocol constants and schema version.
- Typed command payloads with revision counters.
- Client publisher(s) for intent.
- Server command handler(s) for validation and reconciliation.
- Server authoritative modData store.
- Server-to-client snapshot replies.
- Schema and stale revision handling.

## 4. Data Ownership Model

## 4.1 New server authoritative storage

Single server store under one key (example: ZLBF) with:
- protocol:
  - lastClientRevision
  - lastSchemaVersion
- authoritative:
  - womb data
  - pregnancy data
  - lactation data
  - optional meta fields needed for deterministic progression

## 4.2 Legacy migration support

Read and normalize old keys on first load:
- ZLBFWomb
- ZLBFPregnancy
- ZLBFLactation

Then write into unified authoritative structure.

## 4.3 Client cache model

Client components no longer mutate persistent modData directly.
They read local cache derived from latest authoritative snapshot.

## 5. Protocol Design

## 5.1 Shared constants

Add constants in shared layer:
- NETWORK_MODULE (example: ZLBF)
- PROTOCOL_SCHEMA_VERSION (start with 1)
- NetworkCommands enum

Proposed first commands:
- SyncStateRequest (client to server)
- SyncStateApplied (server to client)
- Optional action commands after baseline sync:
  - RequestIntercourse
  - RequestUseContraceptive
  - RequestPumpMilk
  - RequestToggleLactation (if needed)

## 5.2 Required payload fields

All request payloads include:
- schemaVersion
- revision
- intent data

All response payloads include:
- schemaVersion
- revision
- authoritative state snapshot
- optional rejection reason or partial rejection metadata

## 5.3 Revision policy

- Server rejects stale revision requests.
- Server accepts reconnect reset pattern safely (client revision returns to 1).
- Server echoes accepted revision in replies.

## 6. Phased Execution Plan

## Phase 0: Baseline and Guardrails

Tasks:
- Add docs and checklist (this file).
- Capture baseline tests and behavior assumptions.
- Identify all direct client writes to persistent modData and mark them.

Deliverables:
- Confirmed write map for Womb, Pregnancy, Lactation, PregnancyState, Player base class.

Acceptance criteria:
- Existing tests pass before refactor starts.

## Phase 1: Multiplayer Foundations

Tasks:
- Create shared protocol constants and payload types.
- Add server entrypoint listener for OnClientCommand routing.
- Add minimal server handler for SyncStateRequest that returns snapshot.
- Add client subscriber for OnServerCommand and local snapshot application.

Deliverables:
- End-to-end request/reply pipeline with no gameplay mutation yet.

Acceptance criteria:
- Client can request and receive authoritative snapshot in MP.
- Schema mismatch and invalid payload are safely rejected.

## Phase 2: Authoritative Store and Migration

Tasks:
- Implement server ModData wrapper compatibility for KahluaTable and plain object paths (if needed).
- Add ensure/normalizer for server state.
- Implement legacy migration from old keys into unified store.
- Persist protocol state fields.

Deliverables:
- Stable server authoritative state object.
- Migration path for existing saves.

Acceptance criteria:
- Existing saves load without state loss.
- Partially missing structures are normalized without runtime errors.

## Phase 3: Server Reconciliation Logic

Tasks:
- Introduce ZLBF server command handler class.
- Move core state transitions to server-side methods:
  - cycle updates
  - fertility updates
  - pregnancy progression and labor transitions
  - lactation progression and expiration
- Keep deterministic ordering for minute/hour/day ticks.
- Reply with updated snapshots when state changes.

Deliverables:
- Server authoritative game logic for mutable state.

Acceptance criteria:
- Multiple clients observe consistent state for same player.
- Out-of-order requests do not corrupt state.

## Phase 4: Client Domain Refactor

Tasks:
- Refactor Womb, Pregnancy, Lactation, PregnancyState, and Player base to stop persistent client writes.
- Convert mutating methods into intent publishers.
- Keep UI tab APIs as stable as possible by exposing snapshot-backed getters.
- Ensure animation and visual feedback still work from authoritative state.

Deliverables:
- Client components become presentation + intent layer.

Acceptance criteria:
- No direct client writes to authoritative persistence paths.
- UI remains functional and reflects server state.

## Phase 5: Test Hardening and Regression Coverage

Tasks:
- Unit tests for protocol validation, schema checks, revision handling.
- Unit tests for migration normalizers.
- Unit tests for server reconciliation methods.
- Integration-like tests for command flow and reconnects.
- Regression tests for pregnancy/lactation/womb expected behavior.

Deliverables:
- Multiplayer coverage aligned with critical pathways.

Acceptance criteria:
- Coverage remains healthy and includes MP-specific behavior.
- No single-player regressions in baseline test suite.

## 7. Proposed File-Level Work Map

## 7.1 Shared

Likely edits/additions:
- src/shared/constants.ts
- src/types.d.ts
- New: src/shared/network or src/shared/types modules (optional split)

## 7.2 Server

Likely additions:
- src/server/ZLBF.ts (server command router)
- src/server/components/ZLBFCommandHandler.ts
- src/server/components/ZLBFStateStore.ts (optional abstraction)

Likely tests:
- src/server/ZLBF.spec.ts
- src/server/components/ZLBFCommandHandler.spec.ts
- src/server/components/ZLBFStateStore.spec.ts

## 7.3 Client

Likely additions:
- src/client/ZLBF/components/ZLBFSyncPublisher.ts
- src/client/ZLBF/components/ZLBFSnapshotStore.ts

Likely refactors:
- src/client/ZLBF/components/Player.ts
- src/client/ZLBF/components/ModData.ts
- src/client/ZLBF/components/Womb.ts
- src/client/ZLBF/components/Pregnancy.ts
- src/client/ZLBF/components/PregnancyState.ts
- src/client/ZLBF/components/Lactation.ts

Likely tests:
- New specs for publisher and snapshot store.
- Updated domain component specs to assert intent publishing and snapshot consumption.

## 8. Incremental PR Strategy

PR 1: Protocol and transport skeleton
- constants, types, router, minimal handler, minimal client subscriber

PR 2: Server authoritative store + migration
- state model, ensure, migration, tests

PR 3: First domain migration (Pregnancy suggested)
- move pregnancy progression server-side, client reads snapshot

PR 4: Womb migration
- cycle and fertility migration to server

PR 5: Lactation migration
- production/expiration migration to server

PR 6: Cleanup and final hardening
- remove obsolete client persistence paths, docs, additional tests

## 9. Key Technical Constraints

- Keep Lua-transpile-safe patterns for TypeScript-to-Lua.
- Avoid JavaScript-only runtime assumptions.
- Keep Build 42 packaging intact.
- Keep backward compatibility for persisted save data unless migration explicitly transforms it.
- Always document public APIs and non-obvious logic with JSDoc comments.

## 10. Risks and Mitigations

Risk: Event ordering differences between client and server cause behavior drift.
Mitigation:
- Centralize server tick ordering in one coordinator.
- Add deterministic tests around minute/hour/day transitions.

Risk: Legacy save data shape mismatch.
Mitigation:
- Use ensure/normalizer and explicit migration tests for missing fields and old key layouts.

Risk: UI breaks due snapshot timing.
Mitigation:
- Add snapshot defaults and null-safe getters.
- Keep UI contract stable while backend changes.

Risk: Trait/stat effects duplicated or missed during migration.
Mitigation:
- Add idempotency guards in server reconciler.
- Add tests for repeated command delivery and stale command replay.

## 11. Ready-to-Start Checklist

- [ ] Confirm network command names and module name.
- [ ] Create protocol constants and payload types.
- [ ] Add server command router entrypoint.
- [ ] Add server snapshot response handler.
- [ ] Add client snapshot subscriber.
- [ ] Add schema/revision validation tests.
- [ ] Add or update JSDoc comments for all new or refactored public APIs and complex logic.

## 12. Definition of Done

- Multiplayer sessions use server-authoritative state for womb, pregnancy, and lactation.
- Client no longer persists authoritative gameplay state directly.
- Legacy saves migrate safely.
- Test suite covers protocol, migration, reconciliation, and regression-critical gameplay behavior.
- Single-player behavior remains functionally equivalent.

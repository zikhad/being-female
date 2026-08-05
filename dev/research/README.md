# Project Zomboid Research Notes

This directory preserves reviewed reverse-engineering findings that affect ZLBF design or implementation. These notes are durable project context, not a substitute for validating behavior against the targeted Project Zomboid build.

## Workflow

1. Check this index and existing topic notes before starting a new investigation.
2. Delegate uncertain runtime behavior to the read-only `zomboid_researcher` when useful.
3. Have the primary agent review the returned evidence.
4. Update the existing topic or create one from [`_template.md`](_template.md).
5. Keep this index aligned with the topic's status, build, scope, and update date.

## Evidence Rules

-   Prefer vanilla game resources and directly observed repository behavior.
-   Treat declarations and typings as contracts to verify when Build 42 behavior may differ.
-   Treat third-party mods as examples, never authoritative evidence.
-   Separate direct observation from inference.
-   Record unresolved questions and the smallest practical in-game validation procedure.
-   Mark obsolete findings as `superseded` and link to their replacement.

## Status Values

-   `investigating`: evidence gathering is incomplete.
-   `partially verified`: some material claims are established, but important uncertainty remains.
-   `verified`: the documented conclusion is supported for the stated build and scope.
-   `superseded`: newer research replaces the conclusion; the note must link to its replacement.

## Index

| Topic                                                                                       | Status             | Build        | Scope                       | Last updated |
| ------------------------------------------------------------------------------------------- | ------------------ | ------------ | --------------------------- | ------------ |
| [Reference Mod multiplayer case study](reference-mod-multiplayer-case-study.md)             | Partially verified | 42.x         | Client, server, shared      | 2026-08-04   |
| [Build 42 multiplayer command contract](build42-multiplayer-command-contract.md)            | Partially verified | 42.x         | Shared, multiplayer         | 2026-08-04   |
| [Player ModData persistence and synchronization](player-moddata-persistence-and-sync.md)    | Partially verified | 42.12 / 42.x | Server, multiplayer         | 2026-08-05   |
| [Timed actions, recipes, and fluid authority](timed-actions-recipes-and-fluid-authority.md) | Investigating      | 42.x         | Client, server, multiplayer | 2026-08-04   |

## Multiplayer Implementation Order

The current research supports this order when implementation resumes:

1. Establish shared protocol types, separate client/server entrypoints, runtime payload validation, and targeted request/response tests.
2. Prove command delivery and loader behavior in single-player, hosted multiplayer, and dedicated-server environments.
3. Establish normalized server-owned persistence and verify save/reload behavior.
4. Migrate Pregnancy first, with persisted lifecycle/idempotency markers for irreversible transitions.
5. Migrate Womb using server-validated intents and deterministic reconciliation.
6. Migrate Lactation only after recipe, inventory, and fluid authority are verified.
7. Remove legacy client-authoritative write paths after parity and reconnect tests pass.

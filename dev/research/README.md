# Project Zomboid Research Notes

This directory preserves reviewed reverse-engineering findings that affect BF design or implementation. These notes are durable project context, not a substitute for validating behavior against the targeted Project Zomboid build.

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
| [Build 42 multiplayer command contract](build42-multiplayer-command-contract.md)            | Partially verified | 42.x         | Shared, multiplayer         | 2026-08-22   |
| [Player ModData persistence and synchronization](player-moddata-persistence-and-sync.md)    | Partially verified | 42.12 / 42.x | Server, multiplayer         | 2026-08-22   |
| [Timed actions, recipes, and fluid authority](timed-actions-recipes-and-fluid-authority.md) | Partially verified | 42.x         | Client, server, multiplayer | 2026-08-22   |
| [EveryOneMinute progression authority](every-one-minute-server-progression.md)              | Partially verified | 42.x         | Client, server, SP, MP      | 2026-08-22   |
| [Sandbox-option multiplayer authority](sandbox-options-multiplayer-authority.md)            | Partially verified | 42.x         | Client, server, SP, MP      | 2026-08-22   |
| [Lactation production and metabolic costs](lactation-production-and-metabolic-costs.md)     | Partially verified | 42.x         | Client, server, SP, MP      | 2026-08-24   |
| [Build 42 dynamic Lua removal](build42-dynamic-lua-removal.md)                              | Partially verified | 42.20.4      | Shared, client, server      | 2026-08-26   |

## Remaining Multiplayer Validation And Hardening

The shared protocol, hosted/co-op command and snapshot path, authoritative persistence, reversible domain publication, authoritative recipes, and resumable birth lifecycle are implemented and have been exercised in single-player and hosted/co-op multiplayer. Remaining work is:

1. Validate the complete flow on a dedicated server with two clients, including actor isolation, reconnect, and graceful restart.
2. Verify observer-side fluid convergence after authoritative recipe mutations.
3. Exercise delayed or lost responses and confirm bounded retry and ordering behavior across every publisher.
4. Measure immediate-disconnect and abnormal-shutdown durability, including the crash window between baby insertion and completed-birth persistence.
5. Probe administrative time jumps and live sandbox-option changes without treating either as verified behavior.

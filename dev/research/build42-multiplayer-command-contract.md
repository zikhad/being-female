# Build 42 Multiplayer Command Contract

Status: partially verified  
Last updated: 2026-08-22
Project Zomboid build: 42.x  
Scope: shared, multiplayer

## Question

Which Build 42 command signatures and ordering assumptions can the ZLBF multiplayer foundation safely use?

## Conclusion

The `OnClientCommand`, `OnServerCommand`, `sendClientCommand`, and targeted `sendServerCommand` shapes agree across installed PipeWrench declarations, inspected vanilla Build 42 code, and the deployed Reference Mod. The player supplied by `OnClientCommand` must be treated as the authenticated command subject.

The Reference Mod reconnect rule that resets persisted ordering whenever `revision === 1` is replay-unsafe. ZLBF does not use that rule: it correlates replies to pending requests, resets connection-scoped client state on connection boundaries, and gives irreversible birth operations persisted idempotency identifiers.

The Reference Mod's project owner confirms that its unified server-authoritative path works as intended in actual single-player and multiplayer use. ZLBF now deliberately uses different runtime backends: single-player preserves direct local gameplay state, while hosted/co-op multiplayer uses validated client commands, targeted responses, and acknowledged snapshots. Both paths were user-validated on 2026-08-22. Dedicated-server delivery remains unverified.

## Evidence

### Vanilla and declaration observations

-   Vanilla `media/lua/server/Foraging/forageServer.lua` uses the first four command parameters with an optional fifth client identifier.
-   Vanilla networking commonly separates client and server paths with `isClient()` and `isServer()`, so single-player traversal requires validation.

### Types or declarations

-   `node_modules/@asledgehammer/pipewrench-events/PipeWrench-Events.d.ts` declares the event signatures used by this branch.
-   `node_modules/@asledgehammer/pipewrench/PipeWrench.d.ts` declares targeted `sendServerCommand` and supported `sendClientCommand` overloads.

### Reference Mod case study

-   Reference Mod uses separate generated client/server entrypoints and the four-argument client/targeted-server command signatures.
-   Its server entrypoint routes the event-supplied player into a domain handler.
-   Its client publishes changed desired state from `EveryOneMinute`, after player creation, rather than treating `OnCreatePlayer` as a network-ready bootstrap boundary.
-   Its request/response envelope separates transport metadata from domain `data`.
-   Its `revision === 1` reconnect reset remains replay-unsafe and must not be copied.
-   Its client does not validate runtime response shape or correlate response revisions, and eagerly marks state sent before acknowledgment.
-   The project owner confirms successful real-world single-player and multiplayer operation of this architecture.

See [Reference Mod multiplayer case study](reference-mod-multiplayer-case-study.md) for exact source references and transfer guidance.

### Historical ZLBF runtime experiment

An earlier ZLBF multiplayer experiment logged this hosted-session order:

1. `OnConnected` fired before `getPlayer()` returned a player.
2. `OnCreatePlayer` later supplied the player and called `sendClientCommand`.
3. The server did not receive that immediate ZLBF command, although unrelated vanilla commands reached `OnClientCommand`.

This remains useful historical evidence that immediate creation-time bootstrap was unreliable. It is superseded in the current implementation by minute-deferred bootstrap and connection-state reset; hosted/co-op validation confirms that path delivers commands.

### PipeWrench client/server boundary warnings

The five `Cannot reference code from src/server from src/client` warnings produced by `@asledgehammer/tstl-pipewrench` 41.78.19 are false positives for the current server dependency graph. The plugin's `handleFile()` tests `fp.dir.indexOf("client")` as a boolean; JavaScript treats the absent result `-1` as truthy, so normal server output paths are classified as client scope. Its require-rewrite pass consequently warns on server-prefixed imports before stripping the prefix.

The warnings correspond exactly to these server-to-server value imports:

1. `src/server/ZLBF.ts` to `CommandHandler`.
2. `src/server/ZLBFRecipes.ts` to `StateRepository`.
3. `src/server/components/CommandHandler.ts` to `StateRepository`.
4. `src/server/components/CommandHandler.ts` to `BirthOperationAllocator`.
5. `src/server/components/state/StateRepository.ts` to `StateMigrator`.

Generated Lua places every caller and target beneath `media/lua/server` and emits side-relative paths such as `require('components/CommandHandler')`. No generated client file requires these server modules. Type-only server imports are erased and do not contribute warnings.

The present source placement is therefore correct. Server-only modules must remain in `src/server`; moving them into `src/shared` merely to silence a faulty diagnostic would weaken the runtime boundary. A project-local tooling update or patch may remove the noise later, but permanent edits inside `node_modules` are not appropriate.

## Runtime And Version Applicability

Signatures are supported by local Build 42 evidence. Hosted/co-op connection lifecycle and reconnect behavior have been exercised; dedicated-server lifecycle and packet-loss behavior remain environment-sensitive. Never accept a username or online ID from a payload to select the affected player.

## Confidence

Confidence: high for signatures, generated-context separation, hosted/co-op command delivery, the explicit SP-local runtime split, and the replay flaw; medium for reconnect resilience beyond normal tested flows; low for dedicated-server and packet-loss behavior.

## Implications For ZLBF

-   Validate incoming tables and finite integer schema/revision values before dereferencing them.
-   Do not reuse revision-one reset logic for side-effecting commands.
-   Keep connection-scoped revisions out of persisted state and retain persisted idempotency IDs for irreversible birth operations.
-   Make schema errors readable under the supported response envelope or treat them as log-only.
-   Retain the minute-deferred bootstrap after creation/reconnect rather than returning to immediate lifecycle sends.
-   Track last observed, last sent, and last acknowledged state separately so dropped packets remain retryable.
-   Correlate replies to an outstanding request and reject future, late, duplicate, or unsolicited revisions.
-   Validate raw tables and domain payloads before loading persisted state.

## Remaining Questions

-   Does the chosen publisher timing behave identically on a dedicated server with remote clients?
-   What bounded timeout policy should recover a response lost without a disconnect?
-   Can a response arrive before client domain initialization?
-   Hosted/co-op delivery from the deferred `EveryOneMinute` bootstrap and the separate SP-local path have been user-validated; dedicated delivery still requires instrumentation. See [EveryOneMinute server progression](every-one-minute-server-progression.md) for tick semantics.

## In-Game Validation

In single-player, hosted multiplayer, and a dedicated server with two clients:

1. Log creation, connection, client send, server receive, and targeted response.
2. Send revisions one and two, then a delayed duplicate revision one.
3. Disconnect, reconnect, and repeat.
4. Confirm identity and response routing for both players.
5. Confirm event handlers register only once.

## History

-   2026-08-04: Initial research from an earlier multiplayer branch and installed Build 42/PipeWrench resources.
-   2026-08-04: Added hosted runtime evidence and a private Reference Mod comparison; removed stale references to multiplayer files absent from the current branch.
-   2026-08-04: Recorded project-owner runtime confirmation of the Reference Mod's unified single-player and multiplayer behavior; retained ZLBF-specific lifecycle validation.
-   2026-08-11: Recorded hosted bootstrap delivery and linked the server progression event research.
-   2026-08-18: Confirmed that five PipeWrench client-to-server build warnings are tooling false positives caused by faulty output-scope detection in version 41.78.19. Generated Lua retains correct server placement and side-relative requires.
-   2026-08-22: Recorded successful SP-local and hosted/co-op command/snapshot validation. Marked the earlier immediate-bootstrap failure historical and retained dedicated-server and packet-loss validation as open.

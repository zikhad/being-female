# Build 42 Multiplayer Command Contract

Status: partially verified  
Last updated: 2026-08-11
Project Zomboid build: 42.x  
Scope: shared, multiplayer

## Question

Which Build 42 command signatures and ordering assumptions can the ZLBF multiplayer foundation safely use?

## Conclusion

The `OnClientCommand`, `OnServerCommand`, `sendClientCommand`, and targeted `sendServerCommand` shapes agree across installed PipeWrench declarations, inspected vanilla Build 42 code, and the deployed Reference Mod. The player supplied by `OnClientCommand` must be treated as the authenticated command subject.

The current reconnect rule that resets persisted ordering whenever `revision === 1` is replay-unsafe. A delayed or replayed packet can reset ordering. Side-effecting commands require a connection/session epoch or domain idempotency boundary. A read-only snapshot request does not require persisted replay ordering.

The Reference Mod's project owner confirms that its unified server-authoritative path works as intended in actual single-player and multiplayer use. This establishes that Build 42 can support the four-argument command flow in both modes. ZLBF's own path remains unverified because an earlier immediate-bootstrap experiment used different lifecycle timing and dropped a command.

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

An earlier ZLBF multiplayer experiment, not present on this branch, logged this hosted-session order:

1. `OnConnected` fired before `getPlayer()` returned a player.
2. `OnCreatePlayer` later supplied the player and called `sendClientCommand`.
3. The server did not receive that immediate ZLBF command, although unrelated vanilla commands reached `OnClientCommand`.

This is direct runtime evidence that ZLBF needs post-creation change detection or bounded retry and must not assume either lifecycle event alone is network-ready.

## Runtime And Version Applicability

Signatures are supported by local Build 42 evidence. Connection lifecycle, reconnect ordering, and single-player dispatch remain environment-sensitive. Never accept a username or online ID from a payload to select the affected player.

## Confidence

Confidence: high for signatures, generated-context separation, the Reference Mod's unified SP/MP path, and the replay flaw; medium that the Reference Mod's post-creation periodic publishing pattern transfers to ZLBF; low for ZLBF-specific lifecycle timing and reconnect behavior pending in-game validation.

## Implications For ZLBF

-   Validate incoming tables and finite integer schema/revision values before dereferencing them.
-   Do not reuse revision-one reset logic for side-effecting commands.
-   Define a session epoch or idempotency scheme before Pregnancy mutation commands.
-   Make schema errors readable under the supported response envelope or treat them as log-only.
-   Bootstrap on verified creation/reconnect events rather than polling forever.
-   Track last observed, last sent, and last acknowledged state separately so dropped packets remain retryable.
-   Correlate replies to an outstanding request and reject future, late, duplicate, or unsolicited revisions.
-   Validate raw tables and domain payloads before loading persisted state.

## Remaining Questions

-   Does ZLBF's chosen publisher timing deliver `sendClientCommand` reliably in single-player, as the Reference Mod's later periodic publisher does?
-   Which event or bounded retry schedule is reliably late enough for bootstrap and reconnect?
-   What server-observable lifecycle can establish a session epoch?
-   Can a response arrive before client domain initialization?
-   Hosted multiplayer delivery from the deferred `EveryOneMinute` bootstrap has been user-validated; single-player and dedicated delivery still require instrumentation. See [EveryOneMinute server progression](every-one-minute-server-progression.md) for tick semantics.

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

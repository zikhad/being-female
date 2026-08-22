# EveryOneMinute Progression Authority

Status: partially verified  
Last updated: 2026-08-22
Project Zomboid build: 42.x (local installed build)  
Scope: client, server, single-player, multiplayer

## Question

Can Build 42 `EveryOneMinute` drive periodic domain progression, and should ZLBF run that simulation on the client or server?

## Conclusion

Build 42 triggers `EveryOneMinute` from `GameTime.update(boolean)` whenever the calculated world minute stamp differs from the previously processed stamp. The trigger has no client/server guard, and vanilla registers listeners in both server and multiplayer-client contexts.

The callback is a wake-up signal, not elapsed-time truth. It has no player or delta argument and fires at most once per game update, so a multi-minute jump can collapse into one callback. Any progression implementation must calculate elapsed time from minute-stamp deltas instead of incrementing once per callback.

ZLBF registers `EveryOneMinute` only from client code. In hosted/co-op multiplayer, the first eligible tick bootstraps a snapshot and Pregnancy, Womb, and Lactation publish their latest desired state for validated server persistence. In single-player, the same gameplay components use direct local state and do not wait for a command response. No server domain-progression listener exists.

ZLBF uses client-simulated, server-persisted progression for reversible multiplayer domain values where anti-cheat is not required. Pregnancy, cycle/Womb, and Lactation simulate on the owning client and publish validated desired state after ticks; the server is the multiplayer persistence and convergence boundary. The separate SP path applies changes locally. User testing confirmed both paths on 2026-08-22. A server listener and online-player enumeration remain an unselected alternative.

## Evidence

### Direct observations

-   `src/client/ZLBF/components/Pregnancy.ts` registers a client minute listener that calculates elapsed online minutes, updates presentation, publishes Pregnancy progress, and begins labor/birth presentation locally.
-   `src/client/ZLBF/components/network/PregnancyPublisher.ts` keeps one request in flight, coalesces intervening ticks to the latest desired state, and applies correlated server snapshots without rolling presentation behind queued progress.
-   `src/server/components/CommandHandler.ts` accepts the normal progression route without debug mode, validates and reconciles desired Pregnancy state, persists changes, and returns the canonical snapshot.
-   `src/client/ZLBF/components/network/SyncCoordinator.ts` registers a separate client listener for the one-time snapshot request.
-   `src/server/ZLBF.ts` registers only `OnClientCommand`; it has no minute listener.
-   Installed Build 42 `zombie.GameTime.update(boolean)` updates the minute stamp, compares it with the previous stamp, emits one `EveryOneMinute` event when different, and then stores the new stamp. There is no client/server guard around the trigger.
-   Paused game time does not change the minute stamp. Hour and ten-minute processing precede the minute event when boundaries coincide.
-   Vanilla server `media/lua/server/Camping/SCampfireSystem.lua` registers an `EveryOneMinute` listener.
-   Vanilla server `media/lua/server/Foraging/forageServer.lua` obtains `getOnlinePlayers()`, nil-checks it, and iterates its Java list from index `0` through `size() - 1`.
-   Vanilla `media/lua/server/XpSystem/XpUpdate.lua` uses `getOnlinePlayers()` in server context and skips unavailable or dead players.

### Types or declarations

-   `node_modules/@asledgehammer/pipewrench-events/PipeWrench-Events.d.ts` declares `EveryOneMinuteListener` as `() => void`; no player or elapsed delta is supplied.
-   `node_modules/@asledgehammer/pipewrench/PipeWrench.d.ts` exposes `getOnlinePlayers()` as a Java `ArrayList<IsoPlayer>` and exposes `GameTime.getMinutesStamp()`.
-   Declarations confirm callable shapes but do not establish lifecycle or exactly-once guarantees.

### Inference

-   The unguarded Java trigger and vanilla client/server registrations strongly support availability in single-player, hosted-server, multiplayer-client, and dedicated-server contexts.
-   Connected-player lists are transient. A server tick must tolerate an empty list, join/disconnect races, and newly connected players whose ZLBF state has not yet been initialized.
-   Client publication naturally provides the chosen online-only behavior because disconnected clients produce no progression ticks.
-   Reconnect must seed client simulation from the acknowledged server snapshot before a new tick is published; it must not apply offline catch-up.

## Runtime And Version Applicability

The Java and vanilla Lua observations apply to the locally installed Build 42 game inspected on 2026-08-11. ZLBF's SP and hosted/co-op behavior has since been exercised successfully. Dedicated behavior is strongly supported by loader location and vanilla usage but has not been instrumented by ZLBF. No Build 41 behavior is claimed.

## Confidence

Confidence: high for current listener locations, Java minute-stamp behavior, callback collapse, online-only client simulation, and tested SP/hosted-co-op progression; medium for dedicated-server behavior and retry under lost responses; undetermined for administrative time changes.

## Implications For ZLBF

-   Keep reversible progression in client components, but derive elapsed minutes from client/world minute-stamp deltas so collapsed callbacks do not lose time.
-   Bootstrap the client from the server snapshot before publishing progression; reconnect starts from that persisted value with no offline delta.
-   Publish bounded desired state through domain-specific commands. The server validates schema and invariants, reconciles and persists changed state, increments `stateVersion`, and acknowledges with the canonical snapshot.
-   Publishers must retain the latest unsent desired state while a request is pending instead of dropping intervening ticks.
-   Apply this pattern to Pregnancy, cycle/Womb, and Lactation values that are reversible and do not mutate external game-owned resources.
-   Do not require a server minute listener, `getOnlinePlayers()` enumeration, session baselines, or unsolicited server snapshot pushes for reversible progression.
-   Keep irreversible birth on its implemented persisted pending/completed operation boundary; presentation cancellation and lost acknowledgement must never turn minute progression into a second allocation.
-   Keep item creation, destructive inventory/fluid transfers, and other irreversible effects as explicit server-validated operations even though progression itself is client-simulated.

## Remaining Questions

-   What stamp/delta is observed during sleep, fast-forward, admin time jumps, and clock corrections?
-   What retry/coalescing policy best preserves the latest desired state after a dropped or delayed request?

## In-Game Validation

In a temporary research build, log client execution context, current/previous minute stamps, calculated delta, observed desired state, sent revision, acknowledged revision, and server state version. Test ordinary time, pause/resume, sleep/fast-forward, a multi-minute admin jump, dropped/delayed responses, disconnect/reconnect, and graceful restart in single-player, hosted multiplayer, and dedicated server. Confirm that collapsed callbacks preserve elapsed online time, offline time is not applied, and server/client state converges.

## History

-   2026-08-11: Initial investigation from ZLBF source/generated Lua, installed Build 42 Java bytecode, vanilla client/server Lua, and PipeWrench declarations.
-   2026-08-11: Chose online-only Pregnancy progression; reconnect establishes a new session baseline without catch-up.
-   2026-08-11: Chose client-simulated, server-persisted progression for reversible Pregnancy, Womb/cycle, and Lactation values; retained server simulation as an unselected alternative.
-   2026-08-11: Implemented the first Pregnancy progression publisher with minute-stamp deltas, latest-state coalescing, validated persistence, and correlated acknowledgement.
-   2026-08-22: Recorded successful SP-local and hosted/co-op progression validation across Pregnancy, Womb, and Lactation. Dedicated-server, packet-loss, and administrative-time-jump behavior remains open.

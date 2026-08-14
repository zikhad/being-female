# Sandbox-Option Multiplayer Authority

Status: partially verified  
Last updated: 2026-08-14  
Project Zomboid build: 42.x  
Scope: client, server, single-player, multiplayer

## Question

How does Build 42 load and expose mod-defined sandbox options across execution contexts, and which value should authoritative server transitions use?

## Conclusion

Build 42 registers enabled mods' `sandbox-options.txt` declarations in `SandboxOptions.instance`. Hosted and dedicated servers load the selected server configuration and publish it into their own Lua environment as `SandboxVars` before gameplay events and client commands. A server `OnClientCommand` handler can therefore read `SandboxVars.ZLBF.PregnancyRecovery` authoritatively.

Multiplayer clients receive a serialized copy of the server options and populate their own `SandboxVars`. The current client accessor normally observes the server-selected value, but its table is still local client state and is not an authority boundary. Irreversible server transitions must read configuration from the server and must not accept it in client payloads.

## Evidence

### Direct observations

-   Installed Build 42 `zombie.sandbox.CustomSandboxOptions.init()` scans enabled mods for `sandbox-options.txt`; `initInstance(SandboxOptions.instance)` registers parsed custom options.
-   Installed Build 42 `zombie.network.GameServer` startup registers custom options, loads `<servername>_SandboxVars.lua`, calls `SandboxOptions.instance.toLua()`, and only then fires `OnGameBoot`.
-   `SandboxOptions.toLua()` writes registered values into the global `SandboxVars` table, including nested tables represented by dotted custom option names.
-   `GameClient.receiveSandboxOptions` loads the server packet, applies settings, and calls `toLua()` to create the client's synchronized local copy.
-   `GameServer.receiveSandboxOptions` applies accepted administrative updates, calls `toLua()`, saves the server configuration, and broadcasts it to clients.
-   Vanilla server Lua reads `SandboxVars` directly in `media/lua/server/Vehicles/Vehicles.lua`, `media/lua/server/Seasons/season.lua`, and `media/lua/server/Farming/SFarmingSystem.lua`.
-   Vanilla server Lua also uses `getSandboxOptions():getOptionByName(...):getValue()` in farming and camping code.

### Types or declarations

-   `src/media/sandbox-options.txt` registers `ZLBF.PregnancyRecovery` as an integer from zero through 56 with default seven.
-   `src/externals/zomboid.d.ts` describes the nested `SandboxVars.ZLBF` values used by the current client accessor.
-   PipeWrench exposes `getSandboxOptions()`, but direct nested `SandboxVars` access most closely matches the custom-option registration and generated table shape.

### Third-party patterns

-   Installed Build 42 mods use nested custom values from `SandboxVars` in server Lua. These corroborate the integration pattern but are not the engine contract.

## Runtime And Version Applicability

The evidence comes from the installed Build 42 game jar and media inspected on 2026-08-14. It applies to single-player, hosted/co-op servers, dedicated servers, and synchronized multiplayer clients. The server owns the authoritative value; clients hold a propagated local copy.

## Confidence

Confidence: high for server availability and authority; medium-high for live administrative-update timing.

Registration, startup ordering, Lua-table publication, client propagation, and vanilla server usage are directly supported. Live option changes were not dynamically tested relative to a simultaneous mod command.

## Implications For ZLBF

-   Do not import the client-only `src/client/ZLBF/SandboxOptions.ts` from server code.
-   Move reusable definitions/access logic into `src/shared`, or create a narrow server accessor.
-   Read `SandboxVars.ZLBF.PregnancyRecovery` when handling birth completion rather than caching it at module load, so later accepted administrative changes can affect subsequent births.
-   Validate the mutable global value as an integer within the declared zero-to-56 range and fall back to seven with a server log when it is missing or invalid.
-   Never accept recovery duration from a client command payload.
-   Persist Womb recovery in the same authoritative transition that completes birth and resets Pregnancy.
-   Client simulation may continue using its synchronized copy, but authoritative snapshots must restore the persisted server result after reconnect.

## Remaining Questions

-   Does a live administrative change become visible to the very next ZLBF command in every hosted and dedicated-server lifecycle?
-   How should ZLBF surface a client/server mod-version mismatch that changes the custom option schema?

## In-Game Validation

Set Pregnancy recovery to 11. In single-player, hosted multiplayer, and dedicated multiplayer, log context flags, `SandboxVars.ZLBF.PregnancyRecovery`, and its Lua type from the client and server command handler. Complete a birth and verify the authoritative Womb `cycleDay` becomes `-11`, remains recovery after reconnect, and advances normally on subsequent in-game days. Optionally change the option through the live admin UI and confirm the next birth uses the updated server value.

## History

-   2026-08-14: Established the Build 42 server-owned custom sandbox-option loading and multiplayer propagation contract from installed bytecode and vanilla server usage; runtime mode and live-update probes remain pending.

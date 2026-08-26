# Build 42 Dynamic Lua Removal

Status: partially verified  
Last updated: 2026-08-26  
Project Zomboid build: 42.20.4 (`b0bbce05d5`)  
Scope: shared, client, server

## Question

Why does BF stop loading after Project Zomboid removed `loadstring` and `loadstream`, and which generated expressions can BF safely replace?

## Conclusion

Project Zomboid 42.20.4 no longer exposes `loadstring` in the inspected Lua environment. PipeWrench generates eager global exports such as `loadstring("return _G['IsoPlayer']")()`, so loading its shared module aborts at the first export.

BF's historical post-build patch handled only the older embedded-require expression. Generated global lookups can be replaced safely with direct `_G['Name']` access. Arbitrary dynamic compilation has no general replacement and must not be rewritten. BF does not use PipeWrench's generated `loadstring` or `execute` exports, so the packaged copies are removed.

## Evidence

### Direct observations

-   `/Users/diego/Zomboid/version.txt` — reports Project Zomboid `42.20.4 b0bbce05d5`.
-   `/Users/diego/Zomboid/console.txt` — BF loading fails at `PipeWrench.lua:517`, followed by `RecipeActorState.lua:5` and `BFRecipeTests.lua:13`, with `Object tried to call nil in PipeWrench.lua`.
-   Packaged `PipeWrench.lua:517` — the failing expression is `Exports.AStarPathFinderResult = loadstring("return _G['AStarPathFinderResult']")()`.
-   The pre-fix package contains 993 eager plain-global initializers plus two unused PipeWrench wrapper definitions containing `loadstring`.
-   Repository BF source does not call PipeWrench's `loadstring` or `execute` exports and contains no `loadstream` call.

### Types or declarations

-   PipeWrench exposes game globals through generated Lua wrappers. These declarations do not require dynamic compilation; direct `_G` lookup preserves the generated initializer's result.

### Documentation

-   Project Zomboid 42.20.4 changelog — reports removal of `loadstring` and `loadstream` as part of a security fix. The changelog text was supplied directly during investigation.

## Runtime And Version Applicability

The failure is observed on Build 42.20.4 during shared Lua loading. Because client and server BF modules import the same PipeWrench module, the incompatibility is not limited to recipes, single-player, or multiplayer.

## Confidence

Confidence: high

The game version, failing stack, generated expression, removed global, and post-build regex mismatch were observed directly. Post-fix single-player and multiplayer startup validation remain pending.

## Implications For BF

-   Patch only known generated global-lookup expressions; never transform arbitrary dynamic Lua.
-   Remove the unsupported PipeWrench dynamic-code exports because BF does not consume them.
-   Revalidate the patch whenever the PipeWrench dependency changes its generated Lua shape.

## Remaining Questions

-   Does the patched package complete startup in hosted multiplayer and on a dedicated server?
-   Will a future PipeWrench release remove these generated expressions upstream?

## In-Game Validation

1. Build and install BF into Project Zomboid 42.20.4.
2. Start a new or existing single-player game and confirm the world loads without the `PipeWrench.lua:517` nil-call failure.
3. Confirm BF UI, recipes, and character initialization run.
4. Repeat startup in hosted multiplayer and inspect both client and server logs.

## History

-   2026-08-26: Identified the Build 42.20.4 startup failure and added a narrow generated-Lua replacement for the observed PipeWrench forms.

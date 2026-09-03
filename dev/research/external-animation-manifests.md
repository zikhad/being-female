# External Animation Manifests

Status: partially verified  
Last updated: 2026-09-03  
Project Zomboid build: 42.20.4 / 42.x  
Scope: client, single-player, multiplayer clients

## Question

Can BF discover animation definitions supplied as data files by BF and other activated mods, without requiring those mods to register animations through Lua or TypeScript? Can those definitions add variants and intentionally replace BF's default animations?

## Conclusion

Build 42 provides the client-side file discovery and reading APIs needed for a no-code extension system. BF can enumerate a dedicated directory in every activated mod, read declarative manifests, validate them, and register the resulting image-sequence animations.

The manifests should not be placed in `media/scripts`. Project Zomboid's script loader accepts a closed set of engine-owned script object types; an ordinary mod cannot add a BF-specific object type to that grammar. BF should instead own a directory and format such as `media/BF/animations/*.txt`.

Manifest identity and replacement should follow Build 42's native same-relative-path overlay. A new relative manifest path adds an animation. A mod loaded after BF can replace a default animation by shipping a complete manifest at the exact same relative path. No `replaces` key or separate replacement registry is required.

The same rule applies to PNGs. A provider can ship frames at the exact paths used by the winning manifest and Project Zomboid will resolve the later files through its virtual filesystem. To change frame count, steps, loop count, category, state constraints, fullness layout, or other metadata, the provider replaces the complete manifest as well as supplying the required frames.

The remaining uncertainty is lifecycle and integration behavior in the running game: the proposed load event, provider-owned texture resolution, common/version-directory deduplication, and multiplayer client parity still require an in-game probe.

## Evidence

### Direct Observations

-   Installed Build 42.20.4 `projectzomboid.jar`, `zombie.scripting.objects.ScriptModule.CreateFromTokenPP` — parsed script tokens are checked against registered script buckets. Unknown object types produce an `unknown script object` warning and are ignored.
-   Installed Build 42.20.4 `projectzomboid.jar`, `zombie.scripting.ScriptType` — the accepted script types are a closed engine enum. Although it includes runtime animation types, those describe Project Zomboid model/runtime animations rather than BF's UI texture sequences.
-   Installed Build 42.20.4 `projectzomboid.jar`, `LuaManager.GlobalObject.listFilesInModDirectory` — exposed as a global Lua method. It lists direct files in a relative directory for a specified mod, covers common and version-specific mod directories, and rejects blank mod IDs, absolute paths, and traversal components.
-   Installed Build 42.20.4 `projectzomboid.jar`, `LuaManager.GlobalObject.getModFileReader` — exposed as a global Lua method. It reads UTF-8 text from a relative mod path, prefers the version-specific directory, falls back to the common directory, and rejects absolute paths and traversal components.
-   Installed Build 42.20.4 `projectzomboid.jar`, `LuaManager.GlobalObject.getGameFilesTextInput` — returns `null` unless the game is running in debug mode. It must not be used for release-client manifest loading even though it resolves through the virtual filesystem.
-   Installed Build 42.20.4 `projectzomboid.jar`, `zombie.ZomboidFileSystem.loadMod` — stores files in `activeFileMap` using a normalized, lowercased relative path. Later loaded files replace earlier mappings with the same key; a mod's version-specific directory similarly replaces its common directory.
-   Installed Build 42.20.4 `projectzomboid.jar`, `zombie.ZomboidFileSystem.loadMods` — resolves required dependencies before their dependants and then loads the final active-mod list sequentially. A provider that requires BF consequently loads after BF, although competing provider order remains user-configurable.
-   Installed Build 42.20.4 `projectzomboid.jar`, `zombie.core.textures.Texture.getSharedTextureInternal` — resolves requested texture paths through `ZomboidFileSystem.getString`, directly placing BF frame textures under the same-relative-path overlay.
-   Installed Build 42.20.4 `projectzomboid.jar`, `zombie.scripting.ScriptManager.Load` — identical relative script filenames participate in virtual-file replacement, but separate files defining the same named script object follow type-specific merge/reset behavior. Engine script overrides are therefore not a general contract for BF data.
-   In-game Build 42.20.4 `console.txt` — an omitted end argument in TypeScript `String.substring(start)` transpiled through `__TS__StringSubstring` to a `string.sub` call that Kahlua rejected with `missing argument #3 to 'sub'`. Manifest parsing must use `substring(start, line.length)` so generated Lua supplies both indices.
-   `src/client/BF/components/Animation.ts` — BF animation selection, texture loading, and display are client-side. Frame textures are loaded only for the selected animation, so registering many definitions does not by itself preload every provider image.

### Types Or Declarations

-   `node_modules/@asledgehammer/pipewrench/PipeWrench.d.ts:2758` — declares `getActivatedMods()`, which provides the mod IDs BF must inspect.
-   `node_modules/@asledgehammer/pipewrench/PipeWrench.d.ts:3552` — declares `getModFileReader(modId, path, createIfNull)`.
-   The current PipeWrench declarations do not declare `listFilesInModDirectory`. A precise Build 42 type augmentation is required; falling back to `any` would hide a version-sensitive boundary.

### Documentation

-   [Project Zomboid `LuaManager.GlobalObject` API](https://projectzomboid.com/modding/zombie/Lua/LuaManager.GlobalObject.html) — documents `getModFileReader`, `listFilesInModDirectory`, and the related mod/file globals. The documentation supports API availability, while the installed Build 42 jar establishes the behavior described above for the currently targeted build.
-   [Project Zomboid `ScriptManager` API](https://projectzomboid.com/modding/zombie/scripting/ScriptManager.html) — exposes collections for the supported script types and has no generic mod-defined data object registry.
-   [Project Zomboid `ScriptType` API](https://projectzomboid.com/modding/zombie/scripting/ScriptType.html) — documents the engine's enumerated script object categories.

### Third-Party Patterns

-   Steam Workshop mod `PZ_Map`, Build 42, `media/lua/client/PZ_Map_Bake.lua` — reads packaged files belonging to another mod with `getModFileReader`. This demonstrates the cross-mod file ownership boundary but is not evidence for BF's proposed manifest lifecycle.
-   Steam Workshop mod `PZ_Pulse`, Build 42, `media/lua/client/PZ_Pulse_Ext.lua` — uses a namespaced and validated extension registry with API versions, duplicate rejection, and deterministic ordering. Its extensions are Lua tables rather than data files, so it supports the registry design principles but does not verify no-code manifest loading.

## Runtime And Version Applicability

The file APIs and path handling were inspected in the installed game associated with Steam build ID `24909800`, identified by the repository's current environment as Project Zomboid 42.20.4. The APIs are newer than the Build 41-era PipeWrench declarations used by this project.

Native overlay precedence is deterministic for a fixed active-mod order, but users can reorder ordinary mods. `require=` ensures that BF loads before a provider; it does not establish precedence between multiple providers. Startup texture resolution is directly supported by the inspected code. The behavior of already-cached textures during a live Lua reload remains unverified.

The registry belongs on the client because BF's current animations are client UI state. In multiplayer, each client can independently build the registry from its activated mods; definitions and PNGs do not need BF network messages. This assumes the server's normal mod distribution gives participating clients the same provider mods. A missing or invalid provider manifest must degrade to a logged rejection on that client rather than affect gameplay authority.

## Confidence

Confidence: medium-high

Confidence is high that Build 42 permits enumerating and reading provider-owned files and that arbitrary BF objects cannot be added to the vanilla script grammar. Confidence is lower for the complete feature because the loading event, texture lookup, directory overlay behavior, and multiplayer parity have not yet been exercised in-game.

## Implications For BF

### Registry Boundary

-   Introduce an `AnimationRegistry` separate from animation rendering and state filtering.
-   Move BF's built-in definitions into manifests so they participate in the same discovery and replacement contract as third-party definitions.
-   Treat each normalized relative manifest path as the definition's stable identity.
-   Enumerate activated mods in their resolved order and retain the last owner for each normalized relative manifest path. Read that winning copy with `getModFileReader(ownerModId, path, false)`.
-   Sort the final winning relative paths before registration so animation ordering is stable for a fixed set of resolved files.
-   Reset and rebuild the complete registry from winning manifests when the relevant client lifecycle reloads Lua. Shipped BF manifests are the sole source of built-in definitions.
-   Continue loading textures lazily when an animation is selected.

### Addition And Replacement Semantics

BF could provide this default definition:

```text
media/BF/animations/intercourse/animation-1.txt
```

A provider adds a different animation by choosing a new relative manifest filename. It replaces `animation-1` by shipping the same path with a complete new definition:

```ini
version=1
name=animation-1
category=intercourse
frameCount=30
loop=20
pregnancy=false
condom=false
fullness=empty
```

Replacement should follow these rules:

1. The normalized relative manifest path is the replacement key; there is no `replaces` property.
2. The winning manifest is a complete definition. Fields are never merged with the shadowed file.
3. Project Zomboid's resolved mod load order decides the winner; the last loaded file at that relative path wins.
4. A provider should declare BF through `require=` so it loads after BF. When several providers replace the same path, their relative order decides the winner.
5. The winning manifest must pass the same validation as any added definition. An invalid winning override is rejected; BF must not silently combine it with the shadowed definition.
6. Replacement occupies the same manifest identity and therefore the same conceptual selection slot rather than appending another variant.
7. Where runtime APIs make the source available, BF diagnostics should report the relative manifest path and winning provider. At minimum, validation errors must report the relative path.

This deliberately adopts normal Project Zomboid precedence rather than inventing a BF-specific conflict mechanism. Results are deterministic for a fixed mod order, while changing user-configured mod order may change the winner.

### Native Asset Replacement

Provider mods may use Project Zomboid's built-in overlay when they only need to replace the artwork of an existing animation:

```text
<provider-mod>/42/media/ui/animation/<existing-bf-path>/0.png
<provider-mod>/42/media/ui/animation/<existing-bf-path>/1.png
...
```

The provider must load after BF, normally by declaring BF through `require=`. It must supply frames compatible with the existing definition. Missing replacement frames fall back to whichever earlier file owns that path, which could unintentionally mix artwork from different mods.

Native asset and manifest overlays work together:

| Need                                                                         | Mechanism                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Replace pixels while preserving the existing animation definition            | Same-relative-path PNG overlay                                                        |
| Change frame count, sequence, loop, category, fullness, or state constraints | Replace the complete manifest at the same relative path and provide its required PNGs |
| Add another selectable animation                                             | Use a new relative manifest path and matching asset directory                         |

Multiple overlays use the user's final mod order and the last loaded file wins. BF cannot reliably diagnose individual PNG conflicts because Project Zomboid resolves them before `getTexture` returns the file. Providers changing animation metadata should therefore replace the manifest and provide a complete, internally consistent frame set rather than depending on a mixture of shadowed assets.

### Manifest And Asset Contract

Recommended BF default layout:

```text
media/
├── BF/
│   └── animations/
│       └── intercourse/
│           └── animation-1.txt
└── ui/
    └── animation/
        └── intercourse/
            └── animation-1/
                ├── 0.png
                ├── 1.png
                └── ...
```

A provider replaces it by reproducing the relevant relative paths under its own `42/media` directory. Build 42's exposed directory-listing API is non-recursive, so a provider adding an animation should namespace the flat filename to avoid accidental collisions:

```text
<provider-mod>/
└── 42/
    └── media/
        ├── BF/
        │   └── animations/
        │       └── <provider-mod-id>--standing-intercourse.txt
        └── ui/
            └── animation/
                └── <provider-mod-id>/
                    └── standing-intercourse/
                        ├── 0.png
                        ├── 1.png
                        └── ...
```

-   The provider manifest is data only. BF must never call `require`, `dofile`, `loadstring`, or a callback named by the manifest.
-   Discover candidate relative paths per activated mod, retaining the last activated owner for each duplicate path. Read only that mod-scoped winning copy; parsing every copy would bypass the intended overlay contract.
-   Use the manifest's relative path as identity. A provider-supplied `id` must not control replacement.
-   New definitions should use provider-namespaced flat manifest filenames and image paths. Overrides intentionally reuse the target's paths.
-   If custom image paths are supported, require safe relative paths under `media/ui`.
-   Support `frameCount` for a zero-based sequential range and optional explicit `steps` for repeated, reversed, or non-linear sequences.
-   Validate versions, names, categories, layout/fullness compatibility, frame and loop bounds, booleans, state flags, and paths.
-   Full/empty layouts remain exclusive to intercourse animations.
-   Invalid files are logged and skipped independently so one provider cannot prevent BF or another provider from loading.

### Format Choice

A BF-owned, line-oriented key/value `.txt` format is the lowest-risk initial choice. It is readable, supports comments, and is straightforward to parse and validate in TypeScript-to-Lua. No supported Build 42 Lua JSON global or vanilla Lua JSON usage was found during this investigation. JSON would therefore require BF to bundle and maintain its own parser without providing a material advantage for the initial flat schema.

### Selection Behavior

Adding a new manifest to a category changes random-selection probabilities because the current implementation chooses among matching variants. Replacing an existing manifest path should not change the number of selection slots. Optional weights may be useful later, but they are outside the initial manifest contract.

## Remaining Questions

-   Is `Events.OnGameStart` early enough to complete registry loading before every possible BF animation trigger while also guaranteeing that activated mods are finalized?
-   Does `getActivatedMods()` expose the exact final order used by `ZomboidFileSystem.loadMods` in every single-player and multiplayer client lifecycle?
-   Does `listFilesInModDirectory` return duplicate filenames when both common and `42/` directories contain the same relative file, and how should candidate paths be normalized before virtual resolution?
-   Does `getTexture` resolve namespaced provider PNGs identically in single-player, hosted multiplayer, and dedicated-server clients?
-   Do already cached animation textures update reliably after a live Lua reload, or must native PNG overrides be treated as startup-only?
-   How should manifest schema upgrades preserve compatibility once version 2 is introduced?

## In-Game Validation

Create a minimal provider mod containing:

```text
media/BF/animations/probe.txt
media/ui/animation/probe-provider/probe/0.png
```

Then run a temporary client-side probe on the proposed loading event:

1. Confirm that `probe-provider` appears in `getActivatedMods()`.
2. Enumerate `media/BF/animations` with `listFilesInModDirectory` and build the normalized union of relative manifest paths.
3. Retain the last activated owner for duplicate paths and read that copy with `getModFileReader`; do not use the debug-gated `getGameFilesTextInput`.
4. Resolve and display the provider-owned PNG with `getTexture`.
5. Load a manifest at a new path and confirm it adds one selectable variant.
6. Place a complete provider manifest over a BF default path, change its frame count, provide the complete replacement frame set, and confirm it occupies the original selection slot.
7. Add two providers that replace the same manifest and PNG paths. Reverse their mod order and confirm the last loaded provider wins both times.
8. Repeat in single-player, hosted multiplayer as host and client, and a dedicated-server client.
9. Place the same manifest filename in common and `42/` directories and confirm deterministic deduplication and version-preferred resolution.

Expected result: winning virtual manifests are discovered and parsed once on each client, new paths add variants, reused paths replace complete definitions, frames resolve from the same winning overlay, and invalid input is reported without preventing other animations from loading.

## History

-   2026-09-03: Initial investigation. Established Build 42 discovery feasibility and rejected `media/scripts` as the extension boundary.
-   2026-09-03: Replaced the proposed `replaces` field with native same-relative-path manifest replacement, matching Project Zomboid's virtual filesystem behavior.
-   2026-09-03: Confirmed `getGameFilesTextInput` is debug-only; specified last-owner discovery plus `getModFileReader` for release clients and flattened provider manifest names because directory listing is non-recursive.
-   2026-09-03: Made shipped manifests the sole source of built-in definitions; no compiled animation-definition fallback is retained.
-   2026-09-03: In-game validation exposed Kahlua's required `string.sub` end argument; the manifest parser now emits an explicit line-length endpoint.

# Being Female Rename Plan

-   Status: implemented; core SP and hosted/co-op validation completed, extended in-game validation pending
-   Date: 2026-08-22
-   Branch: `refactor/rename-being-female`
-   Commits:
    -   `73efa44 refactor!: rename ZomboLust Being Female to Being Female`
    -   `8ddd325 fix(client): repair BF runtime event and pregnancy lookups`
    -   `1a54b60 fix(client): register notifications and isolate lactation state`
    -   `a494277 fix(multiplayer): emit queued pregnancy presentation`

## Summary

Perform the breaking rename from ZomboLust Being Female (ZLBF) to Being Female (BF). `BF` becomes the only active code, persistence, content, network, and Project Zomboid namespace.

One compatibility exception remains: legacy `ZLBF*` custom event names continue working for external integrations. No other ZLBF compatibility or migration is retained.

Identity baseline:

-   Display name/build folder: `Being Female`
-   Project Zomboid mod ID: `BF`
-   Runtime/module prefix: `BF` / `bf`
-   npm package and future repository slug: `being-female`
-   Repository URL: `https://github.com/zikhad/being-female`
-   Protocol, authoritative state, and BabyData schemas: version `1`

## Runtime and Project Rename

-   Rename paths with `git mv`, including `src/client/ZLBF` to `src/client/BF`, entrypoints, actions, UI classes, protocol/state files, Lua folders, media scripts, declarations, tests, workspace file, and sidebar textures.
-   Rename current TypeScript/Lua symbols from `ZLBF*` to `BF*`.
-   Replace all non-event Project Zomboid identifiers:
    -   Traits: `zlbf:*` to `bf:*`.
    -   Items, recipes, fluids, actions, animations, and modules: `ZLBF.*` to `BF.*`.
    -   Sandbox namespace and translation keys to BF equivalents.
    -   Network module: `ZLBF` to `BF`; command strings remain unchanged.
    -   Persistence and baby metadata keys to BF equivalents.
-   Reset the protocol version from 3 to 1. State and BabyData remain schema 1.
-   Never read, migrate, delete, or salvage old ZLBF persistence or content.
-   Preserve the ZomboLust integration, retaining the external `ZomboLust` mod ID while renaming BF-owned hooks.

## Legacy Event Compatibility

-   Add a focused client compatibility boundary containing the only active legacy `ZLBF*` runtime strings.
-   Internal components use only `BFEventsEnum` and BF event names.
-   Bridge legacy command events to BF exactly once:
    -   Intercourse
    -   Menstrual effects
    -   Pregnancy start/stop
    -   Womb animation start/update/stop/image
-   Dual-emit BF and legacy notification events with identical payloads:
    -   Pregnancy update
    -   Lactation update
    -   Womb update
    -   Pregnancy labor
-   Emit BF notifications first and legacy notifications second.
-   Make compatibility installation idempotent.
-   Do not retain old TypeScript enums, modules, globals, traits, content IDs, or persistence APIs.
-   Support these event aliases indefinitely until explicitly removed.

## Tooling, Documentation, and Release

-   Update PipeWrench metadata, TypeScript aliases, scripts, package/lockfile name, workspace paths, README, AGENTS instructions, integration guidance, translations, and current research conclusions.
-   Preserve exact ZLBF references only in:
    -   Historical changelog entries and URLs.
    -   Historical/superseded research evidence.
    -   The event compatibility implementation, tests, and documentation.
-   Keep the existing poster and logo.
-   Commit with a Conventional Commit breaking marker and `BREAKING CHANGE` footer.
-   Do not run `standard-version` on the feature branch.
-   Rename the GitHub repository externally to `being-female` before merging.
-   Let the existing `main` workflow generate and publish version 2.0.0.

## Public Interfaces

-   Rename all exported `ZLBF*` declarations to `BF*`.
-   Rename Lua globals to `BF`, `BFRecipes`, `BFSimpleUI`, `BFTabbedUI`, `NewBFUI`, and `NewBFTabbedUI`.
-   New integrations use BF identifiers.
-   Existing integrations retain compatibility only through documented legacy custom event strings.

## Test and Review Plan

-   Update the complete Jest suite and add identity-boundary tests for metadata, constants, schemas, persistence, BabyData, sandbox access, recipes, globals, and paths.
-   Test legacy events for exact-once forwarding, unchanged payloads, dual notifications, idempotent installation, and absence of recursion.
-   Run:
    -   Narrow affected Jest suites.
    -   `npm test -- --runInBand`.
    -   `npm run build`.
    -   Targeted Prettier/ESLint.
    -   `git diff --check`.
-   Inspect generated output for `dist/Being Female`, `id=BF`, BF Lua paths, and BF media namespaces.
-   Assert no packageable ZLBF reference remains outside the explicit event-compatibility allowlist.
-   Delegate maintainability and runtime/TSTL reviews, apply accepted narrow fixes, and repeat validation.
-   In-game validation:
    -   Remove the old installed mod folder.
    -   Test fresh SP and hosted/co-op gameplay, UI, sandbox options, debug actions, conception, pregnancy, lactation, recipes, fluids, birth, reconnect, and ZomboLust integration.
    -   Test an external stub using `ZLBFIntercourse` and `ZLBFPregnancyUpdate`.
    -   Repeat using BF event names.
    -   Confirm old persistence is not imported.

## Assumptions

-   The generic BF namespace collision risk is accepted.
-   Only legacy custom events retain compatibility.
-   Firing both old and new command names intentionally performs two commands.
-   The checkout directory itself is not renamed.
-   The external GitHub repository rename occurs before merging to `main`.
-   Dedicated-server validation remains separate.

## Validation Results

-   `npm test -- --runInBand`: passed, 49 suites and 656 tests after the runtime fixes.
-   `npm run build`: passed; generated `dist/Being Female` with `id=BF`, BF Lua paths,
    BF media namespaces, and schema version 1. The existing client/server boundary warnings
    remain informational output from the PipeWrench build.
-   Targeted Prettier and ESLint for the compatibility boundary and modified event emitters:
    passed.
-   `git diff --check`: passed.
-   Package inspection: no retired prefix remains outside
    `LegacyEventCompatibility.lua`; no old display name, mod ID, repository slug, content
    namespace, or persistence namespace remains in the package.
-   Maintainability review: completed; accepted fixes narrowed the notification event type
    and corrected the README event examples.
-   Runtime/TSTL review: completed with no confirmed defect; generated loader paths,
    varargs, forwarding direction, notification order, globals, persistence, content, and
    network namespaces were inspected.
-   `npm run check`: the repository-wide Prettier phase still reports pre-existing format
    drift in 32 files outside this rename's formatting scope. Targeted formatting and lint
    checks for modified implementation files passed.
-   In-game single-player startup and gameplay initialization: passed after repairing BF
    runtime event registration and pregnancy/lactation descriptor lookups.
-   In-game hosted/co-op pregnancy synchronization and persistence: passed on a fresh server;
    pregnancy publications were acknowledged by the authoritative server and persisted across
    reconnect. An earlier failed persistence attempt was traced to two Project Zomboid server
    processes concurrently locking the same `players.db`, not to BF serialization.
-   External legacy-event stub, full conception-to-birth gameplay, recipes/fluids, ZomboLust,
    old-save isolation, and dedicated-server validation remain pending.

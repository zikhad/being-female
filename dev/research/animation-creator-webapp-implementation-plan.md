# Animation Creator Web App Implementation Plan

Status: implemented  
Last updated: 2026-09-02  
Scope: local development tooling

## Goal

Provide a localhost-only browser tool that turns GIF or video sources into numbered Project Zomboid animation PNGs. The command-line extractor and browser tool share one extraction engine. The browser previews the exact exported frames, generates internal TypeScript and external-mod Lua examples, and downloads an isolated ZIP without changing repository source files.

## Releases

1. **Shared extraction engine:** normalize and validate options, probe media, extract zero-based PNG frames, support consistent trimming, and preserve `npm run extract-images`.
2. **Local web server:** manage temporary jobs, uploads, preview frames, ZIP downloads, expiry, size limits, and localhost-only routing.
3. **Creator interface:** support drag-and-drop, transforms, trims, categories, intercourse fullness layouts, actual-frame playback, code previews, and ZIP export.
4. **Documentation and validation:** document prerequisites and workflows, run repository checks, and manually exercise the local browser workflow. Automated web-app tests are deferred.

## Contracts

-   Built-in categories are `intercourse`, `birth`, and `fertilization`.
-   Only intercourse animations may use `plain`, `full`, `empty`, or paired `full + empty` layouts. Birth and fertilization always use one plain source.
-   Paired sources share output transforms but have independent trim ranges and must produce equal frame counts.
-   Generated names are lowercase filesystem-safe slugs.
-   Preview output is immutable for a configuration hash and is reused by ZIP export only while current.
-   The browser defaults output dimensions to 276×276; the standalone CLI preserves source dimensions when no size is supplied.
-   The server binds to `127.0.0.1`, accepts no output filesystem path, and removes expired temporary jobs.

## ZIP Layout

```text
<animation-name>.zip
├── <animation-name>/
│   ├── 0.png
│   ├── 1.png
│   ├── full/       # when selected
│   └── empty/      # when selected
├── examples/
│   ├── animation.ts
│   └── animation.lua
├── animation-creator.json
└── README.md
```

Only PNG assets appear in the copy-ready animation directory. The manifest records normalized settings, source filenames, generator version, and frame counts, but not source media.

## Acceptance Criteria

-   CLI and web extraction produce the same sequential frames for equivalent input.
-   The browser can upload, configure, preview, inspect, and download every supported layout.
-   Fullness controls and `fullnessSupport` output never appear for birth or fertilization.
-   Paired count mismatches prevent export with a useful error.
-   TypeScript and Lua examples match the exported name, paths, frame count, and flags.
-   No creator workflow edits `Animation.ts` or writes to `src/`.
-   Formatting checks, the existing Jest suite, and the mod build pass; the creator's upload, preview, and ZIP flow is manually exercised.

## History

-   2026-09-02: Plan accepted; implementation started.
-   2026-09-02: Implemented the shared extractor, localhost server, browser creator, exact-frame preview, TypeScript/Lua examples, ZIP export, safety limits, and contributor documentation. Automated web-app tests were deferred by request; CLI, localhost API, browser UI, existing Jest suite, and mod build were manually validated.

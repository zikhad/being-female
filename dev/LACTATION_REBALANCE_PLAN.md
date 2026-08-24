# Lactation Rebalance Plan

-   **Status:** planned
-   **Date:** 2026-08-24
-   **Branch:** `feat/lactation-rebalance`
-   **Reference:** `dev/example.lua` (community-provided balance experiment; not a production source file)

## Goal

Replace the current very fast, consequence-free lactation loop with a slower demand-driven system. Milk production should respond to recent feeding or expression, hydration, hunger, and the existing Dairy Cow trait while applying metabolic costs proportional to the milk actually produced.

This is an implementation plan, not reverse-engineering evidence, and should not be indexed in `dev/research/README.md`.

## Balance Baseline

Use these initial tuning values. They are intended to be validated in game and may be adjusted before the feature is considered complete.

-   Base production rate: random `0.00035` to `0.00070` liters per game minute, averaging approximately `0.75 L/day` before modifiers.
-   Recent-demand stimulation: `+1.25` stimulation per liter actually removed.
-   Stimulation cap: `0.50`, representing at most `+50%` production.
-   Stimulation decay: `0.025` per elapsed game hour, so a full bonus fades in about 20 hours without milk removal.
-   Dairy Cow: a separate permanent `1.25` production factor and `1.25` lactation-duration factor.
-   Metabolic cost per liter actually produced:
    -   `640` calories
    -   `32` carbohydrates
    -   `32` lipids
    -   `16` proteins
    -   `0.20` thirst
-   Hydration factor: `max(0.25, 1 - 0.75 * thirst)`.
-   Hunger factor: `max(0.50, 1 - 0.50 * hunger)`.

At the baseline average, a character produces about `0.75 L/day`. Moderate stimulation (`0.25`) raises that to about `0.94 L/day`; maximum stimulation raises it to about `1.13 L/day`. Dairy Cow raises those stimulated examples to about `1.17 L/day` and `1.41 L/day`, respectively.

Do not add a passive fatigue or endurance penalty in the first iteration. Existing engorgement pain and wetness consequences remain.

## Production Calculation

For each simulation interval, calculate:

```text
requested production =
    base rate per minute
    * elapsed game minutes
    * (1 + stimulation)
    * Dairy Cow factor
    * hydration factor
    * hunger factor
```

Clamp the requested production to the available breast capacity. Derive `actualProduced` from the milk level before and after the clamped update. Apply calories, nutrients, and thirst costs only from `actualProduced`.

This means:

-   A full breast produces no milk and incurs no metabolic cost.
-   A partially available capacity incurs only the cost of the amount that fits.
-   Dairy Cow increases both the actual yield and its proportional metabolic cost.
-   Sleep, fast-forward, and collapsed minute callbacks use elapsed game minutes rather than assuming exactly one minute passed.

The owning client continues to simulate lactation and publish BF state. The server remains authoritative for recipe-driven state transitions and persistence. Vanilla nutrition and character stats remain outside BF persistence.

## Demand And Stimulation

Give the existing `LactationState.multiplier` one meaning: temporary recent-demand stimulation in the range `0` to `0.50`. Keep schema version `1` and the existing field for save compatibility, but clamp loaded and mutated values at the behavior boundaries rather than tightening validation in a way that rejects an existing BF save.

Replace random, replacement-style multiplier updates with deterministic additive stimulation:

```text
actualRemoved = milk before - milk after
next stimulation = min(0.50, current stimulation + actualRemoved * 1.25)
```

Apply this rule to breastfeeding, pumping, and hand expression. Hand expression continues to use its existing extraction efficiency; stimulation is based on the milk actually removed from the character, not the amount placed into the receiving item.

Taking Lactaid activates lactation and adds a deterministic `0.25` stimulation dose, capped at `0.50`, because it creates stimulation without removing milk. Effective feeding, expression, pumping, or Lactaid use refreshes lactation duration.

Pregnancy-driven lactation activation must no longer write pregnancy progress into `multiplier`. It activates lactation and establishes or refreshes the duration without manufacturing demand stimulation.

## Trait And Duration Rules

Keep Dairy Cow independent from temporary stimulation:

-   Apply its `1.25` production factor exactly once in the production calculation.
-   Apply its `1.25` duration factor exactly once when establishing or refreshing expiration.
-   Do not multiply, replace, or encode Dairy Cow inside `LactationState.multiplier`.
-   Fix the current expiration assignment so the trait-adjusted value is not immediately overwritten.

Centralize duration calculation so client activation and server recipe transitions cannot apply the trait twice or disagree.

## Code Structure

-   Introduce pure lactation balance functions for production factors, elapsed-time production, stimulation gain/decay, duration, and proportional costs.
-   Keep game-facing state mutation and event publication in the lactation component and recipe integration boundaries.
-   Add or adapt `Player` wrapper methods for CharacterStat and nutrition access. Gameplay subclasses must not call `getStats().something` or `getNutrition().something` directly.
-   Make server recipe transitions operate on the authoritative snapshot and return converged state to the owning client.
-   Perform each production interval atomically: determine elapsed time, calculate factors and requested yield, clamp to capacity, calculate actual yield and costs, update state, then publish once.
-   Preserve existing state and network schema versions unless implementation reveals an actual wire-format change.

## Event Semantics

Treat `BFLactationUpdate` and its legacy alias as notifications, not as the command that drives internal production. The minute callback should perform production directly, then emit the updated notification payload.

Preserve the rename compatibility contract:

-   Emit the BF notification first and the legacy notification second.
-   Keep payloads identical.
-   Do not introduce event recursion or cause an external notification emission to produce additional milk.

## Automated Tests

Add or update focused Jest coverage for:

-   Base rate and elapsed-minute calculations, including collapsed callbacks.
-   Capacity clamping, partial fills, and zero cost at full capacity.
-   Hydration and hunger factors at normal and limiting values.
-   Calories, nutrients, and thirst costs derived from actual liters produced.
-   Additive stimulation, the `0.50` cap, and hourly elapsed-time decay.
-   Breastfeeding, pumping, and hand-expression stimulation based on actual removal.
-   Deterministic Lactaid stimulation.
-   Dairy Cow applying exactly `1.25` production and duration once, with proportional costs.
-   Pregnancy activation not changing demand stimulation.
-   Client/server recipe snapshot convergence and reconnect persistence.
-   BF and legacy lactation notification ordering, identical payloads, and absence of recursion.
-   `Player` wrapper behavior for stats and nutrition access.

Do not add repository-layout, source-scanning, or identity tests. Tests should exercise behavior at the relevant TypeScript/Lua domain boundary.

## Validation

Run, in order:

1. Narrow lactation, recipe, state, event, and Player Jest suites.
2. `npm test -- --runInBand`.
3. `npm run build`.
4. Targeted Prettier and ESLint checks, followed by `npm run check` when appropriate.
5. `git diff --check`.
6. Inspect generated Lua for elapsed-time arithmetic, Player wrapper calls, event order, and authoritative multiplayer recipe updates.

Delegate a maintainability review and a separate Project Zomboid/TypeScript-to-Lua runtime review after implementation. Apply accepted narrow fixes and repeat the automated validation.

## In-Game Validation

Log elapsed time, requested yield, actual yield, stimulation, limiting factors, and metabolic costs during development, then remove or gate diagnostic output before release.

Validate at minimum:

-   Fresh SP character: empty-to-full production at normal needs.
-   Sleep and fast-forward: elapsed production remains proportional and does not skip or multiply costs.
-   Full and nearly full capacity: no cost at full and proportional cost for a partial fill.
-   Feeding, pumping, and hand expression: expected stimulation gain, cap, decay, and duration refresh.
-   High thirst and high hunger: production approaches the specified floors without becoming negative.
-   Dairy Cow: exactly `1.25` yield and duration compared with the same baseline conditions.
-   Late-pregnancy activation: no accidental pregnancy-progress stimulation.
-   Hosted/co-op: authoritative recipe updates, owning-client production, reconnect, and pregnancy/lactation persistence.
-   BF and legacy external event stubs: identical update payloads with no duplicate production.

Dedicated-server validation remains a separate follow-up.

## Completion Criteria

-   The automated and in-game validations above pass.
-   Final tuning values and observed daily output are recorded in this document.
-   `dev/TODO.md` is marked complete with the implementation commit link.
-   This document is retained and updated to `implemented`, including validation results, branch, and commit SHA.

# Lactation Production And Metabolic Costs

Status: partially verified  
Last updated: 2026-08-24  
Project Zomboid build: 42.x (local installed build)  
Scope: client, server, single-player, multiplayer

## Question

Which Build 42 APIs and simulation boundaries can BF safely use for balanced milk production, metabolic costs, and elapsed-time progression?

## Conclusion

Build 42 CharacterStat bounds are `0..1` for THIRST, HUNGER, FATIGUE, and ENDURANCE. ENDURANCE defaults to `1`; the others default to `0`. Native CharacterStat add/set operations clamp values. Nutrition setters clamp calories to `-2200..3700` and carbohydrates, proteins, and lipids to `-500..1000`.

BF previously requested `0.002..0.01 L` every game minute, averaging `8.64 L/day` and filling the default `1 L` capacity in approximately 2.8 game hours. Production costs must be calculated from the actual post-capacity milk delta, not active time or requested production. This prevents costs at full capacity, handles partial fills, and makes production modifiers carry proportional costs.

Lactation remains owning-client simulated and server persisted. Milk changes publish through the existing complete-state boundary; game-owned nutrition and CharacterStats stay on the character and outside BF persistence. Minute callbacks are wake-up signals, so production must reconcile elapsed minute-stamp deltas.

The Dairy Cow trait promises `+25%` production and `+25%` lactation duration. Each modifier must be applied exactly once and independently from temporary demand stimulation.

## Evidence

### Direct observations

-   `src/client/BF/components/Lactation.ts` previously requested `0.002..0.01 L` per minute and clamped the result to capacity.
-   `src/client/BF/components/Lactation.ts` already derives stored production from the before/after milk delta.
-   `src/client/BF/components/Lactation.ts` previously overwrote its Dairy Cow-adjusted expiration with the unadjusted value.
-   `src/client/BF/SandboxOptions.ts` defines a default `1 L` capacity and converts configured expiration days to hours.
-   `dev/example.lua` proposes hourly costs equivalent to about `640..667` calories, `32..33` carbohydrates, `32..33` lipids, and `16..17` proteins per liter at the selected daily target.
-   Installed Build 42 Java bytecode shows CharacterStat clamp behavior and Nutrition setter bounds.
-   Vanilla Build 42 water actions use THIRST on the `0..1` scale, but do not establish a canonical liters-to-thirst conversion for lactation.

### Types or declarations

-   PipeWrench declarations expose `Stats.get/add/set`, `IsoPlayer.getNutrition()`, Nutrition nutrient getters/setters, and `GameTime.getMinutesStamp()` with the shapes used by BF.
-   Declarations confirm callable shapes but do not define a canonical balance model or multiplayer persistence behavior for vanilla nutrition.

### Inference

-   A base range of `0.00035..0.00070 L/min` targets approximately `0.5..1.0 L/day`; this is a game-design choice rather than an engine contract.
-   A thirst cost of `0.20/L` and production floors of `25%` for thirst and `50%` for hunger are initial tuning choices requiring playtesting.
-   Proportional costs based on actual yield naturally make Dairy Cow's additional production cost additional resources.

## Runtime And Version Applicability

The Java, vanilla Lua, and declaration observations apply to the locally installed Build 42 game. Single-player and hosted/co-op already use BF's client-simulated, server-persisted lactation boundary. Dedicated-server convergence and metabolic behavior remain unverified.

## Confidence

Confidence: high for stat/nutrition bounds, previous production rate, capacity-delta costing, elapsed-time requirement, and the Dairy Cow overwrite; medium for the selected balance coefficients and multiplayer persistence of game-owned nutrition.

## Implications For BF

-   Keep all `getStats()` and `getNutrition()` calls inside the Player wrapper boundary.
-   Calculate requested production from elapsed minutes and clamp milk before calculating costs.
-   Apply no cost when capacity prevents production.
-   Keep nutrition and CharacterStats outside `LactationState` and BF protocol schemas.
-   Keep Dairy Cow separate from temporary demand stimulation and apply its duration modifier at one canonical boundary.
-   Preserve server authority for recipe-driven milk removal and stimulation, returning the resulting snapshot to the owning client.

## Remaining Questions

-   What balance coefficients feel sustainable across ordinary survival play, sleep, and fast-forward?
-   Do vanilla nutrition and CharacterStats persist and converge as expected after hosted/co-op reconnect in every supported scenario?
-   How does lactation behave on a dedicated server?

## In-Game Validation

Log elapsed minutes, requested and actual yield, milk capacity, stimulation, thirst/hunger factors, and metabolic costs. Test empty-to-full production, full-capacity no-cost behavior, partial expression, sleep/fast-forward, Dairy Cow, SP, hosted/co-op reconnect, and a collapsed multi-minute callback. Compare character nutrition and stats before and after each exact produced volume.

## History

-   2026-08-24: Initial investigation from BF source, installed Build 42 Java bytecode, vanilla Lua, PipeWrench declarations, and the community balance experiment.

# Being Female

<center>
  <p style="text-align: center;">
    <img alt="poster" style="width: 300px;border: 5px solid" src="./src/root/poster.png">
  </p>
</center>

---

## Overview

**Being Female** is a comprehensive female roleplay enhancement mod for Project Zomboid. This mod introduces realistic female biological systems including menstrual cycles, pregnancy, lactation, and related gameplay mechanics. It provides an immersive experience for players seeking deeper roleplaying opportunities in the zombie apocalypse.

The mod features a complete reproductive system simulation with visual indicators, trait-based modifiers, and extensive UI integration. All systems are designed to be balanced and configurable through sandbox options.

## Features

### 🩸 Menstrual Cycle System

-   **Realistic Cycle Tracking**: 28-day menstrual cycle with 6 distinct phases:
    -   **Recovery**: Post-pregnancy recovery period
    -   **Menstruation**: Bleeding phase with configurable pain effects
    -   **Follicular**: Hormone building phase
    -   **Ovulation**: Peak fertility window
    -   **Luteal**: Pre-menstrual phase
    -   **Pregnant**: Pregnancy state
-   **Fertility Calculations**: Dynamic fertility rates based on cycle phase and traits
-   **Pain Simulation**: Menstrual cramps with trait-based severity modifiers
-   **Cycle Visualization**: UI indicators showing current phase and fertility status

### 🤰 Pregnancy System

-   **Full Pregnancy Simulation**: gestation period with progress tracking
-   **Fertilization Mechanics**: Realistic conception based on fertility rates and timing
-   **Labor & Birth**: Animated birthing sequence
-   **Postpartum Recovery**: Recovery period affecting future fertility
-   **Pregnancy Indicators**: Visual and UI feedback throughout gestation

### 🥛 Lactation System

-   **Milk Production**: Dynamic milk generation based on pregnancy and traits
-   **Expiration Mechanics**: Milk can dry up if not pumped regularly
-   **Lactation Traits**: Special traits that enhance milk production and duration
-   **Visual Feedback**: UI showing milk levels and lactation status
-   **Fluid Mechanics**: Integrated with build 42 fluid mechanics.

### 🎭 Character Traits

The mod adds several female-specific traits that modify gameplay:

-   **Fertile**: +50% fertility rate
-   **Infertile**: Complete infertility (cannot get pregnant)
-   **Hyperfertile**: +100% fertility, faster postpartum recovery
-   **Pregnant**: Active pregnancy state
-   **Dairy Cow**: +25% milk production and +25% lactation duration
-   **Bad Menstrual Cramps**: 2x stronger menstrual pain
-   **No Menstrual Cramps**: No menstrual pain effects

### 🎨 User Interface

-   **BF Panel**: Dedicated UI panel accessible from the character info screen
-   **Real-time Monitoring**:
    -   Womb status (sperm levels, cycle phase, fertility)
    -   Lactation status (milk amount)
    -   Pregnancy progress and status
-   **Visual Indicators**: Dynamic images showing womb and lactation states
-   **Animation Support**: Visual feedback for intercourse and birthing

### 🎬 Animation System

-   **Intercourse Animations**: Contextual animations based on pregnancy status and protection
-   **Birthing Sequences**: Animated labor sequence
-   **Dynamic Rendering**: Animation frames change based on game state

### 🎒 Items

BF introduces some items. check table below to check how rare they are

| Item           | Intended availability | Base-game comparison                           |
| -------------- | --------------------- | ---------------------------------------------- |
| Condom         | Uncommon              | Slightly harder to find than adhesive bandages |
| Condom box     | Uncommon              | About as common as sleeping tablets            |
| Contraceptive  | Uncommon              | Harder to find than painkillers                |
| Lactaid        | Uncommon              | About as common as beta blockers               |
| Breast pump    | Rare                  | Roughly comparable to first-aid kits           |
| Vaginal douche | Rare                  | Comparable to antibiotics                      |
| Used condom    | Uncommon trash loot   | Primarily found in trash or produced           |
| Baby           | Not world loot        | -                                              |

### 🔧 Debug Tools

Built-in debugging utilities for testing and development:

-   Womb data manipulation (sperm levels, cycle progression)
-   Lactation controls (milk amount, toggle status)
-   Pregnancy management (start/stop/advance)
-   All accessible through the `Debug` property on component instances

## Installation

1. Download the mod from the [releases page](https://github.com/zikhad/being-female/releases)
2. Extract to your Project Zomboid mods directory
3. Enable "Being Female" in the mod menu

## 🦸‍♀️ Support!

<hr/>
<br/>
<p align="center">
  <strong>Found this mod fun or useful? You can support its development!</strong>
</p>
<p align="center">
  <a href="https://buymeacoffee.com/zikhad">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow?logo=buymeacoffee" alt="Buy Me a Coffee">
  </a>
</p>
<hr/>

---

## API for Other Mods

This mod provides extensive event hooks for other mods to integrate with:

### Events

#### `BFPregnancyUpdate`: Fired when pregnancy data changes

```lua
Events.BFPregnancyUpdate.Add(function ({
  progress --[[ number ]],
  current --[[ number ]],
  isInLabor --[[ boolean ]]
}) {
  -- called every minute during pregnancy
});
```

#### `BFLactationUpdate`: Fired every minute with lactation data

```lua
Events.BFLactationUpdate.Add(function ({
  isActive --[[ boolean ]],
  milkAmount --[[ number ]],
  multiplier --[[ number ]],
  expiration --[[ how many minues due expiration ]]
}) {
  -- called every minute
});
```

#### `BFWombUpdate`: Fired every minute with womb data

```lua
Events.BFWombUpdate.Add(function ({
  amount --[[ number ]],
	capacity --[[ number ]],
	total --[[ number ]],
	cycleDay --[[ number ]],
	fertility --[[ number ]],
	onContraceptive --[[ boolean ]],
	chances --[[ Table<CyclePhase, number>]]
}) {
  -- called every minute
  -- chances is a table as follows
  --[[
    {
      Recovery = 0,
      Menstruation = 0,
      Follicular = ZombRandFloat(0, 0.3),
      Ovulation = ZombRandFloat(0, 0.4) ,
      Luteal = ZombRandFloat(0.85, 1) ,
      Pregnant = ZombRandFloat(0, 0.3)
    }
  ]]
});
```

#### `BFPregnancyLabor`: Fired during labor

```lua
  Events.BFPregnancyLabor.Add(function (delta --[[ number ]]) {
    -- delta is a number between 0-1 that represents how far along the labor is
  });
```

#### `BFPregnancyStop`: Fired when pregnancy is forcefully stoped

Fired when pregnancy is stopped (via debug or programmatic request, not through natural labor)

```lua
  Events.BFPregnancyStop.Add(function () {
    -- Pregnancy has ended; trigger any cleanup logic
  });
```

### Triggers

#### `BFIntercourse`: Trigger for intercourse event

This will check for condoms and handle intercourse based on current conditions.
Inject a random amount of semen in womb and trigger pregnancy based on fertility.

```lua
  triggerEvent("BFIntercourse");
```

#### `BFMenstrualEffects`: Trigger for menstruation effects

```lua
  triggerEvent("BFMenstrualEffects");
```

#### `BFPregnancyStart`: Trigger to start pregnancy

```lua
  triggerEvent("BFPregnancyStart");
```

#### `BFWombAnimationStart`: Configure a animation to play

Fire during the `start()` lifecycle of animation actions.
You can pass either a predefined key of `ANIMATIONS` or a custom `AnimationSetting`.

Predefined animation name:

```lua
  triggerEvent("BFWombAnimationStart", "intercourse");
  triggerEvent("BFWombAnimationStart", "fertilization");
  triggerEvent("BFWombAnimationStart", "birth");
```

Custom `AnimationSetting`:

```lua
triggerEvent("BFWombAnimationStart", {
  name = "custom-animation", --[[ [required] Folder name of the animation ]]
  steps = [0, 1, 2, 3, 4], --[[ [required] steps of the animation ]]
  loop = 4, --[[ [optional] number of loops the animation will go through ]]
  fullnessSupport = ["full", "empty"], --[[ [optional] will the animation support full / empty states ? ]]
  birth = false,--[[ [optional] is this a birthing animation? ]]
  fertilization = false, --[[ [optional] is this a fertilization animation? ]]
  pregnancy = true, --[[ [optional] will this trigger when character is pregnant  ]]
  condom = false, --[[ [optional] will this trigger when character has a condom in their main inventory  ]]
  path = "media/ui/animation/", --[[ [optional] path of the animation ]]
});
```

Examples of animation paths:

-   `media/ui/animation/custom-animation/empty/0.png`
-   `media/ui/animation/custom-animation/full/0.png`
-   `media/ui/animation/custom-animation/0.png`

Custom settings and predefined variants are both checked against `pregnancy`, `condom`, and `fullnessSupport` before they start. Fullness folders are intended for intercourse animations. Settings marked as `birth` or `fertilization` bypass those state conditions because those sequences are always available when explicitly triggered.

#### `BFWombAnimationUpdate`: Triggers a womb animation update

Usually triggered inside a Update of a **Animation** to apply the animation delta

```lua
  triggerEvent("BFWombAnimationUpdate", {
    delta = 0.5 --[[ [required] - usually the action.getJobDelta() ]],
    duration = 1 --[[ [required] - usualy the action.duration ]]
  });
```

#### `BFWombAnimationStop`: Clear the womb animation state

usually is called at Perform / Stop of a custom animation. ensure the `Animation.wombImage` can show the still image again

```lua
  triggerEvent("BFWombAnimationStop");
```

#### `BFWombImage`: Updates the womb image for the current static image

This will update the `Animation.wombImage` based on current womb / pregnancy state

```lua
  triggerEvent("BFWombImage");
```

### For Mod Integration Developers

For comprehensive guidance on integrating other mods with Being Female—including event patterns, trait extensions, fluid mechanics, Lua UI components, and compatibility considerations—see the **[Mod Integrator Agent Guide](.github/agents/mod-integrator.agent.md)**.

This agent provides:

-   **Event Integration Patterns**: How to listen to pregnancy, lactation, menstrual cycle, and labor updates.
-   **Trait Extensions**: Using BF traits for custom gameplay.
-   **Animation Triggers**: Programmatically starting custom animations and intercourse sequences.
-   **Fluid Mechanics**: Accessing milk and sperm quantities through the mod API.
-   **Optional Mod Hooks**: ZomboLust and MoodleFramework integration patterns.
-   **Common Gotchas**: Timing, dependency checks and testing strategies.

---

## Building And Running The Mod

If you are not familiar with Node.js, the short version is:

1. Install [Node.js](https://nodejs.org/)
2. Open a terminal in this repository
3. Run `npm install` once to download the development tools
4. Run `npm run build` to compile the TypeScript source into the dist folder
5. Copy the `dist/Being Female`into `~/Zomboid/mods` folder
6. Start Project Zomboid and enable the mod

### What The Build Does

-   `npm run build` transpiles the TypeScript code in `src/` into Lua using `typescript-to-lua`
-   After transpiling, `scripts/postbuild.js` copies media and root files, generates Build 42 translations, and prepares the final mod folder inside `dist/`
-   The final packaged mod is written to `dist/Being Female/`

### Typical Development Workflow

1. Run `npm install`
2. Make changes in `src/`
3. Run `npm test` to execute the Jest test suite
4. Run `npm run build` to verify the mod transpiles and packages correctly
5. Copy or sync the built mod to your Project Zomboid mods directory
6. Launch the game and test the feature in Project Zomboid

### Useful Commands

-   `npm install`: installs project dependencies
-   `npm test`: runs the Jest test suite
-   `npm run coverage`: runs tests with coverage output
-   `npm run build`: transpiles TypeScript to Lua and prepares the final mod package in `dist/`
-   `npm run check`: checks formatting and lint rules
-   `npm run lint`: rewrites formatting and runs eslint
-   `npm run watch:build`: rebuilds on file changes and writes output to `~/Zomboid/mods` (only `.ts` files)
-   `npm run animation-creator`: starts the local browser tool for creating animation frame packages
-   `npm run extract-images -- <input>`: extracts numbered PNG frames from a GIF or video in the terminal

### Generating Animation Frames

The animation creator turns `.gif`, `.mp4`, `.mov`, or `.webm` media into the zero-based PNG sequence used by BF. Install [FFmpeg](https://ffmpeg.org/) so both `ffmpeg` and `ffprobe` are available on your `PATH`, then install the repository dependencies with `npm install`.

Run the browser tool:

```bash
npm run animation-creator
```

Open the localhost URL printed in the terminal. Upload or drop a source, configure its trim, FPS, dimensions, fit or fill behavior, and generate a preview. Output dimensions default to 276×276. The preview plays the exact PNG frames that will be downloaded. Step 4 displays the complete BF manifest and installation paths. The resulting ZIP contains a copy-ready `media` directory, the manifest, extraction metadata, and matching installation instructions; the tool never modifies `Animation.ts` or files under `src/`.

Playback defaults to every extracted frame in order. Switch to a custom sequence to combine forward, reverse, ping-pong, held-frame, or explicit frame-list segments and repeat each segment independently. The preview follows the expanded sequence and reports both the playback-step position and underlying PNG frame. Custom sequences are exported through the manifest's `steps` field; simple sequences continue using `frameCount`.

Full and empty layouts apply only to intercourse animations. A single intercourse animation may be plain, full-only, empty-only, or contain paired full and empty sources. Paired sources share their output transform, may use separate trims, and must produce the same number of frames. Birth and fertilization animations always use one plain source.

### Data-Driven Animation Manifests

BF discovers complete animation definitions from `media/BF/animations/*.txt` when a game starts. A new relative manifest path adds a selectable animation. Reusing an existing BF manifest path from a later-loaded mod replaces that complete definition through Project Zomboid's normal virtual-file override behavior; there is no `replaces` field and manifest fields are never merged.

```ini
version=1
name=custom-animation
category=intercourse
frameCount=30
loop=20
fullness=empty,full
pregnancy=false
condom=false
```

Use either `frameCount` for sequential frames `0..n-1` or `steps` for an explicit comma-separated sequence. Supported categories are `intercourse`, `birth`, and `fertilization`. Only intercourse manifests may specify `fullness`, `pregnancy`, or `condom`. The optional `path` must be a safe relative path under `media/ui` and defaults to `media/ui/animation`.

Provider mods should declare BF through `require=` so they load after it. An override that changes its frame count or sequence must provide the complete corresponding PNG set at the paths described by the winning manifest. When multiple mods supply the same manifest or PNG path, Project Zomboid's resolved mod order determines the winner.

For terminal automation, use:

```bash
npm run extract-images -- path/to/source.gif \
  --width 256 \
  --height 256 \
  --fps 5 \
  --mode fit \
  --output path/to/frames
```

Use both `--width` and `--height`, or omit both to keep the source dimensions. Other options include `--starttime HH:MM:SS`, `--endtime HH:MM:SS`, and `--position center`. See `npm run extract-images -- --help` for the complete CLI reference.

### Important Notes

-   Edit files in `src/`, not generated Lua files in `dist/`
-   The mod code does not run directly with Node.js; Node is only used for building, testing, and packaging tools
-   The actual gameplay code runs inside Project Zomboid after it has been transpiled to Lua

## Requirements

-   **Project Zomboid**: Build 42 or later

### Recommendedd mods

-   [ZomboLust](https://www.loverslab.com/files/file/44539-project-zomboid-zombolust-zombodesire-framework/) - Sex Framework - Although not required, this will enable impregnation and womb animations
-   [ZomboRut](https://www.loverslab.com/topic/265927-project-zomboid-zomborut-%E2%80%94-b42-nsfw-sex-mod) - Sex Framework - Although not required, this will enable impregnation and womb animations
    **Note:** Those mods might not be compatible with each other, choose one.

### Optional Mods

-   [MoodleFramework](https://steamcommunity.com/sharedfiles/filedetails/?id=3396446795&searchtext=moodle+framework) - This mod will create custom moodles for **Being Female**

## Configuration

The mod includes several sandbox options for customization:

-   Cycle duration and phase lengths
-   Fertility multipliers
-   Pain effect intensities
-   Lactation rates and durations
-   Animation settings

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## Credits

-   **Zikhad**: Lead developer and maintainer
-   **BlaBla**: Custom Animations
-   **[PipeWrench](https://github.com/asledgehammer/PipeWrench)**: Framework for Typescript zomboid mod creation
-   [@LXZ616](https://github.com/LXZ616) For Chinese translations
-   **Johnstell**: Spanish translation

---

# Upcoming Changes

-   [x] Fix animation looping
-   [x] Fix contraceptive effects (seems not to be working)
-   [x] Check and potentially fix Lactaid
-   [x] Create Sperm fluid
-   [x] Make distribuitions work
-   [x] Fix HaloTextHelper from Moodles.ts
-   [x] Revamp body effects methods
-   [x] Add pain at birth
-   [x] Add fatigue and at birth
-   [x] Create triggers event for animations
-   [x] Reintroduce Babies or similar artifacts
-   [x] Inspect the ZomboLust (new mod that aims to replace Zombowin)

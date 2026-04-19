# Puka Puka — Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Dependencies](#dependencies)
4. [Architecture & Data Flow](#architecture--data-flow)
5. [Module Reference](#module-reference)
6. [Configuration Reference](#configuration-reference)
7. [Performance Notes](#performance-notes)

---

## Overview

Puka Puka is a client-side, no-build interactive audio-visual installation built on **p5.js**. Two machine-learning models run in the browser simultaneously:

- **COCO-SSD** (via ml5.js) — detects and tracks up to four people as bounding boxes
- **MediaPipe SelfieSegmentation** — produces a per-pixel body mask used to draw silhouettes

There is no server-side logic. All state is held in global JavaScript variables within the browser tab.

---

## Repository Structure

```
PukaPuka/
├── README.md              Project overview and quick-start
├── .gitignore
├── docs/
│   └── TECHNICAL.md       This file
└── src/                   Serve this folder locally
    ├── index.html         Entry point — loads all scripts in dependency order
    ├── sketch.js          p5 lifecycle (preload / setup / draw), detection hooks
    ├── modules/
    │   ├── config.js      Shared constants: palette, note definitions, slot assignments
    │   ├── audio.js       AudioSystem class — per-person tracks + background volume
    │   ├── note.js        AbstractNote class — 9 graphic-score shapes
    │   ├── staff.js       Staff class — scrolling lines, opening mark, note pool
    │   ├── detection.js   COCO-SSD slot management with grace-period debounce
    │   └── renderer.js    SelfieSegmentation silhouette rendering
    └── assets/
        ├── sounds/
        │   ├── track1.m4a – track4.m4a   Per-person looping audio
        │   └── backgroundtrack.wav        Ambient background
        └── images/
            └── pukapuka.png               Colour palette reference swatch
```

Script loading order in `index.html` is significant — `config.js` must be first (defines globals used by all other modules), `sketch.js` must be last (calls into all other modules on startup).

---

## Dependencies

| Library | Version | CDN | Purpose |
|---|---|---|---|
| p5.js | 1.9.4 | cdnjs | Rendering, audio preload, math utilities |
| p5.sound | 1.9.4 | cdnjs | `loadSound`, `p5.SoundFile` playback |
| ml5.js | 0.12.2 | unpkg | Wraps TensorFlow.js COCO-SSD object detector |
| MediaPipe SelfieSegmentation | 0.1.1675465747 | jsdelivr | Real-time person segmentation mask |
| Google Fonts — Special Elite | latest | fonts.googleapis.com | Counter / label typography |

**Version pinning rationale:** ml5@0.12.2 was built against p5 v1.x. Using p5 v2.x (the local files in the original scaffold) caused an incompatibility that crashed p5's Friendly Error System on startup. p5 and p5.sound must match exactly; both are pinned to 1.9.4.

---

## Architecture & Data Flow

```
Camera (getUserMedia)
        │
        ├──► COCO-SSD (ml5)          ──► detection.js
        │    async, ~10 fps               • updateSlots()
        │                                 • MISS_GRACE debounce
        │                                 • onPersonDetected(i) / onPersonLost(i)
        │                                         │
        └──► SelfieSegmentation               sketch.js
             async, ~30 fps               • activeSlots Set
             segmentationMask             • slotAlpha[] fade
                    │                     • spawnTimers[] → staff.addNote()
                    ▼                     • audioSystem.startPersonSound(i)
              renderer.js                         │
              drawSilhouettes()                   ▼
              • offscreen canvas            modules/staff.js
              • destination-in mask         • AbstractNote pool
              • blur(22px)                  • scrolling draw loop
              • SCREEN colour wash                │
                                                  ▼
                                           modules/note.js
                                           • AbstractNote.draw()
                                           • activeSlots dim check
```

### Detection Slot Lifecycle

1. COCO-SSD returns person bounding boxes each detection cycle
2. `updateSlots()` matches each box to an existing slot by nearest-centre distance (≤ 220 px)
3. If no match and `slots.length < 4`, a new slot is created and `onPersonDetected(id)` fires
4. If a slot goes unmatched, its `missed` counter increments; `onPersonLost(id)` only fires after `MISS_GRACE = 25` consecutive misses (~2.5 s at ~10 fps), preventing flicker from confidence drops
5. Slot IDs (0–3) are permanently associated with palette colours, note subsets, and audio tracks for the lifetime of the slot

### Note Spawning

- Each draw frame, for every active slot, a countdown timer decrements
- Timer interval = `map(proximity, 0, 1, 55, 14)` frames — ranges from ~1 note/sec when alone to ~4 notes/sec at maximum inter-person proximity
- `avgProximityForSlot(id)` computes the mean of `(1 − distance/MAX_DIST)` across all other active slots
- Notes are spawned from the slot's assigned subset of `NOTE_DEFS` (see `SLOT_NOTES` in config)
- Notes carry their `slotId`; when `activeSlots` no longer contains it the note desaturates 55% and dims to 55% alpha but continues scrolling until `x < −80`

### Silhouette Rendering

Each frame, for every active slot:
1. A hidden `OffscreenCanvas` (same dimensions as main canvas) is cleared
2. The slot colour is painted as a filled rectangle over the detection bounding box
3. `destination-in` composite is applied with the SelfieSegmentation mask, cropped and mirrored to the bounding box — this removes colour from all non-person pixels
4. The result (a person-shaped colour patch) is drawn onto the main canvas with `ctx.filter = 'blur(22px)'`, creating a soft glowing body outline
5. `slotAlpha` (0–1, updated per frame) drives `globalAlpha` for smooth fade in/out

---

## Module Reference

### `modules/config.js`

Defines all shared constants. No classes.

| Export | Type | Description |
|---|---|---|
| `TARGET_LABEL` | `string` | COCO-SSD class to detect (`'person'`) |
| `MAX_TARGETS` | `number` | Maximum simultaneous slots (4) |
| `MAX_DIST` | `number` | Proximity denominator in px video-space (400) |
| `PALETTE` | `number[][]` | Four `[r,g,b]` colours from pukapuka.png |
| `NOTE_DEFS` | `object[]` | 9 note definitions: `{name, freq, staffPos, shape}` |
| `SLOT_NOTES` | `number[][]` | Per-slot index subsets into `NOTE_DEFS` |
| `SCROLL_SPEED` | `number` | Pixels per frame notes travel left (1.4) |
| `STAFF_HEIGHT_RATIO` | `number` | Staff height as fraction of canvas height (0.24) |
| `STAFF_LEFT` | `number` | Left x offset for staff lines (70) |

### `modules/audio.js` — `AudioSystem`

```
new AudioSystem()
  .init(soundFiles)            — call after preload(); sets tracks and bg sound
  .startPersonSound(i)         — loops track[i]; starts background on first call
  .stopPersonSound(i)          — stops track[i]
  .updateBackgroundVolume(0–1) — adjusts bg volume only; never changes rate/pitch
```

`soundFiles` is an array of five `p5.SoundFile` objects loaded in `preload()`.

### `modules/note.js` — `AbstractNote`

```
new AbstractNote(noteDef, slotColor, slotId, startX, lineSpacing)
  .update()        — advances x by SCROLL_SPEED, increments age
  .isOffScreen()   — true when x < −80
  .draw(staffCenterY, lineSpacing)
```

`draw()` checks `activeSlots.has(this.slotId)` on every call. If false: 55% desaturation toward luma, 55% alpha scale. Shape is selected by `noteDef.shape` in a switch statement — 9 branches, all using p5 primitives via `drawingContext` for gradients where needed.

**Shape catalogue:**

| `shape` | Visual description | `staffPos` |
|---|---|---|
| `bar` | Wide horizontal bar + ghost underline | −6 (line) |
| `ring` | Hollow circle with faint fill | −5 (space) |
| `tremolo` | Two vertical bars with thin bridge | −4 (line) |
| `diamond` | Filled rotated square, hollow centre | −3 (space) |
| `arc` | Double concave arc (bracket) | −2 (line) |
| `dots` | Triangle of three circles | −1 (space) |
| `cross` | Plus sign + faint diagonal X | 0 (line) |
| `wave` | Static sine curve + offset echo | 1 (space) |
| `target` | Filled dot + two concentric rings | 2 (line) |

### `modules/staff.js` — `Staff`

```
new Staff()
  .addNote(noteDef, slotColor, slotId)   — appends AbstractNote to pool
  .draw()                                — lines → opening mark → notes → counter
  .resize()                              — recomputes layout, clears pool
```

Internal draw order: `_drawLines()` → `_drawOpeningMark()` → `_updateAndDrawNotes()` → `_drawCounter()`.

Staff lines use a left-to-right `createLinearGradient` through all four palette colours. The opening mark (replaces treble clef) is a gradient vertical spine with tick marks at each line position and a diamond accent at top.

### `modules/detection.js`

Global functions called by `sketch.js` hooks:

```
runDetection()              — starts async COCO-SSD loop; guards on readyState < 2
updateSlots()               — matches detections to slots, manages MISS_GRACE
avgProximityForSlot(id)     — returns 0–1 mean proximity to all other active slots
```

Calls back into `sketch.js` via:
- `onPersonDetected(id)` — fired when a new slot is created
- `onPersonLost(id)` — fired after MISS_GRACE consecutive missed frames

### `modules/renderer.js`

```
initSegmentation()          — initialises MediaPipe SelfieSegmentation, call in setup()
drawSilhouettes(staffH, alphas)  — renders all active silhouettes each frame
```

Internal: `_sendSegFrame()` throttles segmentation to every other draw frame and guards against concurrent requests.

---

## Configuration Reference

To tune the installation for different spaces or hardware:

| Constant | Location | Effect of increasing |
|---|---|---|
| `MISS_GRACE` | `detection.js` | Longer before a disappearing person is dropped (less flicker, slower response) |
| `220` (match radius) | `detection.js` | Wider tolerance for bounding box position jumps |
| `SCROLL_SPEED` | `config.js` | Notes scroll faster across the staff |
| `STAFF_HEIGHT_RATIO` | `config.js` | Staff occupies more vertical space |
| `MAX_DIST` | `config.js` | People must be closer to reach max proximity (more responsive) |
| Spawn interval `55` / `14` | `sketch.js` draw loop | Base / max note density per person |
| `blur(22px)` | `renderer.js` | Softer, larger silhouette glow |

---

## Performance Notes

- **Two concurrent ML models** (COCO-SSD + SelfieSegmentation) run asynchronously. On slower hardware the detection rate may drop, which the `MISS_GRACE` counter absorbs.
- **Note pool** is unbounded by count; notes self-remove via `isOffScreen()`. At maximum spawn rate (~4 notes/frame across 4 people) and a 1920 px canvas, ~400 notes can be simultaneously on screen. Each note is ~20 draw calls. If frame rate drops, reduce the spawn rate or increase `SCROLL_SPEED`.
- **Offscreen canvas** for silhouettes is created once and reused. It is recreated on window resize.
- The `destination-in` masking pass clears and redraws the offscreen canvas once per active slot per frame. With 4 active slots this is 4 full canvas clears per frame — intentional but worth noting.
- SelfieSegmentation is throttled to every other draw frame (`frameCount % 2 !== 0`) to reduce CPU load.

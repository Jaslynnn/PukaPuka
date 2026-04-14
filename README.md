# Puka Puka

> *"The most dangerous of islands — a coral atoll in the middle of the Pacific, so low it barely rises above sea level."*
> — Judith Schalansky, *Atlas of Remote Islands*

An audio-visual simulation inspired by the island Puka Puka from Judith Schalansky's *Atlas of Remote Islands: Fifty Islands I Have Never Set Foot On and Never Will*. The concept centres on the sensuality and togetherness of the island. When two hands touch in the camera feed, a musical note is born — rendered as a cross-stitched mushroom or pixel figure on a scrolling treble clef staff.

---

## How it works

Notes appear on the staff when you either **press a keyboard key** or **touch two index fingertips** together in the camera. The longer a key is held, the longer the stem — and for figures, the more animated the pose. Notes scroll left and gradually disappear off screen.

### Keyboard mapping

| Key | Note | Key | Note |
|-----|------|-----|------|
| A   | C4   | H   | A4   |
| S   | D4   | J   | B4   |
| D   | E4   | K   | C5   |
| F   | F4   | L   | D5   |
| G   | G4   |     |      |

### Hand tracking

Hold both hands up to the camera and bring your index fingertips close together. When they come within range, a note is triggered based on the vertical position of the touch — higher in frame means higher pitch.

### Note modes

Toggle between two visual styles using the buttons below the staff:

- **Mushroom** — a cross-stitched pixel mushroom. The cap appears immediately; the stem grows as long as the key is held.
- **Figure** — a cross-stitched pixel character whose pose depends on how long the key was held:
  - Short tap → **Idle** (standing still)
  - Medium hold → **Walk** (striding)
  - Long hold → **Dance** (arms raised, kicking)

---

## Running locally

No build step or bundler required. Serve the project root over HTTP (browsers block camera and module access from `file://`):

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser and allow camera access when prompted.

---

## File structure

```
PukaPuka/
├── index.html          # Entry point — loads scripts in dependency order
├── style.css           # Layout, island colour palette, fabric grid background
├── sketch.js           # p5.js lifecycle: setup / draw / resize / keyboard input
└── modules/
    ├── config.js       # NOTE_MAP, shared constants, pgXStitch() helper
    ├── audio.js        # AudioPlayer — sine oscillator with ADSR envelope
    ├── note.js         # MushroomNote — cross-stitch cap pre-rendered to buffer
    ├── figure.js       # PixelFigure — 6 pose/frame combos pre-rendered to buffers
    ├── staff.js        # Staff — scrolling treble clef, note pool management
    └── tracker.js      # HandTracker — MediaPipe Hands, camera feed, touch detection
```

---

## Design notes

**Cross-stitch aesthetic** — every pixel in the mushroom cap, treble clef, and figures is rendered as an X-shaped stitch. The body background uses a CSS dot-grid to simulate fabric weave visible through the transparent canvas.

**Island colour palette** — note colours run from coral and mango through palm green and lagoon teal to hibiscus and flamingo. UI elements use warm sandy gold in place of the conventional blue.

**Performance** — note visuals are pre-rendered once to offscreen `p5.Graphics` buffers at spawn time. Each `draw()` call issues a single `image()` per note rather than dozens of `fill()`/`rect()` calls. Buffers are freed via `destroy()` when a note scrolls off screen. The note pool is capped at 25 and MediaPipe frame sending is throttled to ~30 fps.

**Audio** — each note plays a sine wave through a p5.js `Oscillator` shaped by an ADSR envelope (fast attack, 0.5 s decay, sustained at 25%, 1.2 s release).

---

## Dependencies

All loaded via CDN — no installation needed.

| Library | Version | Purpose |
|---------|---------|---------|
| [p5.js](https://p5js.org) | 1.9.4 | Canvas rendering and audio |
| [p5.sound](https://p5js.org/reference/#/libraries/p5.sound) | 1.9.4 | Oscillator and envelope |
| [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands) | 0.4.1646424915 | Hand landmark detection |
| [Special Elite](https://fonts.google.com/specimen/Special+Elite) | — | Typewriter display font |

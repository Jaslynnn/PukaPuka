# Puka Puka

An interactive audio-visual installation for up to four people. A camera detects bodies in the room; each person is assigned a colour from a gradient palette and a looping sound. While they remain in frame, abstract graphical notations scroll continuously across a staff, forming a live graphic score of their presence. When people come physically closer together, the score densifies. When someone leaves, their notes fade and persist on the staff until they scroll away.

Inspired by Judith Schalansky's *Atlas of Remote Islands* — specifically Puka Puka, a coral atoll in the Cook Islands — the piece treats each body as an isolated island: self-contained, yet capable of proximity and resonance with others.

---

## Experience

| State | Visual | Audio |
|---|---|---|
| No one in frame | Empty black canvas, scrolling staff | Background ambient (low volume) |
| Person enters | Blurry coloured silhouette fades in | Person's looping track begins |
| People approach each other | Notes spawn faster | Background volume rises |
| Person leaves | Silhouette fades out, notes dim and scroll off | Person's track stops |

---

## Requirements

- A modern browser with camera access (Chrome or Edge recommended for WebGL/WASM performance)
- A webcam
- Internet connection on first load (CDN libraries cache after that)
- Adequate lighting for body detection

---

## Running Locally

The sketch must be served over HTTP — opening `index.html` directly as a `file://` URL will block camera access and CDN scripts.

```bash
# Python
python3 -m http.server 8080 --directory src

# Node.js
npx http-server src -p 8080

# VS Code
# Right-click src/index.html → "Open with Live Server"
```

Then open `http://localhost:8080`.

Grant camera permission when prompted. Allow 10–15 seconds for the COCO-SSD and SelfieSegmentation models to download and initialise.

---

## Colour Palette

The four person colours are sampled from `images/pukapuka.png`, a gradient swatch generated from the Coolors palette named *pukapuka*:

| Slot | Hex | Role |
|---|---|---|
| 0 | `#7400B8` | Deep purple |
| 1 | `#5390D9` | Steel blue |
| 2 | `#48BFE3` | Teal |
| 3 | `#80FFDB` | Mint |

The staff lines use the same gradient running left to right.

---

## Project Structure

```
PukaPuka/
├── README.md                  ← you are here
├── .gitignore
├── docs/
│   └── TECHNICAL.md           ← full technical documentation
└── src/                ← sketch root (serve this folder)
    ├── index.html
    ├── sketch.js              ← p5 lifecycle, detection hooks, note spawning
    ├── detection.js           ← COCO-SSD slot management with grace period
    ├── renderer.js            ← SelfieSegmentation silhouette rendering
    ├── modules/
    │   ├── config.js          ← palette, note definitions, constants
    │   ├── audio.js           ← AudioSystem (per-person tracks + background)
    │   ├── note.js            ← AbstractNote (9 graphic-score shapes)
    │   └── staff.js           ← Staff (scrolling lines, opening mark, notes)
    ├── sounds/
    │   ├── track1.m4a         ← slot 0 looping track
    │   ├── track2.m4a         ← slot 1 looping track
    │   ├── track3.m4a         ← slot 2 looping track
    │   ├── track4.m4a         ← slot 3 looping track
    │   └── backgroundtrack.wav ← ambient background
    ├── images/
    │   └── pukapuka.png       ← colour palette reference
    └── js/                    ← local library fallbacks (unused at runtime)
        ├── p5.js
        └── addons/
            └── p5.sound.min.js
```

---

## Dependencies

All loaded from CDN at runtime — no build step or package manager required.

| Library | Version | Purpose |
|---|---|---|
| p5.js | 1.9.4 | Canvas rendering, audio preload |
| p5.sound | 1.9.4 | Sound file playback |
| ml5.js | 0.12.2 | COCO-SSD person detection |
| MediaPipe SelfieSegmentation | 0.1.1675465747 | Per-pixel body mask |

---

## Technical Documentation

See [`docs/TECHNICAL.md`](docs/TECHNICAL.md) for architecture, class reference, data flow, and configuration.

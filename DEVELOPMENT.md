# Puka Puka — Technical Development Notes

A record of the decisions, dead ends, and solutions that shaped the piece.

---

## Starting Point

The project began as a p5.js sketch with a camera feed and an existing body detection scaffold using ml5.js COCO-SSD. The goal was to layer audio and a visual filter on top: a dot particle system that responds to the image, and multiple audio tracks that join and leave as people enter and exit the frame.

The HTML file was loading a local copy of `p5.sound.min.js` from the p5.js addons folder. This turned out to be Tone.js v15, not p5.sound — the two libraries had been confused at some point. Functions like `loadSound` and `userStartAudio` didn't exist, which caused the audio system to fail silently before anything else could be diagnosed. The fix was to abandon p5.sound entirely and build the audio layer directly on the Web Audio API and HTML5 Audio.

---

## Architecture

### File structure

```
p5js-setup/
  index.html        — page shell, loads scripts in dependency order
  sketch.js         — p5 setup/draw loop, constants, event hooks
  detection.js      — ml5 COCO-SSD detection loop and slot management
  renderer.js       — dot filter, proximity lines, bounding boxes, HUD
  audio.js          — Web Audio graph, track control, per-frame modulation
  sounds/
    backgroundtrack.wav
    track1.m4a – track4.m4a
```

Scripts are loaded in order: detection → renderer → audio → sketch. Each file relies on globals defined by the others; sketch.js sits last because it calls into all of them.

### Body slot system

Up to four bodies can be tracked at once. Each detected person is assigned a slot (ID 0–3), and that ID maps directly to a track file: slot 0 plays `track1.m4a`, slot 1 plays `track2.m4a`, and so on.

Slots persist across detection frames using a nearest-unmatched algorithm: each new detection is compared against existing unmatched slots and assigned to whichever is closest (within 120 pixels). This prevents tracks from flickering on and off when the detector momentarily loses a person.

Velocity is tracked per slot by computing the displacement of the centroid between detection frames. This `speed` value drives pitch modulation.

```javascript
const velX  = cx - nearest.cx;
const velY  = cy - nearest.cy;
const speed = Math.sqrt(velX * velX + velY * velY);
```

---

## Problem Log

### 1. The webcam wasn't ready when detection started

ml5's detector was being called before the webcam stream had loaded any frame data. The error was: `"The video element has not loaded data yet"`.

Fix: check `capture.elt.readyState < 2` before passing the capture to ml5, and if not ready, attach a `loadeddata` event listener to retry:

```javascript
if (!capture || capture.elt.readyState < 2) {
  capture.elt.addEventListener("loadeddata", runDetection, { once: true });
  return;
}
```

### 2. The 46 MB background track crashed the tab

`loadSound("backgroundtrack.wav")` (the p5.sound approach) attempts to fully decode the audio file into memory before playing. A 46 MB WAV file decoded to raw PCM is several hundred megabytes, which caused the tab to crash or stall.

Fix: use `new Audio()` for the background track instead, which streams the file progressively without buffering it fully. The background track is never connected to the Web Audio graph — it plays directly through the browser's native audio output. This also means its volume is controlled via `audio.volume` rather than a gain node.

### 3. CORS errors when opening from file://

When the page was opened by double-clicking the HTML file (using a `file://` URL), the browser blocked all cross-origin requests. This affected:
- ml5.js downloading the COCO-SSD model weights
- Any audio file loaded via `fetch()`

Fix: serve the project through a local HTTP server (`python3 -m http.server 8080`). This also resolved a secondary issue where the tracks 1–4 were being loaded via fetch internally by an earlier version of the audio code. Switching to `new Audio()` for the tracks avoids fetch entirely, but the COCO-SSD model still requires HTTP.

### 4. The AbortError race condition

`stopTrack()` was being called while an async `audio.play()` promise was still pending. The browser threw:

```
AbortError: The play() request was interrupted by a call to pause()
```

This happened because `play()` is asynchronous — calling `pause()` before the play promise resolves causes the browser to reject the play request. The original code called `audioCtx.resume().then(() => audio.play())` inside `startTrack`, and `stopTrack` called `audio.pause()` synchronously before `.then()` had a chance to run.

Fix: a `trackShouldPlay[]` intent flag array. `startTrack` sets the flag to true; `stopTrack` sets it to false before pausing. The play helper `_playTrack()` checks the flag before calling `audio.play()`, and the fade-out timeout checks the flag again before pausing:

```javascript
function _playTrack(slotId) {
  if (!trackShouldPlay[slotId]) return;
  // ...
}

setTimeout(() => {
  if (trackShouldPlay[slotId]) return; // re-detected before timeout fired
  audio.pause();
}, 500);
```

### 5. Tracks showed as playing but produced no sound

This was the hardest problem. The audio HUD showed tracks as active (`audio.paused === false`), but nothing was audible alongside the background track.

Root cause: the `AudioContext` was being created in p5's `setup()` function, which runs during page load — before any user interaction. Browsers create `AudioContext` instances in a `suspended` state when they are not initiated by a user gesture. Calling `audioCtx.resume()` on click partially worked, but there is a window between the click and the promise resolving during which `audio.play()` would be called with the context still suspended. Audio routed through a suspended context produces no output.

The background track was unaffected because it was never connected to the Web Audio graph — it played through the native audio pipeline regardless of AudioContext state.

Fix: move `AudioContext` creation entirely inside the click handler (`startAudio()`), which runs during `mousePressed()`. A context created inside a user gesture callback starts in `running` state immediately and requires no `resume()` call:

```javascript
function startAudio() {
  if (audioUnlocked) return;
  _initAudioContext(); // called here, inside the gesture — starts 'running'
  audioUnlocked = true;
  // ...
}
```

`setupAudio()` (called from `setup()`) now only creates the `<audio>` elements. The Web Audio graph — `createMediaElementSource`, `StereoPannerNode`, `GainNode` — is built inside `_initAudioContext()`, which runs on first click.

---

## Audio System Design

### Graph structure (per track)

```
HTMLAudioElement
  → MediaElementSourceNode
  → StereoPannerNode
  → GainNode
  → AudioContext.destination
```

`createMediaElementSource` hijacks a `<audio>` element's output and routes it exclusively through the Web Audio graph. Once an element is connected this way, its native audio output is silenced — all sound must flow through the graph to be heard.

### Per-frame modulation

On every draw frame, `updateTrackParams()` is called for each active slot. It modulates three parameters:

**Pan** — the slot's centroid X position in video space (0–640) maps to stereo pan (-1 to +1). A person on the left of frame is heard on the left speaker.

**Pitch (playback rate)** — body movement speed maps to `audio.playbackRate`. Slow/still = 0.4× (slowed down); fast movement = up to 3.2×. `playbackRate` is an HTML property, not a Web Audio AudioParam, so it cannot be scheduled — it is instead lerped manually each frame:

```javascript
audio.playbackRate = lerp(audio.playbackRate, targetRate, 0.12);
```

A proximity boost applies a small multiplier when bodies are close together (max 1.4× at full contact).

**Volume** — bounding box area in video pixels (width × height) serves as a camera-distance proxy. A large bounding box means the person is close; a small one means they are far. This maps to gain (0.15–1.0). The modulation is gated for the first 0.7 seconds of playback to avoid fighting the fade-in ramp.

### Entry and exit

On entry: gain ramps from near-zero to 1.0 over 0.6 seconds, then hands off to the area-based modulation.

On exit: gain is ramped to 0 over 0.4 seconds via a scheduled `linearRampToValueAtTime`, then a 500ms timeout pauses the element and resets it.

---

## Visual System Design

### Dot particle grid

A grid of particles is initialised at canvas startup, spaced 12 pixels apart. Each particle stores a home position (`bx`, `by`) and a current drifted position (`x`, `y`).

On every frame, the camera feed is rendered into an off-screen `p5.Graphics` buffer and `loadPixels()` is called. Each particle samples the video pixel underneath it and computes a 2-pixel Sobel-like gradient:

```javascript
const gx = sampleGray(vx + 2, vy) - sampleGray(vx - 2, vy);
const gy = sampleGray(vx, vy + 2) - sampleGray(vx, vy - 2);
const edgeMag = Math.sqrt(gx * gx + gy * gy);
```

Where edge magnitude exceeds a threshold, the gradient is rotated 90° and applied as a force — pushing the particle along the edge contour rather than across it. A weak spring pulls each particle back toward its home position, and damping keeps the motion organic rather than jittery.

Key physics constants:
- `EDGE_THRESHOLD = 12` (catches faint edges)
- `RETURN_FORCE = 0.02` (weak — dots drift far from grid)
- `DAMPING = 0.78` (low — energy stays in the system)

The maximum edge force scales with the fastest detected body's movement speed, lerped for smooth transitions.

### Touch colour

A `touchAmount` value (0–1) is smoothly animated toward 1 when any two bodies are within 75% of the maximum proximity threshold, and toward 0 when they are apart. This value tints every dot toward a sunset orange, blended at 55% of maximum tint to keep the effect readable without overwhelming the underlying video.

### Cover-fill scaling

The camera capture is 640×480 but the canvas fills the full browser window. A cover-fill scale is computed each frame:

```javascript
const scale = max(width / capture.width, height / capture.height);
```

Offset values `capture._ox` and `capture._oy` store the letterbox offset so that all coordinate mapping functions (`mapX`, `mapY`) can translate between video space and canvas space consistently across resize events.

---

## Color Scheme

The palette was chosen to evoke the ocean-island setting of Puka Puka:

| Role | Value | Description |
|---|---|---|
| Background | `#08162D` | Deep ocean night |
| Slot 0 | `#48CAE4` | Lagoon blue |
| Slot 1 | `#F4A261` | Warm sand |
| Slot 2 | `#52B788` | Palm green |
| Slot 3 | `#E76F51` | Coral |
| Touch tint | `rgb(255, 140, 60)` | Sunset orange |
| Bar fill | `rgb(149, 213, 178)` | Sea foam |

---

## Dependencies

| Library | Version | Source |
|---|---|---|
| p5.js | 1.9.3 | cdnjs CDN |
| ml5.js | 0.12.2 | unpkg CDN (pinned — later versions drop COCO-SSD) |

No build step. No package manager. Everything runs in the browser.

// ═══════════════════════════════════════════════════════════════════════════════
//  tracker.js — HandTracker
//  Camera feed + MediaPipe Hands detection.
//  When two index fingertips come within 50px of each other, fires the onTouch
//  callback with a noteData entry mapped from the vertical touch position
//  (top of frame = highest pitch, bottom = lowest pitch).
// ═══════════════════════════════════════════════════════════════════════════════

class HandTracker {
  constructor(camY, camH) {
    this._camY = camY;
    this._camH = camH;
    this._touchCallback  = null;
    this._landmarks      = [];   // array of hand landmark arrays, one per detected hand
    this._cooldown       = 0;    // frames before next note trigger is allowed
    this._flash          = 0;    // frames remaining for touch burst visual
    this._mpHands        = null;
    this._handsInitTried = false;
    this._handsReady     = false; // true only after initialize() resolves
    this._processing     = false; // true while a frame is in-flight

    this._video = createCapture(VIDEO);
    this._video.hide();
  }

  resize(camY, camH) {
    this._camY = camY;
    this._camH = camH;
  }

  // Register a callback fired when both index fingertips touch.
  // Receives { noteData } mapped from vertical touch position.
  onTouch(callback) {
    this._touchCallback = callback;
  }

  draw() {
    this._tryInitHands(); // lazy-init once MediaPipe script has loaded
    this._sendFrame();
    this._drawFeed();
    this._drawVignette();
    this._drawScanlines();
    this._drawHandOverlay();
    this._checkTouch();
    this._drawLabel();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Called every draw(); kicks off async init the first time Hands is available.
  _tryInitHands() {
    if (this._handsInitTried || typeof Hands === 'undefined') return;
    this._handsInitTried = true;
    this._initHandsAsync();
  }

  async _initHandsAsync() {
    // Pin an exact version so hands.js and its WASM assets always match.
    const VERSION = '0.4.1646424915';
    try {
      this._mpHands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSION}/${file}`,
      });

      this._mpHands.setOptions({
        maxNumHands:            2,
        modelComplexity:        0,   // lite model — faster
        minDetectionConfidence: 0.7,
        minTrackingConfidence:  0.5,
      });

      this._mpHands.onResults((results) => {
        this._landmarks  = results.multiHandLandmarks || [];
        this._processing = false; // ready to accept the next frame
      });

      await this._mpHands.initialize(); // wait for WASM to fully load
      this._handsReady = true;
    } catch (e) {
      console.error('MediaPipe Hands init failed:', e);
    }
  }

  // Send one frame to MediaPipe. Throttled to every other draw() call and
  // skips entirely if a frame is already in-flight (MediaPipe ~15-30 fps).
  _sendFrame() {
    if (frameCount % 2 !== 0) return;
    if (!this._mpHands || !this._handsReady || this._processing) return;
    const el = this._video.elt;
    if (el.readyState < 2) return;
    this._processing = true;
    this._mpHands.send({ image: el }).catch(() => {
      this._processing = false; // reset on error so we can retry
    });
  }

  _drawFeed() {
    if (!this._video) return;
    const vw = this._video.width;
    const vh = this._video.height;
    if (!vw || !vh) return;

    // Cover-fit: scale uniformly to fill the region, crop excess.
    const sc    = max(width / vw, this._camH / vh);
    const drawW = vw * sc;
    const drawH = vh * sc;
    const offX  = (width      - drawW) / 2;
    const offY  = (this._camH - drawH) / 2;

    const ctx = drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, this._camY, width, this._camH);
    ctx.clip();

    push();
    translate(width, this._camY);
    scale(-1, 1);
    tint(155, 130, 90, 185);
    image(this._video, offX, offY, drawW, drawH);
    pop();

    ctx.restore();
  }

  _drawVignette() {
    const ctx = drawingContext;
    const cx  = width / 2;
    const cy  = this._camY + this._camH / 2;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, this._camH * 0.05, cx, cy, max(width, this._camH) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,6,2,0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, this._camY, width, this._camH);
    ctx.restore();
  }

  _drawScanlines() {
    // Raw canvas API avoids p5 per-call state overhead across hundreds of lines.
    const ctx = drawingContext;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.165)';
    for (let sy = this._camY; sy < this._camY + this._camH; sy += 3) {
      ctx.fillRect(0, sy, width, 1);
    }
    ctx.restore();
  }

  _drawHandOverlay() {
    if (!this._landmarks || this._landmarks.length === 0) return;

    // Landmark 8 = index fingertip
    const tips = this._landmarks.map(h => this._toCanvas(h[8]));

    noStroke();
    rectMode(CORNER);

    // Fingertip markers
    for (const t of tips) {
      fill(255, 220, 100, 50);
      rect(t.x - 10, t.y - 10, 20, 20); // outer glow square
      fill(255, 220, 100, 225);
      rect(t.x - 3,  t.y - 3,   6,  6); // inner pixel dot
    }

    // When both hands are visible, draw a connecting line that brightens on approach
    if (tips.length === 2) {
      const d = dist(tips[0].x, tips[0].y, tips[1].x, tips[1].y);

      if (d < 120) {
        const lineAlpha = map(d, 120, 0, 0, 180);
        stroke(255, 220, 100, lineAlpha);
        strokeWeight(2);
        line(tips[0].x, tips[0].y, tips[1].x, tips[1].y);
        noStroke();
      }

      // Square burst at midpoint on touch
      if (this._flash > 0) {
        const mx = floor((tips[0].x + tips[1].x) / 2);
        const my = floor((tips[0].y + tips[1].y) / 2);
        const fa = map(this._flash, 0, 15, 0, 190);
        const s  = map(this._flash, 0, 15, 4, 28);
        fill(255, 235, 160, fa);
        rect(mx - floor(s / 2), my - floor(s / 2), floor(s), floor(s));
        this._flash--;
      }
    }
  }

  _checkTouch() {
    if (this._landmarks.length < 2 || !this._touchCallback) return;
    if (this._cooldown > 0) { this._cooldown--; return; }

    const tip1 = this._toCanvas(this._landmarks[0][8]);
    const tip2 = this._toCanvas(this._landmarks[1][8]);
    const d    = dist(tip1.x, tip1.y, tip2.x, tip2.y);

    if (d < 50) {
      const avgY     = (tip1.y + tip2.y) / 2;
      const noteData = this._yToNote(avgY);
      this._touchCallback({ noteData });
      this._cooldown = 45;  // ~0.75s at 60fps
      this._flash    = 15;
    }
  }

  // Convert a normalised MediaPipe landmark {x,y} to canvas px (mirrored to match feed).
  _toCanvas(lm) {
    return {
      x: floor(width - lm.x * width),
      y: floor(this._camY + lm.y * this._camH),
    };
  }

  // Map a canvas Y within the camera section to a NOTE_MAP entry.
  // Top of frame → highest pitch; bottom → lowest pitch.
  _yToNote(canvasY) {
    const list = Object.values(NOTE_MAP).sort((a, b) => b.staffPos - a.staffPos);
    const t    = constrain(map(canvasY, this._camY, this._camY + this._camH, 0, 1), 0, 1);
    const idx  = constrain(floor(t * list.length), 0, list.length - 1);
    return list[idx];
  }

  _drawLabel() {
    noStroke();
    fill(200, 165, 100, 55);
    textFont("'Special Elite', 'Courier New', monospace");
    textSize(10);
    textAlign(LEFT, TOP);

    let status = 'MOTION TRACKING';
    if (this._mpHands) {
      if (this._landmarks.length === 0) status = 'TRACKING...';
      else status = `${this._landmarks.length} HAND${this._landmarks.length > 1 ? 'S' : ''} DETECTED`;
    }
    text(status, 14, this._camY + 12);
  }
}

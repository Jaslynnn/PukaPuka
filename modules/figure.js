// ═══════════════════════════════════════════════════════════════════════════════
//  figure.js — PixelFigure
//  Cross-stitch pixel-art character. Pose driven by key-hold duration.
//  All 6 pose/frame combos pre-rendered to p5.Graphics buffers.
//
//  Duration thresholds (ratio = stemLen / lineSpacing):
//    ratio < 1.5  → IDLE   (short tap)
//    ratio < 3.5  → WALK   (medium hold)
//    ratio ≥ 3.5  → DANCE  (long hold)
// ═══════════════════════════════════════════════════════════════════════════════

// Pixel bitmaps per pose — 2 animation frames each.
// 'X' = filled pixel unit, '.' = transparent. Each string = one row (top→bot).
// Width: 6 units, Height: 6 units. Character feet sit at the note's y position.
const FIGURE_POSES = {
  idle: [
    ['..XX..',   // ── Frame 0 ──
     '..XX..',
     '.XXXX.',
     '..XX..',
     '.X..X.',
     '.X..X.'],
    ['..XX..',   // ── Frame 1 (same — standing still) ──
     '..XX..',
     '.XXXX.',
     '..XX..',
     '.X..X.',
     '.X..X.'],
  ],
  walk: [
    ['..XX..',   // ── Frame 0 — right foot forward ──
     '..XX..',
     '.XXXX.',
     '..XX..',
     '.XX...',
     '..X...'],
    ['..XX..',   // ── Frame 1 — left foot forward ──
     '..XX..',
     '.XXXX.',
     '..XX..',
     '...XX.',
     '...X..'],
  ],
  dance: [
    ['X.XX..',   // ── Frame 0 — left arm raised, right kick ──
     '..XX..',
     '..XX..',
     '.XXXX.',
     '..X.X.',
     '..X...'],
    ['..XX.X',   // ── Frame 1 — right arm raised, left kick ──
     '..XX..',
     '..XX..',
     '.XXXX.',
     '.X.X..',
     '....X.'],
  ],
};

const POSE_LABELS = { idle: 'IDLE', walk: 'WALK', dance: 'DANCE' };

class PixelFigure {
  constructor(noteData, startX, lineSpacing) {
    this.name     = noteData.name;
    this.freq     = noteData.freq;
    this.staffPos = noteData.staffPos;
    this.color    = noteData.color;
    this.x        = startX;
    this.age      = 0;

    this._lineSpacing = lineSpacing;
    this._u           = max(3, floor(lineSpacing / 4)); // larger unit for bigger figures

    this.stemLen     = lineSpacing * 0.5;
    this.stemGrowing = true;
    this._maxStemLen = lineSpacing * 6.5;
    this._growRate   = lineSpacing * 0.05;

    this._bufs = this._prerenderAll();
  }

  get _pose() {
    const r = this.stemLen / this._lineSpacing;
    if (r < 1.5) return 'idle';
    if (r < 3.5) return 'walk';
    return 'dance';
  }

  growStem() {
    if (this.stemGrowing) {
      this.stemLen = min(this.stemLen + this._growRate, this._maxStemLen);
    }
  }

  finalizeStem() {
    this.stemGrowing = false;
    this._frozenFrame = floor(this.age / 12) % 2;
  }

  update() {
    this.x -= SCROLL_SPEED;
    this.age++;
  }

  isOffScreen() {
    return this.x < -100;
  }

  destroy() {
    if (!this._bufs) return;
    for (const pose of Object.keys(this._bufs)) {
      for (const buf of this._bufs[pose]) {
        if (buf) buf.remove();
      }
    }
    this._bufs = null;
  }

  draw(staffCenterY, lineSpacing) {
    const x  = floor(this.x);
    const y  = floor(staffCenterY - this.staffPos * (lineSpacing / 2));
    const [r, g, b] = this.color;
    const fa = min(1, this.age / 8);
    const u  = this._u;

    const pose  = this._pose;
    const frame = this.stemGrowing
      ? floor(this.age / 12) % 2
      : (this._frozenFrame ?? 0);

    const rows  = 6, cols = 6;
    const halfC = floor(cols / 2); // 3

    push();
    noStroke();
    rectMode(CORNER);

    // ── Ledger line for C4 ───────────────────────────────────────────────────
    if (this.staffPos <= -6) {
      fill(210, 175, 110, 115 * fa);
      rect(x - 14, y - 1, 28, 2);
    }

    // ── Figure — single image() from pre-rendered cross-stitch buffer ─────────
    if (this._bufs) {
      const buf  = this._bufs[pose][frame];
      const bufX = x - halfC * u;
      const bufY = y - rows * u;

      if (fa < 1) {
        tint(255, 255 * fa);
        image(buf, bufX, bufY, cols * u, rows * u);
        noTint();
      } else {
        image(buf, bufX, bufY, cols * u, rows * u);
      }
    }

    // ── Note name + pose label ───────────────────────────────────────────────
    fill(r, g, b, 135 * fa);
    textFont("'Special Elite', 'Courier New', monospace");
    textSize(9);
    textAlign(CENTER, TOP);
    text(this.name + ' ' + POSE_LABELS[pose], x, y + u + 3);

    pop();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Pre-render all 6 pose/frame combos as cross-stitch X shapes.
  // Buffer layout: cols*u wide × rows*u tall, col 0 at left edge (no centering).
  // Caller offsets by halfC*u when calling image().
  _prerenderAll() {
    const u       = this._u;
    const [r,g,b] = this.color;
    const rows    = 6, cols = 6;
    const W       = cols * u;
    const H       = rows * u;
    const halfC   = floor(cols / 2);
    const sw      = max(1, floor(u * 0.42));

    const bufs = {};

    for (const pose of ['idle', 'walk', 'dance']) {
      bufs[pose] = [];

      for (let frame = 0; frame < 2; frame++) {
        const pg     = createGraphics(W, H);
        pg.noSmooth();
        pg.pixelDensity(1);
        pg.noFill();
        pg.strokeWeight(sw);

        const bitmap = FIGURE_POSES[pose][frame];

        // Head rows (0–1): brighter shade
        pg.stroke(min(r+70,255), min(g+70,255), min(b+70,255), 242);
        for (let row = 0; row <= 1; row++) {
          const py = row * u;
          for (let col = 0; col < cols; col++) {
            if (bitmap[row][col] === 'X') pgXStitch(pg, col * u, py, u);
          }
        }

        // Body rows (2+): base color
        pg.stroke(r, g, b, 242);
        for (let row = 2; row < rows; row++) {
          const py = row * u;
          for (let col = 0; col < cols; col++) {
            if (bitmap[row][col] === 'X') pgXStitch(pg, col * u, py, u);
          }
        }

        // Eyes — small filled dots (too tiny for X at small u; contrasts nicely)
        // Canvas origin at top-left of buffer; offset matches draw() image placement:
        //   left eye  canvas: x - floor(u*0.9)  → buf x = halfC*u - floor(u*0.9)
        //   right eye canvas: x + floor(u*0.55) → buf x = halfC*u + floor(u*0.55)
        //   eye y     buffer: eyeRow*u + floor(u*0.25)
        pg.noStroke();
        pg.fill(35, 18, 8, 235);
        const halfCu  = halfC * u;
        const eyeYbuf = u + floor(u * 0.25); // eyeRow=1
        const eyeSize = max(1, floor(u * 0.38));
        pg.rect(halfCu - floor(u * 0.9),  eyeYbuf, eyeSize, eyeSize);
        pg.rect(halfCu + floor(u * 0.55), eyeYbuf, eyeSize, eyeSize);

        bufs[pose].push(pg);
      }
    }

    return bufs;
  }
}

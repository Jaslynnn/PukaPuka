// ═══════════════════════════════════════════════════════════════════════════════
//  note.js — MushroomNote
//  Cross-stitch mushroom: cap is X-stitched into a p5.Graphics buffer once;
//  stem is drawn as a running stitch (dashed line) each frame.
// ═══════════════════════════════════════════════════════════════════════════════

// Cap shape: each value is the full width of that row in pixel-units (top → bot)
const CAP_ROWS = [2, 4, 6, 8, 8, 6];

class MushroomNote {
  constructor(noteData, startX, lineSpacing) {
    this.name     = noteData.name;
    this.freq     = noteData.freq;
    this.staffPos = noteData.staffPos;
    this.color    = noteData.color;
    this.x        = startX;
    this.age      = 0;

    this._lineSpacing = lineSpacing;
    this._u           = max(2, floor(lineSpacing / 6)); // 1 pixel unit

    // Stem: starts short, grows each frame while stemGrowing is true
    this.stemLen     = lineSpacing * 0.5;
    this.stemGrowing = true;
    this._maxStemLen = lineSpacing * 6.5;
    this._growRate   = lineSpacing * 0.05;

    this._spots  = this._generateSpots();
    this._capBuf = this._prerenderCap();
  }

  growStem() {
    if (this.stemGrowing) {
      this.stemLen = min(this.stemLen + this._growRate, this._maxStemLen);
    }
  }

  finalizeStem() {
    this.stemGrowing = false;
  }

  update() {
    this.x -= SCROLL_SPEED;
    this.age++;
  }

  isOffScreen() {
    return this.x < -100;
  }

  destroy() {
    if (this._capBuf) { this._capBuf.remove(); this._capBuf = null; }
  }

  draw(staffCenterY, lineSpacing) {
    const x  = floor(this.x);
    const y  = floor(staffCenterY - this.staffPos * (lineSpacing / 2));
    const [r, g, b] = this.color;
    const fa = min(1, this.age / 8);
    const u  = this._u;
    const sl = floor(this.stemLen);

    push();
    rectMode(CORNER);

    // ── Ledger line for C4 (staffPos = -6) ──────────────────────────────────
    if (this.staffPos <= -6) {
      noStroke();
      fill(210, 175, 110, 115 * fa);
      rect(x - 14, y - 1, 28, 2);
    }

    // ── Stem as running stitches ─────────────────────────────────────────────
    const sw    = max(1, floor(u * 0.5));
    const stepH = u + max(1, floor(u * 0.45));
    noFill();
    stroke(r, g, b, 210 * fa);
    strokeWeight(sw);
    for (let sy = 0; sy < sl; sy += stepH) {
      line(x, y + sy, x, y + min(sy + u, sl));
    }

    // Blinking pixel at the growing tip
    if (this.stemGrowing && frameCount % 14 < 7) {
      noStroke();
      fill(255, 248, 220, 220 * fa);
      rect(x - floor(sw / 2), y + sl, sw, u);
    }

    // ── Cap — single image() from pre-rendered cross-stitch buffer ───────────
    if (this._capBuf) {
      const capH = CAP_ROWS.length * u;
      const capW = 8 * u;
      noStroke();
      if (fa < 1) {
        tint(255, 255 * fa);
        image(this._capBuf, x - capW / 2, y - capH, capW, capH);
        noTint();
      } else {
        image(this._capBuf, x - capW / 2, y - capH, capW, capH);
      }
    }

    // ── Note name ────────────────────────────────────────────────────────────
    noStroke();
    fill(r, g, b, 145 * fa);
    textFont("'Special Elite', 'Courier New', monospace");
    textSize(9);
    textAlign(CENTER, TOP);
    text(this.name, x, y + sl + 5);

    pop();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Render cap as cross-stitch X shapes into an offscreen buffer.
  _prerenderCap() {
    const u       = this._u;
    const [r,g,b] = this.color;
    const numRows = CAP_ROWS.length;
    const capH    = numRows * u;
    const capW    = 8 * u;
    const cx      = capW / 2;
    const sw      = max(1, floor(u * 0.42));

    const pg = createGraphics(capW, capH);
    pg.noSmooth();
    pg.pixelDensity(1);
    pg.noFill();
    pg.strokeWeight(sw);

    for (let i = 0; i < numRows; i++) {
      const w      = CAP_ROWS[i] * u;
      const ry     = i * u;
      const startX = cx - floor(w / 2);

      let lr = r, lg = g, lb = b;
      if      (i === 0)           { lr = min(r+80,255); lg = min(g+80,255); lb = min(b+80,255); }
      else if (i === 1)           { lr = min(r+40,255); lg = min(g+40,255); lb = min(b+40,255); }
      else if (i === numRows - 1) { lr = max(r-50,0);   lg = max(g-50,0);   lb = max(b-50,0);   }

      pg.stroke(lr, lg, lb, 245);
      for (let xi = 0; xi < CAP_ROWS[i]; xi++) {
        pgXStitch(pg, startX + xi * u, ry, u);
      }
    }

    // Spots as white X stitches
    pg.stroke(255, 248, 220, 215);
    for (const sp of this._spots) {
      const rowW = (CAP_ROWS[sp.row] || 0) * u;
      if (abs(sp.col * u) < floor(rowW / 2) - u) {
        pgXStitch(pg, cx + sp.col * u - floor(u / 2), sp.row * u, u);
      }
    }

    return pg;
  }

  _generateSpots() {
    const spots = [];
    const count = floor(random(1, 4));
    for (let i = 0; i < count; i++) {
      spots.push({
        col: floor(random(-3, 4)),
        row: floor(random(2, 5)),
      });
    }
    return spots;
  }
}

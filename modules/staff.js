// ═══════════════════════════════════════════════════════════════════════════════
//  staff.js — Staff
//  8-bit pixel staff lines + treble clef. No background animation.
//  addNote(noteData, mode) creates either a MushroomNote or a PixelFigure.
// ═══════════════════════════════════════════════════════════════════════════════

class Staff {
  constructor() {
    this.notes      = [];
    this.totalNotes = 0;
    this.computeLayout();
  }

  computeLayout() {
    this.staffH       = height * STAFF_HEIGHT_RATIO;
    this.staffCenterY = this.staffH * 0.52;
    this.lineSpacing  = this.staffH * 0.09;
  }

  resize() {
    this.computeLayout();
    for (const n of this.notes) n.destroy?.();
    this.notes = []; // clear to avoid geometry mismatch after resize
  }

  // Spawn a note in the given mode ('mushroom' | 'figure').
  // Returns the instance so sketch.js can track stem growth.
  // Caps the pool at 25 to bound memory and draw cost.
  addNote(noteData, mode = 'mushroom') {
    if (this.notes.length >= 25) {
      this.notes.shift()?.destroy?.();
    }
    const n = mode === 'figure'
      ? new PixelFigure(noteData, width - 30, this.lineSpacing)
      : new MushroomNote(noteData, width - 30, this.lineSpacing);
    this.notes.push(n);
    this.totalNotes++;
    return n;
  }

  draw() {
    this._drawLines();
    this._drawClef();
    this._updateAndDrawNotes();
    this._drawCounter();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  // Staff lines: 1px crisp rect + wider low-opacity glow rect.
  _drawLines() {
    const x0 = STAFF_LEFT;
    const x1 = width - 20;
    rectMode(CORNER);
    for (let i = -2; i <= 2; i++) {
      const y = floor(this.staffCenterY - i * this.lineSpacing);
      fill(210, 175, 110, 18);
      rect(x0, y - 2, x1 - x0, 5);   // glow
      fill(210, 175, 110, 85);
      rect(x0, y, x1 - x0, 1);        // crisp line
    }
  }

  _drawClef() {
    push();
    textFont('serif');
    textSize(this.lineSpacing * 5.8);
    textAlign(CENTER, CENTER);
    // Stitch shadow for embroidered look
    stroke(120, 80, 35, 70);
    strokeWeight(1.5);
    fill(210, 165, 90, 135);
    text('\u{1D11E}', STAFF_LEFT - 30, this.staffCenterY + this.lineSpacing * 0.5);
    pop();
  }

  _drawCounter() {
    push();
    noStroke();
    fill(210, 175, 110, 55);
    textFont("'Special Elite', 'Courier New', monospace");
    textSize(11);
    textAlign(CENTER, TOP);
    text(`population: ${this.totalNotes} notes`, width / 2, 12);
    pop();
  }

  _updateAndDrawNotes() {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.update();
      if (n.isOffScreen()) {
        n.destroy?.();
        this.notes.splice(i, 1);
        continue;
      }
      n.draw(this.staffCenterY, this.lineSpacing);
    }
  }
}

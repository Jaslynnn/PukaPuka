// Scrolling graphic-score staff. All four person slots share one staff;
// notes are colour-coded by slot via their slotColor.

class Staff {
  constructor() {
    this.notes      = [];
    this.totalNotes = 0;
    this.computeLayout();
  }

  computeLayout() {
    this.staffH       = height * STAFF_HEIGHT_RATIO;
    this.staffCenterY = this.staffH * 0.55;
    this.lineSpacing  = this.staffH * 0.11;
  }

  resize() {
    this.computeLayout();
    this.notes = [];
  }

  // noteDef — entry from NOTE_DEFS; slotColor — [r,g,b] from PALETTE; slotId — 0..3
  addNote(noteDef, slotColor, slotId) {
    const n = new AbstractNote(noteDef, slotColor, slotId, width - 20, this.lineSpacing);
    this.notes.push(n);
    this.totalNotes++;
  }

  draw() {
    this._drawLines();
    this._drawOpeningMark();
    this._updateAndDrawNotes();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  _drawLines() {
    const ctx = drawingContext;
    const x0  = STAFF_LEFT;
    const x1  = width - 20;

    // Left-to-right gradient through the palette: purple → blue → teal → mint.
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0,    'rgba(116,  0, 184, 0.55)');
    grad.addColorStop(0.33, 'rgba( 83,144, 217, 0.55)');
    grad.addColorStop(0.66, 'rgba( 72,191, 227, 0.55)');
    grad.addColorStop(1,    'rgba(128,255, 219, 0.55)');

    const glowGrad = ctx.createLinearGradient(x0, 0, x1, 0);
    glowGrad.addColorStop(0,    'rgba(116,  0, 184, 0.10)');
    glowGrad.addColorStop(0.33, 'rgba( 83,144, 217, 0.10)');
    glowGrad.addColorStop(0.66, 'rgba( 72,191, 227, 0.10)');
    glowGrad.addColorStop(1,    'rgba(128,255, 219, 0.10)');

    ctx.save();
    for (let i = -2; i <= 2; i++) {
      const y = floor(this.staffCenterY - i * this.lineSpacing);
      // soft glow rect
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x0, y - 2, x1 - x0, 5);
      // crisp 1px line
      ctx.fillStyle = grad;
      ctx.fillRect(x0, y, x1 - x0, 1);
    }
    ctx.restore();
  }

  // Replaces the treble clef with an abstract graphic-score opening mark:
  // a gradient vertical bar with short horizontal ticks at each staff line,
  // suggesting a scale/ruler rather than traditional notation.
  _drawOpeningMark() {
    const ctx      = drawingContext;
    const topY     = this.staffCenterY - 2 * this.lineSpacing - this.lineSpacing * 0.6;
    const botY     = this.staffCenterY + 2 * this.lineSpacing + this.lineSpacing * 0.6;
    const barX     = STAFF_LEFT - 18;
    const barW     = 3;
    const tickW    = 10;

    const grad = ctx.createLinearGradient(0, topY, 0, botY);
    grad.addColorStop(0,    'rgba(116,  0, 184, 0.75)');
    grad.addColorStop(0.33, 'rgba( 83,144, 217, 0.75)');
    grad.addColorStop(0.66, 'rgba( 72,191, 227, 0.75)');
    grad.addColorStop(1,    'rgba(128,255, 219, 0.75)');

    ctx.save();
    ctx.fillStyle = grad;

    // Vertical spine
    ctx.fillRect(barX, topY, barW, botY - topY);

    // Horizontal ticks at each staff line
    for (let i = -2; i <= 2; i++) {
      const y = floor(this.staffCenterY - i * this.lineSpacing);
      // longer tick on the middle line (B4 / staffPos 0)
      const tw = (i === 0) ? tickW * 1.6 : tickW;
      ctx.fillRect(barX, y - 1, tw, 2);
    }

    // Small diamond accent at the top
    ctx.save();
    ctx.translate(barX + floor(barW / 2), topY - 5);
    ctx.rotate(PI / 4);
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();

    ctx.restore();
  }

  _updateAndDrawNotes() {
    // Update and cull off-screen notes first.
    for (let i = this.notes.length - 1; i >= 0; i--) {
      this.notes[i].update();
      if (this.notes[i].isOffScreen()) this.notes.splice(i, 1);
    }
    for (const n of this.notes) {
      n.draw(this.staffCenterY, this.lineSpacing);
    }
  }
}

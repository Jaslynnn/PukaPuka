// Abstract graphical notation — inspired by graphic score / extended notation.
// Each shape type corresponds to one NOTE_DEFS entry and scrolls on the staff.

class AbstractNote {
  constructor(noteDef, slotColor, slotId, startX, lineSpacing) {
    this.staffPos = noteDef.staffPos;
    this.shape    = noteDef.shape;
    this.color    = slotColor;
    this.slotId   = slotId;
    this.x        = startX;
    this.age      = 0;
    this._ls      = lineSpacing;
  }

  update() {
    this.x -= SCROLL_SPEED;
    this.age++;
  }

  isOffScreen() { return this.x < -80; }

  draw(staffCenterY, lineSpacing) {
    const x  = floor(this.x);
    const y  = floor(staffCenterY - this.staffPos * (lineSpacing / 2));
    const fa = min(1, this.age / 10);

    // When the person who spawned this note has left: partial desaturation
    // and reduced alpha so notes are clearly dimmer but still visible.
    const slotActive = activeSlots.has(this.slotId);
    let [r, g, b] = this.color;
    let alphaScale = 1;
    if (!slotActive) {
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      r = floor(lerp(r, luma, 0.55));
      g = floor(lerp(g, luma, 0.55));
      b = floor(lerp(b, luma, 0.55));
      alphaScale = 0.55;
    }

    const a = 215 * fa * alphaScale;
    const s         = max(8, floor(lineSpacing * 0.88));

    push();
    rectMode(CENTER);

    switch (this.shape) {

      // ── Three dots (cluster / trichord) ───────────────────────────────────
      case 'dots': {
        const dr = max(2, floor(s * 0.24));
        noStroke();
        fill(r, g, b, a);
        ellipse(x - floor(s * 0.44), y + floor(s * 0.28), dr * 2,   dr * 2);
        ellipse(x + floor(s * 0.44), y + floor(s * 0.28), dr * 2,   dr * 2);
        ellipse(x,                   y - floor(s * 0.28), dr * 2.5, dr * 2.5);
        break;
      }

      // ── Plus + faint diagonal X ───────────────────────────────────────────
      case 'cross': {
        const cw = max(2, floor(s * 0.22));
        noStroke();
        fill(r, g, b, a);
        rect(x, y, floor(s * 1.3), cw);
        rect(x, y, cw, floor(s * 1.3));
        fill(r, g, b, a * 0.38);
        push(); translate(x, y); rotate(PI / 4);
        rect(0, 0, floor(s * 1.3), cw);
        rect(0, 0, cw, floor(s * 1.3));
        pop();
        break;
      }

      // ── Static sine wave ──────────────────────────────────────────────────
      case 'wave': {
        noFill();
        stroke(r, g, b, a);
        strokeWeight(max(2, floor(s * 0.22)));
        beginShape();
        for (let wx = x - s; wx <= x + s; wx += 2) {
          const t = map(wx, x - s, x + s, 0, TWO_PI * 1.5);
          vertex(wx, y + sin(t) * floor(s * 0.3));
        }
        endShape();
        stroke(r, g, b, a * 0.38);
        strokeWeight(max(1, floor(s * 0.13)));
        beginShape();
        for (let wx = x - s; wx <= x + s; wx += 2) {
          const t = map(wx, x - s, x + s, 0, TWO_PI * 1.5);
          vertex(wx, y + floor(s * 0.5) + sin(t + PI) * floor(s * 0.18));
        }
        endShape();
        break;
      }

      // ── Concentric circles (bullseye) ──────────────────────────────────────
      case 'target': {
        noStroke();
        fill(r, g, b, a);
        ellipse(x, y, floor(s * 0.62), floor(s * 0.62));
        noFill();
        stroke(r, g, b, a * 0.8);
        strokeWeight(max(1, floor(s * 0.18)));
        ellipse(x, y, floor(s * 1.3), floor(s * 1.3));
        stroke(r, g, b, a * 0.38);
        strokeWeight(max(1, floor(s * 0.12)));
        ellipse(x, y, floor(s * 1.95), floor(s * 1.95));
        break;
      }
    }

    pop();
  }
}

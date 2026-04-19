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

      // ── Thick horizontal duration bar ─────────────────────────────────────
      case 'bar': {
        noStroke();
        fill(r, g, b, a);
        rect(x, y, floor(s * 2.4), max(3, floor(s * 0.32)));
        fill(r, g, b, a * 0.28);
        rect(x, y + floor(s * 0.52), floor(s * 1.5), max(2, floor(s * 0.18)));
        break;
      }

      // ── Hollow circle with faint fill ─────────────────────────────────────
      case 'ring': {
        noFill();
        stroke(r, g, b, a);
        strokeWeight(max(2, floor(s * 0.22)));
        ellipse(x, y, floor(s * 1.5), floor(s * 1.5));
        noStroke();
        fill(r, g, b, a * 0.22);
        ellipse(x, y, floor(s * 1.5), floor(s * 1.5));
        break;
      }

      // ── Two vertical bars (tremolo / multiphonic) ─────────────────────────
      case 'tremolo': {
        const tw = max(2, floor(s * 0.24));
        const th = floor(s * 1.2);
        noStroke();
        fill(r, g, b, a);
        rect(x - floor(s * 0.38), y, tw, th);
        rect(x + floor(s * 0.38), y, tw, th);
        // thin bridge
        fill(r, g, b, a * 0.4);
        rect(x, y - floor(th / 2) + floor(tw / 2), floor(s * 0.76) + tw, tw);
        break;
      }

      // ── Filled diamond with hollow center ─────────────────────────────────
      case 'diamond': {
        const ds = floor(s * 0.88);
        noStroke();
        fill(r, g, b, a);
        push(); translate(x, y); rotate(PI / 4);
        rect(0, 0, ds, ds);
        fill(0, 0, 0, a * 0.55);
        rect(0, 0, floor(ds * 0.4), floor(ds * 0.4));
        pop();
        break;
      }

      // ── Double arc (bracket / cluster) ────────────────────────────────────
      case 'arc': {
        noFill();
        stroke(r, g, b, a);
        strokeWeight(max(2, floor(s * 0.25)));
        arc(x, y + floor(s * 0.12), floor(s * 1.6), floor(s * 0.95), PI, TWO_PI);
        stroke(r, g, b, a * 0.45);
        strokeWeight(max(1, floor(s * 0.14)));
        arc(x, y + floor(s * 0.38), floor(s * 0.9), floor(s * 0.52), PI, TWO_PI);
        break;
      }

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

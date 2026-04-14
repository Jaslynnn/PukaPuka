// ═══════════════════════════════════════════════════════════════════════════════
//  config.js — shared constants
// ═══════════════════════════════════════════════════════════════════════════════

const NOTE_MAP = {
  a: { name: 'C4', freq: 261.63, staffPos: -6, color: [230,  85,  65] }, // coral
  s: { name: 'D4', freq: 293.66, staffPos: -5, color: [240, 155,  35] }, // mango
  d: { name: 'E4', freq: 329.63, staffPos: -4, color: [220, 210,  50] }, // sunshine
  f: { name: 'F4', freq: 349.23, staffPos: -3, color: [ 75, 185,  95] }, // palm
  g: { name: 'G4', freq: 392.00, staffPos: -2, color: [ 55, 195, 175] }, // lagoon
  h: { name: 'A4', freq: 440.00, staffPos: -1, color: [ 60, 135, 215] }, // ocean
  j: { name: 'B4', freq: 493.88, staffPos:  0, color: [145,  75, 205] }, // twilight
  k: { name: 'C5', freq: 523.25, staffPos:  1, color: [215,  65, 145] }, // hibiscus
  l: { name: 'D5', freq: 587.33, staffPos:  2, color: [240,  95, 125] }, // flamingo
};

const SCROLL_SPEED       = 1.4;   // px per frame
const STAFF_HEIGHT_RATIO = 0.28;
const STAFF_LEFT         = 95;

// Draw a cross-stitch X in a u×u cell at (px, py) on a p5.Graphics object.
function pgXStitch(pg, px, py, u) {
  const m = max(1, floor(u * 0.12));
  pg.line(px + m,     py + m,     px + u - m, py + u - m);
  pg.line(px + u - m, py + m,     px + m,     py + u - m);
}

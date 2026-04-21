// Detection
const TARGET_LABEL = 'person';
const MAX_TARGETS  = 4;
const MAX_DIST     = 400;

// Palette sampled from pukapuka.png
const PALETTE = [
  [116,   0, 184],  // slot 0: deep purple  #7400B8
  [ 83, 144, 217],  // slot 1: steel blue   #5390D9
  [ 72, 191, 227],  // slot 2: teal         #48BFE3
  [128, 255, 219],  // slot 3: mint         #80FFDB
];

// Abstract graphical notation — 
const NOTE_DEFS = [
  { name: 'A3', freq: 220.00, staffPos: -8}, // 0 on
  { name: 'B3', freq: 246.94, staffPos: -7}, // 1 space
  { name: 'C4', freq: 261.63, staffPos: -6}, // 2 on
  { name: 'D4', freq: 293.66, staffPos: -5}, // 3 space
  { name: 'E4', freq: 329.63, staffPos: -4}, // 4 on
  { name: 'F4', freq: 349.23, staffPos: -3}, // 5 space
  { name: 'G4', freq: 392.00, staffPos: -2}, // 6 on
  { name: 'A4', freq: 440.00, staffPos: -1}, // 7 space
  { name: 'B4', freq: 493.88, staffPos:  0}, // 8 on
  { name: 'C5', freq: 523.25, staffPos:  1}, // 9 space
  { name: 'D5', freq: 587.33, staffPos:  2}, // 10 on
  { name: 'E5', freq: 659.25, staffPos:  3}, // 11 space
  { name: 'F5', freq: 698.46, staffPos:  4}, // 12 on
];

// Which NOTE_DEFS indices each slot draws from.
// staffPos even = on a line; odd = in a space between lines.
// Each slot intentionally mixes both so notes spread across the full staff.
const SLOT_NOTES = [
  [0, 1, 1, 1, 1],                       // slot 0 (purple)
  [0, 1, 2, 3, 1, 7, 8, 7, 6, 5, 4],     // slot 1 (blue)  
  [7, 6, 5, 7, 6, 5, 12, 11, 11],        // slot 2 (teal)  
  [7, 8, 9, 7, 8, 9, 8, 7, 6, 5, 4],     // slot 3 (mint)  
];

const SLOT_SHAPES = ['wave', 'dots', 'target', 'cross'];

const SCROLL_SPEED       = 1.4;
const STAFF_HEIGHT_RATIO = 0.24;
const STAFF_LEFT         = 70;

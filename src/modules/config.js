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

// Abstract graphical notation — one shape per staff position
const NOTE_DEFS = [
  { name: 'C4', freq: 261.63, staffPos: -6, shape: 'bar'     },
  { name: 'D4', freq: 293.66, staffPos: -5, shape: 'ring'    },
  { name: 'E4', freq: 329.63, staffPos: -4, shape: 'tremolo' },
  { name: 'F4', freq: 349.23, staffPos: -3, shape: 'diamond' },
  { name: 'G4', freq: 392.00, staffPos: -2, shape: 'arc'     },
  { name: 'A4', freq: 440.00, staffPos: -1, shape: 'dots'    },
  { name: 'B4', freq: 493.88, staffPos:  0, shape: 'cross'   },
  { name: 'C5', freq: 523.25, staffPos:  1, shape: 'wave'    },
  { name: 'D5', freq: 587.33, staffPos:  2, shape: 'target'  },
];

// Which NOTE_DEFS indices each slot draws from.
// staffPos even = on a line; odd = in a space between lines.
// Each slot intentionally mixes both so notes spread across the full staff.
const SLOT_NOTES = [
  [0, 3, 4, 7],  // slot 0 (purple): C4(line) F4(space) G4(line) C5(space)
  [1, 2, 5, 8],  // slot 1 (blue):   D4(space) E4(line) A4(space) D5(line)
  [3, 4, 7, 8],  // slot 2 (teal):   F4(space) G4(line) C5(space) D5(line)
  [1, 2, 5, 6],  // slot 3 (mint):   D4(space) E4(line) A4(space) B4(line)
];

const SCROLL_SPEED       = 1.4;
const STAFF_HEIGHT_RATIO = 0.24;
const STAFF_LEFT         = 70;

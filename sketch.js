// ═══════════════════════════════════════════════════════════════════════════════
//  sketch.js — p5 orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

let staff, audio, tracker;
let heldNotes = {};    // key string → note instance (MushroomNote or PixelFigure)
let noteMode  = 'mushroom'; // 'mushroom' | 'figure'

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255);
  noSmooth();
  pixelDensity(1);
  rectMode(CORNER);

  staff   = new Staff();
  audio   = new AudioPlayer();
  tracker = new HandTracker(staff.staffH, height - staff.staffH);
  _positionModeButtons();

  tracker.onTouch(({ noteData }) => {
    userStartAudio().then(() => {
      audio.play(noteData.freq);
      const n = staff.addNote(noteData, noteMode);
      heldNotes['__touch__'] = n;
      setTimeout(() => {
        if (heldNotes['__touch__']) {
          heldNotes['__touch__'].finalizeStem();
          delete heldNotes['__touch__'];
        }
      }, 400);
    });
  });

  // ── Mode toggle buttons ──────────────────────────────────────────────────────
  const btnMushroom = document.getElementById('btn-mushroom');
  const btnFigure   = document.getElementById('btn-figure');

  btnMushroom.addEventListener('click', () => {
    noteMode = 'mushroom';
    btnMushroom.classList.add('active');
    btnFigure.classList.remove('active');
  });

  btnFigure.addEventListener('click', () => {
    noteMode = 'figure';
    btnFigure.classList.add('active');
    btnMushroom.classList.remove('active');
  });
}

function draw() {
  clear(); // transparent canvas — body background shows through

  // Grow stems for every currently-held key
  for (const k in heldNotes) {
    heldNotes[k].growStem();
  }

  tracker.draw();
  staff.draw();
  _drawDivider();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  staff.resize();
  heldNotes = {};
  tracker.resize(staff.staffH, height - staff.staffH);
  _positionModeButtons();
}

// ── Keyboard input ────────────────────────────────────────────────────────────

function keyPressed() {
  const k = key.toLowerCase();
  if (!NOTE_MAP[k] || heldNotes[k]) return;

  userStartAudio().then(() => {
    audio.play(NOTE_MAP[k].freq);
    heldNotes[k] = staff.addNote(NOTE_MAP[k], noteMode);
  });
}

function keyReleased() {
  const k = key.toLowerCase();
  if (heldNotes[k]) {
    heldNotes[k].finalizeStem();
    delete heldNotes[k];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _positionModeButtons() {
  document.getElementById('mode-buttons').style.top = (floor(staff.staffH) + 10) + 'px';
}

function _drawDivider() {
  noStroke();
  fill(160, 130, 80, 55);
  rectMode(CORNER);
  const y = floor(staff.staffH);
  const dashW = 8, gapW = 6;
  for (let dx = 0; dx < width; dx += dashW + gapW) {
    rect(dx, y, dashW, 1);
  }
}

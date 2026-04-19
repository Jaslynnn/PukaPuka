let detector;
let capture;
let modelReady = false;

let staff;
let audioSystem;

const slotAlpha   = [0, 0, 0, 0];  // silhouette opacity per slot, 0..1
const spawnTimers = [0, 0, 0, 0];  // countdown frames until next note per slot
const activeSlots = new Set();

let soundFiles = [];

function preload() {
  soundFiles = [
    loadSound('assets/sounds/track1.m4a'),
    loadSound('assets/sounds/track2.m4a'),
    loadSound('assets/sounds/track3.m4a'),
    loadSound('assets/sounds/track4.m4a'),
    loadSound('assets/sounds/backgroundtrack.wav'),
  ];
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  staff       = new Staff();
  audioSystem = new AudioSystem();
  audioSystem.init(soundFiles);

  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  initSegmentation();

  detector = ml5.objectDetector('cocossd', () => {
    modelReady = true;
    runDetection();
  });
}

function draw() {
  background(0);

  // Fade silhouettes in/out
  for (let i = 0; i < MAX_TARGETS; i++) {
    slotAlpha[i] = activeSlots.has(i)
      ? min(1, slotAlpha[i] + 0.05)
      : max(0, slotAlpha[i] - 0.07);
  }

  drawSilhouettes(staff.staffH, slotAlpha);
  staff.draw();
  _drawDivider();

  // Notes spawn whenever a person is in frame; proximity between people speeds up the rate.
  // Background volume scales with total proximity.
  let totalProx = 0;
  for (const s of slots) {
    const prox = avgProximityForSlot(s.id);
    totalProx += prox;

    spawnTimers[s.id]--;
    if (spawnTimers[s.id] <= 0) {
      // Base interval 55 frames (alone); shrinks to 14 at maximum proximity.
      spawnTimers[s.id] = floor(map(prox, 0, 1, 55, 14));
      _spawnNoteForSlot(s.id);
    }
  }

  if (slots.length > 0) {
    audioSystem.updateBackgroundVolume(
      map(totalProx, 0, slots.length, 0.05, 0.78)
    );
  }

  if (!modelReady) {
    noStroke();
    fill(128, 128, 200, 170);
    textFont("'Special Elite', 'Courier New', monospace");
    textSize(13);
    textAlign(CENTER, CENTER);
    text('loading model…', width / 2, height / 2);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  staff.resize();
}

// ── Detection hooks (called by detection.js) ─────────────────────────────────

function onPersonDetected(i) {
  activeSlots.add(i);
  userStartAudio().then(() => audioSystem.startPersonSound(i));
}

function onPersonLost(i) {
  activeSlots.delete(i);
  audioSystem.stopPersonSound(i);
  spawnTimers[i] = 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _spawnNoteForSlot(slotId) {
  const indices = SLOT_NOTES[slotId];
  const noteDef = NOTE_DEFS[indices[floor(random(indices.length))]];
  staff.addNote(noteDef, PALETTE[slotId], slotId);
}

function _drawDivider() {
  noStroke();
  fill(160, 160, 230, 14);
  rectMode(CORNER);
  rect(0, floor(staff.staffH), width, 1);
}

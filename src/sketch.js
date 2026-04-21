let detector;
let capture;
let modelReady = false;

let staff;
let audioSystem;

const slotAlpha        = [0, 0, 0, 0];
const nextNoteIdx      = [0, 0, 0, 0];  // index into SLOT_TIMESTAMPS per slot
const slotNoteCounters = [0, 0, 0, 0];
const activeSlots      = new Set();
let showHUD = false;

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

  // Load COCO-SSD first, then start SelfieSegmentation.
  // Both bundle TensorFlow.js; initialising them simultaneously causes a
  // TF platform overwrite that silently breaks COCO-SSD model loading.
  console.log('[setup] loading COCO-SSD model…');
  detector = ml5.objectDetector('cocossd', () => {
    console.log('[setup] COCO-SSD model ready — starting segmentation');
    modelReady = true;
    initSegmentation();
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
  _drawDivider();

  // Spawn notes first so they appear in the same frame as they're created.
  let totalProx = 0;
  for (const s of slots) {
    const prox = avgProximityForSlot(s.id);
    totalProx += prox;

    audioSystem.updateTrackVolume(s.id, prox);

    if (activeSlots.has(s.id)) {
      const pos    = audioSystem.currentTime(s.id);
      const stamps = SLOT_TIMESTAMPS[s.id];

      // Reset pointer if track looped back to start
      if (nextNoteIdx[s.id] > 0 && pos < stamps[nextNoteIdx[s.id] - 1]) {
        nextNoteIdx[s.id] = 0;
      }

      // Fire every timestamp the playhead has passed this frame
      while (nextNoteIdx[s.id] < stamps.length
             && pos >= stamps[nextNoteIdx[s.id]]) {
        _spawnNoteForSlot(s.id);
        nextNoteIdx[s.id]++;
      }
    }
  }

  // Draw staff after spawning so new notes appear this frame, not next.
  staff.draw();

  // Background is loud when no one is present; ducks down as people enter.
  const bgVol = map(activeSlots.size, 0, MAX_TARGETS, 0.85, 0.15);
  audioSystem.updateBackgroundVolume(bgVol);

  if (showHUD) _drawVolumeHUD();

  if (!modelReady) {
    noStroke();
    fill(128, 128, 200, 170);
    textFont("'Special Elite', 'Courier New', monospace");
    textSize(13);
    textAlign(CENTER, CENTER);
    text('loading model…', width / 2, height / 2);
  }
}

function keyPressed() {
  if (key === 'h') showHUD = !showHUD;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  staff.resize();
}

// ── Detection hooks (called by detection.js) ─────────────────────────────────

function onPersonDetected(i) {
  console.log(`[detection] person detected — slot ${i}`);
  activeSlots.add(i);
  userStartAudio()
    .then(() => {
      console.log(`[audio] userStartAudio resolved — starting slot ${i}`);
      audioSystem.startPersonSound(i);
    })
    .catch(err => console.error('[audio] userStartAudio failed:', err));
}

function onPersonLost(i) {
  console.log(`[detection] person lost — slot ${i}`);
  activeSlots.delete(i);
  audioSystem.stopPersonSound(i);
  nextNoteIdx[i]      = 0;
  slotNoteCounters[i] = 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _spawnNoteForSlot(slotId) {
  const indices = SLOT_NOTES[slotId];
  const i = slotNoteCounters[slotId] % indices.length; // Use counter instead of random
  
  const noteDef = { ...NOTE_DEFS[indices[i]] };        // Shallow copy
  noteDef.shape = SLOT_SHAPES[slotId];              // Slot decides the shape
  
  slotNoteCounters[slotId]++;                          // Advance counter
  staff.addNote(noteDef, PALETTE[slotId], slotId);

  console.log(`slot ${slotId} → i: ${i}, counter: ${slotNoteCounters[slotId]}, note: ${noteDef.name}`);
}

function _drawVolumeHUD() {
  const vols = audioSystem.getVolumes();

  // Log once per second so the console isn't flooded.
  if (frameCount % 60 === 0) {
    const trackStr = vols.tracks
      .map((v, i) => `track${i + 1}: ${v.toFixed(2)}`)
      .join('  |  ');
    console.log(`[volumes]  bg: ${vols.bg.toFixed(2)}  |  ${trackStr}`);
  }
  const x    = 16;
  let   y    = height - 16;
  const barW = 80;
  const barH = 6;
  const gap  = 18;

  push();
  textFont("'Special Elite', 'Courier New', monospace");
  textSize(10);
  noStroke();
  rectMode(CORNER);

  // Background track
  y -= gap;
  fill(200, 200, 200, 55);
  text('BG', x, y);
  fill(60, 60, 60, 120);
  rect(x + 22, y - barH + 2, barW, barH, 2);
  fill(200, 200, 200, 180);
  rect(x + 22, y - barH + 2, barW * constrain(vols.bg, 0, 1), barH, 2);

  // Per-person tracks (drawn bottom-up, slot 3 → 0)
  for (let i = 3; i >= 0; i--) {
    y -= gap;
    const [r, g, b] = PALETTE[i];
    const vol       = constrain(vols.tracks[i], 0, 1);
    fill(r, g, b, 80);
    text(`T${i + 1}`, x, y);
    fill(40, 40, 40, 120);
    rect(x + 22, y - barH + 2, barW, barH, 2);
    fill(r, g, b, vol > 0 ? 200 : 60);
    rect(x + 22, y - barH + 2, barW * vol, barH, 2);
  }
  pop();
}

function _drawDivider() {
  noStroke();
  fill(160, 160, 230, 14);
  rectMode(CORNER);
  rect(0, floor(staff.staffH), width, 1);
}

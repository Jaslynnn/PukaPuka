// MARK: Var
const TARGET_LABEL = "person"; // change to "person" when test with people
const COLORS = ["#48CAE4", "#F4A261", "#52B788", "#E76F51"];
const MAX_TARGETS = 4;
const MAX_DIST = 400;

let detector;
let capture;
let videoBuffer; // off-screen buffer used by the dot filter to sample pixels

let modelReady = false;
let statusMsg  = "Loading model...";

// MARK: Audio hooks
function onPersonDetected(slotIndex) {
  console.log(`Person detected in slot ${slotIndex}`);
  startTrack(slotIndex);
}

function onPersonLost(slotIndex) {
  console.log(`Person lost from slot ${slotIndex}`);
  stopTrack(slotIndex);
}

function onProximityUpdate(slotIndex) {
  updateTrackParams(slotIndex);
}

// MARK: p5
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("monospace");

  // start webcam
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  // off-screen buffer at video resolution for pixel sampling
  videoBuffer = createGraphics(640, 480);

  // loading COCO-SSD for ml5
  detector = ml5.objectDetector("cocossd", () => {
    modelReady = true;
    statusMsg  = "Model ready";
    runDetection();
  });

  // Set up Web Audio — tracks will fetch asynchronously in the background
  setupAudio();
}

function draw() {
  background(8, 22, 45);

  drawDotFilter();
  drawProximityLines();
  drawDetections();
  drawHUD();
  drawAudioHUD();

  slots.forEach((s) => {
    onProximityUpdate(s.id);
  });
}

// First click/tap satisfies the browser autoplay policy and starts the background track
function mousePressed() {
  startAudio();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  dotsInitialized = false; // rebuild particle grid for the new canvas size
}

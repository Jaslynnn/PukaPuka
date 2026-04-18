// MARK: Var
const TARGET_LABEL = "person"; // change to "person" when test with people
const COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A29BFE"];
const MAX_TARGETS = 4;
const MAX_DIST = 400;

let detector;
let capture;

let modelReady = false;
let statusMsg = "Loading model...";

// MARK: Audio hooks
function onPersonDetected(slotIndex) {
  console.log(`Person detected in slot ${slotIndex}`);
  // what to add: startSound(slotIndex);
}

function onPersonLost(slotIndex) {
  console.log(`Person lost from slot ${slotIndex}`);
  // what to add: stopSound(slotIndex);
}

function onProximityUpdate(slotIndex, proximity) {
  // what to add: setVolume(slotIndex, proximity);
}

// MARK: p5
function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("monospace");

  // start webcam
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  // loading COCO-SSD for ml5
  detector = ml5.objectDetector("cocossd", () => {
    modelReady = true;
    statusMsg = "Model ready";
    runDetection();
  });
}

function draw() {
  background(15, 15, 25);

  drawVideo();
  drawProximityLines();
  drawDetections();
  drawHUD();

  slots.forEach((s) => {
    const prox = avgProximityForSlot(s.id);
    onProximityUpdate(s.id, prox);
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

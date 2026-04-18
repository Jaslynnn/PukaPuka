// MARK: Var
const TARGET_LABEL = "person"; // change to "person" when test with people
const COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A29BFE"];
const MAX_TARGETS = 4;

let detector;
let capture;
let detections = [];
let slots = [];

let modelReady = false;
let statusMsg = "Loading model...";

// MARK: After Detection
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

function runDetection() {
  detector.detect(capture, (err, results) => {
    if (!err) {
      detections = results
        .filter((d) => d.label === TARGET_LABEL)
        .slice(0, MAX_TARGETS);

      updateSlots();
    }
    runDetection();
  });
}

function updateSlots() {
  slots.forEach((s) => (s.matched = false));

  detections.forEach((det) => {
    const cx = det.x + det.width / 2;
    const cy = det.y + det.height / 2;

    let nearest = null;
    let nearestDist = Infinity;
    slots.forEach((s) => {
      if (s.matched) return;
      const d = dist(cx, cy, s.cx, s.cy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = s;
      }
    });

    if (nearest && nearestDist < 120) {
      nearest.cx = cx;
      nearest.cy = cy;
      nearest.det = det;
      nearest.matched = true;
    } else if (slots.length < MAX_TARGETS) {
      const id = nextFreeIndex();
      slots.push({ id, cx, cy, det, matched: true });
      onPersonDetected(id);
    }
  });

  // remove unmatched slots and fire stopSound hook for each
  slots = slots.filter((s) => {
    if (!s.matched) {
      onPersonLost(s.id);
      return false;
    }
    return true;
  });
}

function nextFreeIndex() {
  const used = slots.map((s) => s.id);
  for (let i = 0; i < MAX_TARGETS; i++) {
    if (!used.includes(i)) return i;
  }
  return 0;
}

// returns average proximity (0–1) for a given slot against all others
function avgProximityForSlot(slotId) {
  const MAX_DIST = 400;
  const me = slots.find((s) => s.id === slotId);
  if (!me || slots.length < 2) return 0;

  let total = 0;
  let count = 0;
  slots.forEach((s) => {
    if (s.id === slotId) return;
    const d = dist(me.cx, me.cy, s.cx, s.cy);
    total += 1 - constrain(d / MAX_DIST, 0, 1);
    count++;
  });
  return count > 0 ? total / count : 0;
}

function draw() {
  background(15, 15, 25);

  drawVideo();
  drawProximityLines();
  drawDetections();
  drawHUD();

  slots.forEach((s) => {
    const prox = avgProximityForSlot(s.idx);
    onProximityUpdate(s.idx, prox);
  });
}

// for webcam
function drawVideo() {
  const vw = capture.width;
  const vh = capture.height;
  const scale = min(width / vw, height / vh) * 0.85;
  const dw = vw * scale;
  const dh = vh * scale;
  const ox = (width - dw) / 2;
  const oy = (height - dh) / 2;

  capture._ox = ox;
  capture._oy = oy;
  capture._scale = scale;

  tint(255, 220);
  image(capture, ox, oy, dw, dh);
  noTint();
}

function mapX(x) {
  return capture._ox + x * capture._scale;
}
function mapY(y) {
  return capture._oy + y * capture._scale;
}

function drawProximityLines() {
  if (slots.length < 2) return;

  const MAX_DIST = 400;

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      const d = dist(a.cx, a.cy, b.cx, b.cy);
      const proximity = 1 - constrain(d / MAX_DIST, 0, 1); // 1 = touching, 0 = far

      // line colour: warm when close, cool when far
      const r = lerp(60, 255, proximity);
      const g = lerp(100, 220, proximity * 0.5);
      const bl = lerp(200, 80, proximity);
      const alpha = lerp(60, 200, proximity);

      strokeWeight(map(proximity, 0, 1, 1, 4));
      stroke(r, g, bl, alpha);
      line(mapX(a.cx), mapY(a.cy), mapX(b.cx), mapY(b.cy));

      // proximity label
      const mx = (mapX(a.cx) + mapX(b.cx)) / 2;
      const my = (mapY(a.cy) + mapY(b.cy)) / 2;
      noStroke();
      fill(255, 180);
      textSize(11);
      textAlign(CENTER, CENTER);
      text(nf(proximity * 100, 1, 0) + "%", mx, my - 10);
    }
  }
}

function drawDetections() {
  slots.forEach((slot) => {
    const { id, det } = slot;
    const col = color(COLORS[id]);

    const x = mapX(det.x);
    const y = mapY(det.y);
    const w = det.width * capture._scale;
    const h = det.height * capture._scale;
    const cx = mapX(slot.cx);
    const cy = mapY(slot.cy);

    // box
    noFill();
    stroke(col);
    strokeWeight(2);
    rect(x, y, w, h, 6);

    fill(col);
    noStroke();
    circle(x, y, 8);
    circle(x + w, y, 8);
    circle(x, y + h, 8);
    circle(x + w, y + h, 8);

    const badgeW = 52;
    const badgeH = 28;
    fill(red(col), green(col), blue(col), 200);
    noStroke();
    rect(cx - badgeW / 2, y - badgeH - 8, badgeW, badgeH, 6);

    fill(255);
    textSize(15);
    textAlign(CENTER, CENTER);

    fill(200);
    textSize(10);
    text(nf(det.confidence * 100, 1, 0) + "%", cx, y + 14);

    fill(col);
    circle(cx, cy, 10);
  });
}

function drawHUD() {
  noStroke();
  fill(255, 180);
  textAlign(LEFT, TOP);
  textSize(13);

  let hudY = 16;
  hudY += 20;
  fill(modelReady ? color("#4ECDC4") : color("#FFE66D"));
  text(statusMsg, 16, hudY);
  hudY += 20;

  fill(200);
  text(
    `Detecting: "${TARGET_LABEL}"  |  Found: ${slots.length}/${MAX_TARGETS}`,
    16,
    hudY,
  );
  hudY += 20;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

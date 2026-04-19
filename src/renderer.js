
// MARK: Touch state
const TOUCH_THRESHOLD = 0.75; // proximity value (0–1) at which bodies count as "touching"
let touchAmount = 0;          // 0..1, smoothly animated

function checkTouch() {
  let touching = false;
  outer: for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const prox = 1 - constrain(
        dist(slots[i].cx, slots[i].cy, slots[j].cx, slots[j].cy) / MAX_DIST, 0, 1
      );
      if (prox > TOUCH_THRESHOLD) { touching = true; break outer; }
    }
  }
  // Lerp toward 1 when touching, toward 0 when apart
  touchAmount = lerp(touchAmount, touching ? 1 : 0, 0.08);
}

// MARK: Dot particle system
const DOT_GRID_SPACING = 12; // fixed grid resolution in canvas pixels
let dots = [];
let dotsInitialized = false;

// Smoothed values — lerped each frame so visual changes are gradual
let smoothDotRadius = 2;
let smoothEdgeForce = 0.05;

function initDots() {
  dots = [];
  for (let px = 0; px <= width; px += DOT_GRID_SPACING) {
    for (let py = 0; py <= height; py += DOT_GRID_SPACING) {
      // bx/by = home position on the grid; x/y = current drifted position
      dots.push({ bx: px, by: py, x: px, y: py, vx: 0, vy: 0 });
    }
  }
  dotsInitialized = true;
}

// Read a grayscale value from the already-loaded videoBuffer.pixels
function sampleGray(vx, vy) {
  const x = constrain(Math.round(vx), 0, capture.width  - 1);
  const y = constrain(Math.round(vy), 0, capture.height - 1);
  const i = 4 * (y * capture.width + x);
  return (videoBuffer.pixels[i] + videoBuffer.pixels[i + 1] + videoBuffer.pixels[i + 2]) / 3;
}

// MARK: Dot filter
function drawDotFilter() {
  if (!videoBuffer) return;
  if (!dotsInitialized) initDots();

  // Cover geometry — sets capture._ox / _oy / _scale so mapX/mapY stay accurate
  const scale = max(width / capture.width, height / capture.height);
  const w = capture.width  * scale;
  const h = capture.height * scale;
  capture._ox    = (width  - w) / 2;
  capture._oy    = (height - h) / 2;
  capture._scale = scale;

  checkTouch();

  // Dot radius: 0 people = tiny pinpricks, 4 people = large overlapping blobs
  const targetRadius = map(slots.length, 0, MAX_TARGETS, 2, 28);
  smoothDotRadius = lerp(smoothDotRadius, targetRadius, 0.07);
  const dotRadius = smoothDotRadius;

  // Touch tint: sunset orange so contact is unmistakable
  const TR = 255, TG = 140, TB = 60;

  // Edge physics — lower threshold catches more edges, stronger forces = wilder movement
  const EDGE_THRESHOLD = 12;   // catch faint edges too
  const RETURN_FORCE   = 0.02; // weak home pull → dots drift far from grid
  const DAMPING        = 0.78; // low damping → energy stays in the system longer

  // Edge force scales with body speed — lerped for smooth ramp
  const maxBodySpeed    = slots.reduce((m, s) => Math.max(m, s.speed || 0), 0);
  const targetEdgeForce = constrain(map(maxBodySpeed, 0, 18, 0.1, 3.0), 0.1, 3.0);
  smoothEdgeForce = lerp(smoothEdgeForce, targetEdgeForce, 0.12);
  const EDGE_FORCE = smoothEdgeForce;

  // Render video into the off-screen buffer once so pixel sampling is fast
  videoBuffer.image(capture, 0, 0, capture.width, capture.height);
  videoBuffer.loadPixels();

  noStroke();

  for (const dot of dots) {
    // ---- Physics ----
    // Map current canvas position → video space for gradient sampling
    const vx = (dot.x - capture._ox) / capture._scale;
    const vy = (dot.y - capture._oy) / capture._scale;

    // 2-px Sobel-like gradient in video space
    const S  = 2;
    const gx = sampleGray(vx + S, vy) - sampleGray(vx - S, vy);
    const gy = sampleGray(vx, vy + S) - sampleGray(vx, vy - S);
    const edgeMag = Math.sqrt(gx * gx + gy * gy);

    if (edgeMag > EDGE_THRESHOLD) {
      // Rotate gradient 90° → direction along the edge contour
      const len = edgeMag + 0.001;
      dot.vx += (-gy / len) * EDGE_FORCE;
      dot.vy += ( gx / len) * EDGE_FORCE;
    }

    // Spring back toward the home grid position
    dot.vx += (dot.bx - dot.x) * RETURN_FORCE;
    dot.vy += (dot.by - dot.y) * RETURN_FORCE;

    dot.vx *= DAMPING;
    dot.vy *= DAMPING;
    dot.x  += dot.vx;
    dot.y  += dot.vy;

    // Skip dots that have drifted fully off-screen
    if (dot.x < -dotRadius || dot.x > width  + dotRadius ||
        dot.y < -dotRadius || dot.y > height + dotRadius) continue;

    // ---- Colour ----
    // Sample the video colour at the dot's current (drifted) canvas position
    const cvx = constrain(Math.round((dot.x - capture._ox) / capture._scale), 0, capture.width  - 1);
    const cvy = constrain(Math.round((dot.y - capture._oy) / capture._scale), 0, capture.height - 1);
    const idx = 4 * (cvy * capture.width + cvx);
    const r   = videoBuffer.pixels[idx];
    const g   = videoBuffer.pixels[idx + 1];
    const b   = videoBuffer.pixels[idx + 2];

    const t = touchAmount * 0.55;
    fill(lerp(r, TR, t), lerp(g, TG, t), lerp(b, TB, t), 230);
    circle(dot.x, dot.y, dotRadius * 2);
  }
}

// MARK: Coordinate helpers (used by drawProximityLines + drawDetections)
const mapX = (x) => capture._ox + x * capture._scale;
const mapY = (y) => capture._oy + y * capture._scale;

// MARK: Proximity lines
function drawProximityLines() {
  if (slots.length < 2) return;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      const proximity = 1 - constrain(dist(a.cx, a.cy, b.cx, b.cy) / MAX_DIST, 0, 1);

      strokeWeight(map(proximity, 0, 1, 1, 4));
      // Ocean blue → warm gold as proximity increases
      stroke(lerp(30, 244, proximity), lerp(80, 196, proximity * 0.7), lerp(160, 80, proximity), lerp(60, 220, proximity));
      line(mapX(a.cx), mapY(a.cy), mapX(b.cx), mapY(b.cy));

      noStroke(); fill(255, 180); textSize(11); textAlign(CENTER, CENTER);
      text(nf(proximity * 100, 1, 0) + "%", (mapX(a.cx) + mapX(b.cx)) / 2, (mapY(a.cy) + mapY(b.cy)) / 2 - 10);
    }
  }
}

// MARK: Detection bounding boxes
function drawDetections() {
  slots.forEach(({ id, det, cx, cy }) => {
    const col = color(COLORS[id]);
    const [x, y, w, h] = [mapX(det.x), mapY(det.y), det.width * capture._scale, det.height * capture._scale];
    const [mcx, mcy] = [mapX(cx), mapY(cy)];

    // bounding box + corners
    noFill(); stroke(col); strokeWeight(2); rect(x, y, w, h, 6);
    fill(col); noStroke();
    [x, x + w].forEach((px) => [y, y + h].forEach((py) => circle(px, py, 8)));

    // badge
    fill(red(col), green(col), blue(col), 200); noStroke();
    rect(mcx - 26, y - 36, 52, 28, 6);
    fill(200); textSize(10); textAlign(CENTER, CENTER);
    text(nf(det.confidence * 100, 1, 0) + "%", mcx, y + 14);

    fill(col); circle(mcx, mcy, 10);
  });
}

// MARK: HUD
function drawHUD() {
  noStroke(); textAlign(LEFT, TOP); textSize(13);
  fill(modelReady ? color("#48CAE4") : color("#F4A261"));
  text(modelReady ? "Model ready" : "Loading model...", 16, 36);
  fill(210, 200, 175);
  text(`Detecting: "${TARGET_LABEL}"  |  Found: ${slots.length}/${MAX_TARGETS}`, 16, 56);

  // AudioContext state (helps diagnose silent-track issues)
  if (typeof audioCtx !== "undefined" && audioCtx) {
    const ctxState = audioCtx.state;
    fill(ctxState === "running" ? color("#52B788") : color("#E76F51"));
    textSize(11); textAlign(LEFT, TOP);
    text("AudioCtx: " + ctxState, 16, 76);
  }

  // Prompt until the user clicks to unlock the AudioContext
  if (typeof audioUnlocked !== "undefined" && !audioUnlocked) {
    const msg = "CLICK ANYWHERE TO START AUDIO";
    textSize(18); textAlign(CENTER, CENTER);
    // Pulsing opacity
    const pulse = map(sin(frameCount * 0.06), -1, 1, 120, 255);
    fill(244, 162, 97, pulse);
    text(msg, width / 2, height - 48);
  }
}

// MARK: Audio HUD
function fmtTime(secs) {
  if (secs === null || isNaN(secs)) return "--:--";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function drawBar(x, y, w, h, value) {
  // Background
  noStroke(); fill(20, 50, 80);
  rect(x, y, w, h, 2);
  // Filled portion
  fill(149, 213, 178);
  rect(x, y, w * constrain(value, 0, 1), h, 2);
}

function drawAudioHUD() {
  if (typeof trackInfo === "undefined") return;

  // Add an extra row when touch boost is active
  const boosting = trackInfo.some((t) => t && t.touchBoost > 1.05);
  const cardW  = 240;
  const cardH  = boosting ? 108 : 92;
  const margin = 16;
  const gap    = 10;
  const barW   = cardW - 32;
  const barH   = 5;

  // Place cards in the bottom-right corner, stacked upward
  let activeCount = trackInfo.filter(Boolean).length;
  if (activeCount === 0) return;

  let cardY = height - margin - cardH;

  for (let i = MAX_TARGETS - 1; i >= 0; i--) {
    const info = trackInfo[i];
    if (!info) continue;

    const col  = color(COLORS[i]);
    const cardX = width - margin - cardW;

    // Card background
    noStroke();
    fill(8, 22, 45, 220);
    rect(cardX, cardY, cardW, cardH, 6);

    // Coloured left accent bar
    fill(col);
    rect(cardX, cardY, 4, cardH, 3);

    // Title: track name + timestamp
    const timeStr = fmtTime(info.currentTime) + " / " + fmtTime(info.duration);
    fill(col); textSize(12); textAlign(LEFT, TOP);
    text("Track " + (i + 1), cardX + 14, cardY + 10);
    fill(160, 190, 170); textSize(11);
    text(timeStr, cardX + 14, cardY + 26);

    // Parameter bars + labels
    const labelX = cardX + 14;
    const valueX = cardX + cardW - 14;
    let rowY = cardY + 44;

    const rows = [
      { label: "Pan",   value: (info.pan + 1) / 2,       display: (info.pan >= 0 ? "+" : "") + info.pan.toFixed(2) },
      { label: "Rate",  value: (info.rate - 0.3) / 3.7,  display: info.rate.toFixed(2) + "x" },
      { label: "Vol",   value: info.vol,                  display: Math.round(info.vol * 100) + "%" },
    ];
    // Show touch boost row only when it is meaningfully active
    if (info.touchBoost > 1.05) {
      rows.push({ label: "Boost", value: (info.touchBoost - 1) / 2.0, display: info.touchBoost.toFixed(2) + "x" });
    }

    rows.forEach(({ label, value, display }) => {
      noStroke(); fill(120, 160, 140); textSize(10); textAlign(LEFT, CENTER);
      text(label, labelX, rowY);
      fill(220, 210, 180); textAlign(RIGHT, CENTER);
      text(display, valueX, rowY);
      drawBar(labelX + 28, rowY - barH / 2, barW - 28 - 36, barH, value);
      rowY += 16;
    });

    cardY -= cardH + gap;
  }
}

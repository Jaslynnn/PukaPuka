
function drawVideo() {
  const scale = min(width / capture.width, height / capture.height) * 0.85;
  capture._ox = (width  - capture.width  * scale) / 2;
  capture._oy = (height - capture.height * scale) / 2;
  capture._scale = scale;
  tint(255, 220);
  image(capture, capture._ox, capture._oy, capture.width * scale, capture.height * scale);
  noTint();
}

const mapX = (x) => capture._ox + x * capture._scale;
const mapY = (y) => capture._oy + y * capture._scale;

function drawProximityLines() {
  if (slots.length < 2) return;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      const proximity = 1 - constrain(dist(a.cx, a.cy, b.cx, b.cy) / MAX_DIST, 0, 1);

      strokeWeight(map(proximity, 0, 1, 1, 4));
      stroke(lerp(60, 255, proximity), lerp(100, 220, proximity * 0.5), lerp(200, 80, proximity), lerp(60, 200, proximity));
      line(mapX(a.cx), mapY(a.cy), mapX(b.cx), mapY(b.cy));

      noStroke(); fill(255, 180); textSize(11); textAlign(CENTER, CENTER);
      text(nf(proximity * 100, 1, 0) + "%", (mapX(a.cx) + mapX(b.cx)) / 2, (mapY(a.cy) + mapY(b.cy)) / 2 - 10);
    }
  }
}

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

function drawHUD() {
  noStroke(); textAlign(LEFT, TOP); textSize(13);
  fill(modelReady ? color("#4ECDC4") : color("#FFE66D"));
  text(modelReady ? "Model ready" : "Loading model...", 16, 36);
  fill(200);
  text(`Detecting: "${TARGET_LABEL}"  |  Found: ${slots.length}/${MAX_TARGETS}`, 16, 56);
}

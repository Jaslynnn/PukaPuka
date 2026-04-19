
let detections = [];
let slots = [];

function runDetection() {
  // Wait for the webcam stream to have actual frame data before handing it to ml5
  if (!capture || capture.elt.readyState < 2) {
    capture.elt.addEventListener("loadeddata", runDetection, { once: true });
    return;
  }

  detector.detect(capture, (err, results) => {
    if (!err) {
      detections = results.filter((d) => d.label === TARGET_LABEL).slice(0, MAX_TARGETS);
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
    const nearest = nearestUnmatched(cx, cy);

    if (nearest) {
      // Compute velocity as displacement since the last detection update
      const velX  = cx - nearest.cx;
      const velY  = cy - nearest.cy;
      const speed = Math.sqrt(velX * velX + velY * velY);
      Object.assign(nearest, { cx, cy, det, matched: true, velX, velY, speed });
    } else if (slots.length < MAX_TARGETS) {
      const id = nextFreeIndex();
      slots.push({ id, cx, cy, det, matched: true, velX: 0, velY: 0, speed: 0 });
      onPersonDetected(id);
    }
  });

  slots = slots.filter((s) => {
    if (!s.matched) { onPersonLost(s.id); return false; }
    return true;
  });
}

function nearestUnmatched(cx, cy) {
  let nearest = null, nearestDist = Infinity;
  slots.forEach((s) => {
    if (s.matched) return;
    const d = dist(cx, cy, s.cx, s.cy);
    if (d < nearestDist && d < 120) { nearestDist = d; nearest = s; }
  });
  return nearest;
}

function nextFreeIndex() {
  const used = slots.map((s) => s.id);
  for (let i = 0; i < MAX_TARGETS; i++) if (!used.includes(i)) return i;
  return 0;
}

function avgProximityForSlot(id) {
  const me = slots.find((s) => s.id === id);
  if (!me || slots.length < 2) return 0;
  const others = slots.filter((s) => s.id !== id);
  const total = others.reduce((sum, s) => {
    return sum + (1 - constrain(dist(me.cx, me.cy, s.cx, s.cy) / MAX_DIST, 0, 1));
  }, 0);
  return total / others.length;
}

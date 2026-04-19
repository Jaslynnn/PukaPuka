
let detections = [];
let slots      = [];

// How many consecutive missed detections before a slot is dropped.
// COCO-SSD runs at ~10 fps; 25 misses ≈ 2.5 s of tolerance.
const MISS_GRACE = 25;

function runDetection() {
  if (!capture || !capture.elt || capture.elt.readyState < 2) {
    setTimeout(runDetection, 250);
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
    const cx      = det.x + det.width  / 2;
    const cy      = det.y + det.height / 2;
    const nearest = nearestUnmatched(cx, cy);

    if (nearest) {
      Object.assign(nearest, { cx, cy, det, matched: true, missed: 0 });
    } else if (slots.length < MAX_TARGETS) {
      const id = nextFreeIndex();
      slots.push({ id, cx, cy, det, matched: true, missed: 0 });
      onPersonDetected(id);
    }
  });

  // Increment miss counter for unmatched slots; only drop after grace period.
  slots.forEach((s) => {
    if (!s.matched) s.missed = (s.missed || 0) + 1;
  });

  slots = slots.filter((s) => {
    if (s.missed >= MISS_GRACE) { onPersonLost(s.id); return false; }
    return true;
  });
}

function nearestUnmatched(cx, cy) {
  let nearest = null, nearestDist = Infinity;
  slots.forEach((s) => {
    if (s.matched) return;
    const d = dist(cx, cy, s.cx, s.cy);
    if (d < nearestDist && d < 220) { nearestDist = d; nearest = s; }
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
  const total  = others.reduce((sum, s) => {
    return sum + (1 - constrain(dist(me.cx, me.cy, s.cx, s.cy) / MAX_DIST, 0, 1));
  }, 0);
  return total / others.length;
}

// Draws a body-shaped blurry glow for each detected person slot.
//
// How it works:
//   1. MediaPipe SelfieSegmentation produces a per-frame mask where person
//      pixels are opaque and background is transparent (alpha channel encodes
//      confidence).
//   2. For each slot we paint the slot colour onto an offscreen canvas, then
//      apply destination-in with the segmentation mask — this clips the colour
//      fill to the exact person silhouette.
//   3. We draw that person-shaped colour patch onto the main canvas with a CSS
//      blur filter, giving a soft glowing outline that follows the real body.

let _silScale, _silOX, _silOY;
let _seg = null, _segMask = null, _segReady = false, _segBusy = false;
let _offscreen = null;

function initSegmentation() {
  const VERSION = '0.1.1675465747';
  _seg = new SelfieSegmentation({
    locateFile: f =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@${VERSION}/${f}`,
  });
  _seg.setOptions({ modelSelection: 1 }); // 1 = landscape (better for full body)
  _seg.onResults(r => { _segMask = r.segmentationMask; _segBusy = false; });
  _seg.initialize().then(() => { _segReady = true; });
}

function _sendSegFrame() {
  if (frameCount % 2 !== 0) return; // cap at ~30 fps
  if (!_segReady || _segBusy || !capture?.elt || capture.elt.readyState < 2) return;
  _segBusy = true;
  _seg.send({ image: capture.elt }).catch(() => { _segBusy = false; });
}

function _updateSilMetrics(staffH) {
  const scaleX = width  / 640;
  const scaleY = (height - staffH) / 480;
  _silScale    = max(scaleX, scaleY);
  _silOX       = (width - 640 * _silScale) / 2;
  _silOY       = staffH + ((height - staffH) - 480 * _silScale) / 2;
}

function _silX(x) { return _silOX + (640 - x) * _silScale; } // mirrored
function _silY(y) { return _silOY + y          * _silScale; }

function drawSilhouettes(staffH, alphas) {
  _updateSilMetrics(staffH);
  _sendSegFrame();
  if (!_segMask) return;

  // Lazily create / resize offscreen canvas used to isolate each person.
  if (!_offscreen || _offscreen.width !== width || _offscreen.height !== height) {
    _offscreen        = document.createElement('canvas');
    _offscreen.width  = width;
    _offscreen.height = height;
  }
  const oc  = _offscreen;
  const oct = oc.getContext('2d');
  const ctx = drawingContext;

  // Mask may not be exactly 640×480 — read its actual size.
  const mW = _segMask.width  || 640;
  const mH = _segMask.height || 480;

  slots.forEach(({ id, det }) => {
    const alpha = alphas[id] || 0;
    if (alpha <= 0.01) return;

    const [r, g, b] = PALETTE[id];

    // Destination rectangle on canvas (bounding box, mirrored on x).
    const canW    = det.width  * _silScale;
    const canH    = det.height * _silScale;
    const canLeft = _silX(det.x + det.width); // right video edge → left canvas edge
    const canTop  = _silY(det.y);

    // Corresponding source region inside the segmentation mask.
    const mSrcX = (det.x       / 640) * mW;
    const mSrcY = (det.y       / 480) * mH;
    const mSrcW = (det.width   / 640) * mW;
    const mSrcH = (det.height  / 480) * mH;

    // ── Build person-shaped colour patch on offscreen ─────────────────────────
    oct.clearRect(0, 0, oc.width, oc.height);
    oct.globalCompositeOperation = 'source-over';
    oct.globalAlpha = 1;

    // 1. Fill bounding box with slot colour.
    oct.fillStyle = `rgb(${r},${g},${b})`;
    oct.fillRect(canLeft, canTop, canW, canH);

    // 2. destination-in with the mask: keep colour only where person is opaque.
    oct.globalCompositeOperation = 'destination-in';
    oct.save();
    oct.translate(canLeft + canW, canTop); // set up horizontal mirror
    oct.scale(-1, 1);
    oct.drawImage(_segMask, mSrcX, mSrcY, mSrcW, mSrcH, 0, 0, canW, canH);
    oct.restore();
    oct.globalCompositeOperation = 'source-over';

    // ── Composite blurred silhouette onto main canvas ─────────────────────────
    // The blur spreads the person-shaped colour patch into a soft glow that
    // follows the real body outline without a hard rectangular edge.
    ctx.save();
    ctx.filter      = `blur(22px)`;
    ctx.globalAlpha = alpha;
    ctx.drawImage(oc, 0, 0);
    ctx.restore();
  });
}

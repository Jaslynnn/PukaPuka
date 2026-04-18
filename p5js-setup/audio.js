// MARK: Audio (Web Audio API via MediaElementSource — no fetch, works from file://)
let audioCtx  = null;
let bgAudio   = null;
let audioUnlocked = false; // true once the AudioContext has been resumed by a user gesture

// Audio elements for tracks 1–4 (created once, reused)
const trackAudios     = [];
const trackGains      = [];
const trackPanners    = [];
// Intent flags — true means "this slot should be playing"
// Set by startTrack even before the context is unlocked so startAudio can replay them
const trackShouldPlay = [false, false, false, false];

// Called from setup()
function setupAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Background: stream via HTML5 Audio (46 MB WAV, never fully buffered)
  bgAudio        = new Audio("sounds/backgroundtrack.wav");
  bgAudio.loop   = true;
  bgAudio.volume = 0.9;

  for (let i = 0; i < 4; i++) {
    const audio = new Audio("sounds/track" + (i + 1) + ".m4a");
    audio.loop = true;

    const source = audioCtx.createMediaElementSource(audio);
    const panner = audioCtx.createStereoPanner();
    const gain   = audioCtx.createGain();

    gain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    panner.pan.setValueAtTime(0,  audioCtx.currentTime);

    source.connect(panner);
    panner.connect(gain);
    gain.connect(audioCtx.destination);

    trackAudios.push(audio);
    trackGains.push(gain);
    trackPanners.push(panner);
  }
}

// MARK: Internal — actually triggers play once the context is confirmed running
function _playTrack(slotId) {
  if (!trackShouldPlay[slotId]) return;
  const audio = trackAudios[slotId];
  const gain  = trackGains[slotId];

  gain.gain.cancelScheduledValues(audioCtx.currentTime);
  gain.gain.setValueAtTime(1.0, audioCtx.currentTime);

  console.log(`[audio] playing track${slotId + 1}.m4a  (slot ${slotId})  ctx state: ${audioCtx.state}`);
  audio.play().catch((e) => {
    console.warn(`[audio] track${slotId + 1} play failed (${e.name}):`, e.message);
  });
}

// Called on click/tap — the only place that resumes the AudioContext
function startAudio() {
  if (!audioCtx) return;
  audioCtx.resume().then(() => {
    audioUnlocked = true;

    // Start the background track
    if (bgAudio && bgAudio.paused) {
      bgAudio.play().catch((e) => console.warn("bgTrack play failed:", e));
    }

    // Start any tracks that were detected before the context was unlocked
    for (let i = 0; i < 4; i++) {
      if (trackShouldPlay[i] && trackAudios[i] && trackAudios[i].paused) {
        _playTrack(i);
      }
    }
  });
}

// MARK: Per-person track control
function startTrack(slotId) {
  if (slotId < 0 || slotId > 3 || !audioCtx) return;
  const audio = trackAudios[slotId];
  if (!audio) return;

  trackShouldPlay[slotId] = true;
  audio.currentTime = 0;

  console.log(`[audio] startTrack slot=${slotId} file=track${slotId + 1}.m4a  unlocked=${audioUnlocked}`);

  if (audioUnlocked) {
    _playTrack(slotId);
  }
  // If not yet unlocked, startAudio() will pick this up when the user clicks
}

function stopTrack(slotId) {
  if (slotId < 0 || slotId > 3) return;
  const audio = trackAudios[slotId];
  if (!audio) return;

  trackShouldPlay[slotId] = false;

  if (audioCtx && trackGains[slotId]) {
    const gain = trackGains[slotId];
    gain.gain.cancelScheduledValues(audioCtx.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
  }

  setTimeout(() => {
    if (trackShouldPlay[slotId]) return;
    audio.pause();
    audio.currentTime = 0;
    trackInfo[slotId] = null;
  }, 500);
}

// Snapshot of each track's current parameters — read by the audio HUD in renderer.js
const trackInfo = [null, null, null, null];

// MARK: Per-frame parameter modulation
function updateTrackParams(slotId) {
  if (slotId < 0 || slotId > 3 || !audioCtx) return;
  const audio = trackAudios[slotId];
  if (!audio || audio.paused) {
    trackInfo[slotId] = null;
    return;
  }

  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return;

  const now = audioCtx.currentTime;

  // Pan
  const pan = constrain(map(slot.cx, 0, 640, -1, 1), -1, 1);
  trackPanners[slotId].pan.linearRampToValueAtTime(pan, now + 0.1);

  // Pitch: body speed → rate, plus touch boost
  const bodySpeed  = slot.speed || 0;
  const baseRate   = constrain(map(bodySpeed, 0, 18, 0.4, 3.2), 0.3, 3.5);
  const touchBoost = 1 + (typeof touchAmount !== "undefined" ? touchAmount : 0) * 3.5;
  const targetRate = constrain(baseRate * touchBoost, 0.3, 5.0);
  audio.playbackRate = lerp(audio.playbackRate, targetRate, 0.12);
  const rate = audio.playbackRate;

  // Volume: bounding box area as camera-distance proxy
  const area = slot.det.width * slot.det.height;
  const vol  = constrain(map(area, 1500, 60000, 0.05, 1.0), 0.02, 1.0);
  trackGains[slotId].gain.linearRampToValueAtTime(vol, now + 0.15);

  trackInfo[slotId] = {
    pan,
    rate,
    vol,
    touchBoost,
    currentTime: audio.currentTime,
    duration:    isFinite(audio.duration) ? audio.duration : null,
  };
}

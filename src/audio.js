// MARK: Audio (Web Audio API via MediaElementSource — no fetch, works from file://)
let audioCtx  = null;
let bgAudio   = null;
let audioUnlocked = false; // true once the AudioContext has been created by a user gesture

// Audio elements for tracks 1–4 (created once, reused)
const trackAudios     = [];
const trackGains      = [];
const trackPanners    = [];
// Intent flags — true means "this slot should be playing"
// Set by startTrack even before the context exists so startAudio can replay them
const trackShouldPlay = [false, false, false, false];

// Called from setup() — creates audio elements only, NOT the AudioContext
function setupAudio() {
  // Background: stream via HTML5 Audio (46 MB WAV, never fully buffered)
  bgAudio        = new Audio("sounds/backgroundtrack.wav");
  bgAudio.loop   = true;
  bgAudio.volume = 0.9;

  for (let i = 0; i < 4; i++) {
    const audio = new Audio("sounds/track" + (i + 1) + ".m4a");
    audio.loop = true;
    trackAudios.push(audio);
  }
}

// MARK: Internal — builds the Web Audio graph (called once, inside the click handler)
function _initAudioContext() {
  // Creating AudioContext inside a user-gesture callback gives a 'running' context
  // immediately — no resume() needed, which is why tracks were silent before
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  for (let i = 0; i < 4; i++) {
    const audio  = trackAudios[i];
    const source = audioCtx.createMediaElementSource(audio);
    const panner = audioCtx.createStereoPanner();
    const gain   = audioCtx.createGain();

    gain.gain.setValueAtTime(1.0, audioCtx.currentTime);
    panner.pan.setValueAtTime(0,  audioCtx.currentTime);

    source.connect(panner);
    panner.connect(gain);
    gain.connect(audioCtx.destination);

    trackGains.push(gain);
    trackPanners.push(panner);
  }

  console.log(`[audio] AudioContext created, state: ${audioCtx.state}`);
}

// MARK: Internal — actually triggers play once the context is confirmed running
function _playTrack(slotId) {
  if (!trackShouldPlay[slotId]) return;
  if (!audioCtx || !trackGains[slotId]) return;
  const audio = trackAudios[slotId];
  const gain  = trackGains[slotId];

  // Fade in from silence over 0.6 s so entry isn't jarring
  gain.gain.cancelScheduledValues(audioCtx.currentTime);
  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + 0.6);

  console.log(`[audio] playing track${slotId + 1}.m4a  (slot ${slotId})  ctx state: ${audioCtx.state}`);
  audio.play().catch((e) => {
    console.warn(`[audio] track${slotId + 1} play failed (${e.name}):`, e.message);
  });
}

// Called on click/tap — the only place that creates the AudioContext
function startAudio() {
  if (audioUnlocked) return; // already initialised, nothing to do

  _initAudioContext(); // AudioContext starts 'running' because we're inside a gesture
  audioUnlocked = true;

  // Start the background track
  if (bgAudio && bgAudio.paused) {
    bgAudio.play().catch((e) => console.warn("bgTrack play failed:", e));
  }

  // Start any tracks that were detected before the user clicked
  for (let i = 0; i < 4; i++) {
    if (trackShouldPlay[i]) {
      _playTrack(i);
    }
  }
}

// MARK: Per-person track control
function startTrack(slotId) {
  if (slotId < 0 || slotId > 3) return;
  const audio = trackAudios[slotId];
  if (!audio) return;

  trackShouldPlay[slotId] = true;
  // Only reset position if audio has loaded enough to seek
  if (audio.readyState >= 1) audio.currentTime = 0;

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
  const touchBoost = 1 + (typeof touchAmount !== "undefined" ? touchAmount : 0) * 0.4;
  const targetRate = constrain(baseRate * touchBoost, 0.3, 5.0);
  audio.playbackRate = lerp(audio.playbackRate, targetRate, 0.12);
  const rate = audio.playbackRate;

  // Volume: bounding box area → camera distance proxy.
  // Gate on audio.currentTime so the fade-in ramp plays out undisturbed.
  const FADE_IN_SECS = 0.7;
  const area = slot.det.width * slot.det.height;
  const vol  = constrain(map(area, 5000, 150000, 0.2, 1.0), 0.15, 1.0);

  if (audio.currentTime > FADE_IN_SECS) {
    trackGains[slotId].gain.cancelScheduledValues(now);
    trackGains[slotId].gain.setValueAtTime(trackGains[slotId].gain.value, now);
    trackGains[slotId].gain.linearRampToValueAtTime(vol, now + 0.3);
  }

  trackInfo[slotId] = {
    pan,
    rate,
    vol,
    touchBoost,
    currentTime: audio.currentTime,
    duration:    isFinite(audio.duration) ? audio.duration : null,
  };
}

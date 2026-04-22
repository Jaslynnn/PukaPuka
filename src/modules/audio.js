// Manages four per-person looping tracks (track1–4.m4a) and one background
// ambient track (backgroundtrack.wav).
//
// Onset detection: each track is monitored by a p5.Amplitude analyser.
// A "fast" envelope (short smoothing) and a "slow" envelope (long smoothing)
// are compared each frame. When fast - slow > ONSET_THRESHOLD the level has
// risen sharply — that is a note onset. A per-track cooldown prevents the
// same transient triggering multiple notes.
//
// p5.sound v1.9.4 API:
//   p5.SoundFile  .loop() .stop() .amp(v) .isPlaying()
//   p5.Amplitude  .setInput(src) .getLevel()

const ONSET_THRESHOLD = 0.04;  // amplitude rise needed to count as a note
const ONSET_COOLDOWN  = 120;   // ms minimum between consecutive onsets per track

class AudioSystem {
  constructor() {
    this._tracks    = [];
    this._bg        = null;
    this._bgStarted = false;
    this._bgVol     = 0;
    this._trackVols = [0, 0, 0, 0];

    // Onset detection state per track
    this._amps      = [];   // p5.Amplitude analysers
    this._fast      = [0, 0, 0, 0];   // fast-responding envelope
    this._slow      = [0, 0, 0, 0];   // slow-responding envelope
    this._lastOnset = [0, 0, 0, 0];   // timestamp of last onset (ms)
  }

  // soundFiles: [track1, track2, track3, track4, background]
  init(soundFiles) {
    this._tracks = soundFiles.slice(0, 4);
    this._bg     = soundFiles[4] || null;

    // Create one amplitude analyser per track
    this._amps = this._tracks.map(t => {
      const a = new p5.Amplitude();
      if (t) a.setInput(t);
      return a;
    });
  }

  // Must be called only after userStartAudio() has resolved.
  startPersonSound(i) {
    if (!this._bgStarted && this._bg) {
      this._bg.loop();
      this._bg.amp(0.85);
      this._bgVol     = 0.85;
      this._bgStarted = true;
      console.log('[audio] background track started');
    }
    const t = this._tracks[i];
    if (t && !t.isPlaying()) {
      t.loop();
      t.amp(0.65);
      this._trackVols[i] = 0.65;
      // Reset onset state so stale envelopes don't fire immediately
      this._fast[i]      = 0;
      this._slow[i]      = 0;
      this._lastOnset[i] = 0;
      console.log(`[audio] track${i + 1} started`);
    }
  }

  stopPersonSound(i) {
    const t = this._tracks[i];
    if (t && t.isPlaying()) {
      t.stop();
      this._trackVols[i] = 0;
      console.log(`[audio] track${i + 1} stopped`);
    }
  }

  // level: 0..1 — only amplitude is changed, never rate/pitch
  updateBackgroundVolume(level) {
    if (!this._bgStarted) return;
    if (this._bg) {
      const v = constrain(level, 0.0, 1.0);
      this._bg.amp(v);
      this._bgVol = v;
    }
  }

  // Adjusts a per-person track volume based on proximity (0..1).
  updateTrackVolume(i, proximity) {
    const t = this._tracks[i];
    if (!t || !t.isPlaying()) return;
    const v = map(pow(proximity, 0.5), 0, 1, 0.3, 0.95);
    t.amp(v);
    this._trackVols[i] = v;
  }

  // Call once per draw frame. Returns an array of slot indices that had an
  // onset this frame, so the caller can spawn visual notes.
  checkOnsets() {
    const triggered = [];
    const now = performance.now();

    for (let i = 0; i < 4; i++) {
      const t = this._tracks[i];
      if (!t || !t.isPlaying() || !this._amps[i]) continue;

      const level = this._amps[i].getLevel();

      // Two-envelope onset detector:
      // fast follows amplitude quickly; slow follows it lazily.
      // A large (fast - slow) gap means the signal just rose sharply.
      this._fast[i] = level * 0.6 + this._fast[i] * 0.4;
      this._slow[i] = level * 0.1 + this._slow[i] * 0.9;

      const rise = this._fast[i] - this._slow[i];

      if (rise > ONSET_THRESHOLD && now - this._lastOnset[i] > ONSET_COOLDOWN) {
        this._lastOnset[i] = now;
        triggered.push(i);
      }
    }

    return triggered;
  }

  // Current playback position in seconds for a given slot's track.
  currentTime(i) {
    const t = this._tracks[i];
    return (t && t.isPlaying()) ? t.currentTime() : 0;
  }

  // Returns last-set volumes for debug display.
  getVolumes() {
    return { bg: this._bgVol, tracks: [...this._trackVols] };
  }
}

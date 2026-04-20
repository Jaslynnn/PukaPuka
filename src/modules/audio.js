// Manages four per-person looping tracks (track1–4.m4a) and one background
// ambient track (backgroundtrack.wav). Background volume scales with proximity;
// pitch is never altered.
//
// p5.sound v1.9.4 API used:
//   p5.SoundFile  .loop()   — start looping playback
//                 .stop()   — stop playback
//                 .amp(v)   — set amplitude 0..1  (NOT setVolume)
//                 .isPlaying() — playback state

class AudioSystem {
  constructor() {
    this._tracks    = [];
    this._bg        = null;
    this._bgStarted = false;
    this._bgVol     = 0;
    this._trackVols = [0, 0, 0, 0];
  }

  // soundFiles: [track1, track2, track3, track4, background]
  // Call after preload() has finished.
  init(soundFiles) {
    this._tracks = soundFiles.slice(0, 4);
    this._bg     = soundFiles[4] || null;
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
      const v    = constrain(level, 0.0, 1.0);
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

  // Returns last-set volumes for debug display.
  getVolumes() {
    return { bg: this._bgVol, tracks: [...this._trackVols] };
  }
}

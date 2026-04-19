// Manages four per-person looping tracks (track1–4.m4a) and one background
// ambient track (backgroundtrack.wav). Background volume scales with proximity;
// pitch is never altered.

class AudioSystem {
  constructor() {
    this._tracks    = [];
    this._bg        = null;
    this._bgStarted = false;
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
      this._bg.setLoop(true);
      this._bg.setVolume(0.08);
      this._bg.play();
      this._bgStarted = true;
    }
    const t = this._tracks[i];
    if (t && !t.isPlaying()) {
      t.setLoop(true);
      t.setVolume(0.65);
      t.play();
    }
  }

  stopPersonSound(i) {
    const t = this._tracks[i];
    if (t && t.isPlaying()) t.stop();
  }

  // level: 0..1 — only volume is changed, never rate/pitch
  updateBackgroundVolume(level) {
    if (this._bg && this._bgStarted) {
      this._bg.setVolume(constrain(level, 0.03, 0.85));
    }
  }
}

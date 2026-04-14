// ═══════════════════════════════════════════════════════════════════════════════
//  audio.js — AudioPlayer
//  Wraps a p5.sound sine oscillator and ADSR envelope.
//  Monophonic: each play() re-triggers the envelope on the same oscillator.
// ═══════════════════════════════════════════════════════════════════════════════

class AudioPlayer {
  constructor() {
    this._osc = new p5.Oscillator('sine');
    this._osc.start();
    this._osc.amp(0);

    this._env = new p5.Envelope();
    this._env.setADSR(0.02, 0.5, 0.25, 1.2); // attack, decay, sustainRatio, release (s)
    this._env.setRange(0.45, 0);              // peak amp, floor amp
  }

  // Play a note at the given frequency (Hz).
  // Call userStartAudio() before the first invocation (browser requirement).
  play(freq) {
    this._osc.freq(freq);
    this._env.play(this._osc);
  }
}

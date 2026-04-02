/**
 * SynthAudioSystem — Procedural cyberpunk synth sounds via Web Audio API.
 *
 * Generates relaxing, evolving tones when the player collects notes.
 * Uses a pentatonic minor scale that cycles through different octaves
 * and adds lush reverb/delay for an ambient cyberpunk feel.
 *
 * No audio files needed — everything is synthesized in real-time.
 */
export class SynthAudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;

  private muted = false;
  private noteIndex = 0;
  private initialized = false;

  /**
   * Pentatonic minor scale frequencies (C4 pentatonic minor base).
   * Relaxing, no dissonance — every combination sounds pleasant.
   * Extended across 2 octaves for gentle melodic variation.
   */
  private readonly SCALE: number[] = [
    // Octave 3 (low, warm)
    261.63, // C4
    311.13, // Eb4
    349.23, // F4
    392.0, // G4
    466.16, // Bb4
    // Octave 4 (mid, bright)
    523.25, // C5
    622.25, // Eb5
    698.46, // F5
    783.99, // G5
    932.33, // Bb5
    // Resolve back down
    783.99, // G5
    698.46, // F5
    622.25, // Eb5
    523.25, // C5
    466.16, // Bb4
    392.0, // G4
  ];

  /* ── Initialization (lazy, on first user gesture) ── */

  private ensureContext(): boolean {
    if (this.initialized && this.ctx) return true;

    try {
      const AC =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return false;

      this.ctx = new AC();
      this.buildGraph();
      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  private buildGraph(): void {
    const ctx = this.ctx!;

    // Master volume
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(ctx.destination);

    // Low-pass filter for warmth
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.value = 2800;
    this.filterNode.Q.value = 1.2;
    this.filterNode.connect(this.masterGain);

    // Delay (ping-pong feel)
    this.delayNode = ctx.createDelay(1.0);
    this.delayNode.delayTime.value = 0.375; // dotted eighth
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.3;
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(this.filterNode);

    // Reverb (synthetic impulse response)
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.createReverbIR(ctx, 2.2, 3.0);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.35;
    this.convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.filterNode);
  }

  /**
   * Generate a synthetic reverb impulse response.
   * Creates a smooth, spacious tail perfect for ambient cyberpunk.
   */
  private createReverbIR(
    ctx: AudioContext,
    duration: number,
    decay: number,
  ): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const buffer = ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Exponential decay with random noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    return buffer;
  }

  /* ── Public API ──────────────────────────────────── */

  /**
   * Pre-build the audio graph (context + reverb IR).
   * Call this during scene create() so the heavy reverb
   * generation doesn't stutter the first note collection.
   */
  init(): void {
    this.ensureContext();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.35;
    }
  }

  /**
   * Play a cyberpunk synth tone for note collection.
   * Each call advances through the pentatonic scale,
   * creating a gentle evolving melody as notes are collected.
   */
  playNoteCollect(): void {
    if (this.muted) return;
    if (!this.ensureContext()) return;

    const ctx = this.ctx!;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const freq = this.SCALE[this.noteIndex % this.SCALE.length];
    this.noteIndex++;

    // ── Layer 1: Main pad tone (triangle + slight detune) ──
    this.playPadLayer(ctx, now, freq, 0);
    this.playPadLayer(ctx, now, freq * 1.003, -0.3); // slight detune L
    this.playPadLayer(ctx, now, freq * 0.997, 0.3); // slight detune R

    // ── Layer 2: Shimmer overtone (sine, octave up, quiet) ──
    this.playShimmer(ctx, now, freq * 2);

    // ── Layer 3: Sub bass (sine, octave down, subtle) ──
    this.playSub(ctx, now, freq / 2);
  }

  /**
   * Play a short "chime" variation — used for special events if needed.
   */
  playChime(): void {
    if (this.muted) return;
    if (!this.ensureContext()) return;

    const ctx = this.ctx!;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const freq = this.SCALE[this.noteIndex % this.SCALE.length];

    // Quick bright arpeggio
    for (let i = 0; i < 3; i++) {
      const f = this.SCALE[(this.noteIndex + i * 2) % this.SCALE.length];
      this.playPadLayer(ctx, now + i * 0.08, f, 0);
    }
    this.noteIndex += 3;
  }

  /* ── Internal sound layers ──────────────────────── */

  private playPadLayer(
    ctx: AudioContext,
    startTime: number,
    freq: number,
    pan: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, startTime);
    // Gentle pitch drift up for "shimmer"
    osc.frequency.linearRampToValueAtTime(freq * 1.01, startTime + 0.4);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.22, startTime + 0.04); // fast attack
    env.gain.exponentialRampToValueAtTime(0.12, startTime + 0.15); // sustain
    env.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8); // release

    // Stereo panning
    let panNode: StereoPannerNode | null = null;
    if (pan !== 0 && ctx.createStereoPanner) {
      panNode = ctx.createStereoPanner();
      panNode.pan.value = pan;
    }

    // Route: osc → env → pan → filter + delay + reverb
    osc.connect(env);
    const output = panNode ? (env.connect(panNode), panNode) : env;

    output.connect(this.filterNode!);
    output.connect(this.delayNode!);
    output.connect(this.convolver!);

    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
      if (panNode) panNode.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + 0.85);
  }

  private playShimmer(
    ctx: AudioContext,
    startTime: number,
    freq: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.07, startTime + 0.05);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);

    osc.connect(env);
    env.connect(this.filterNode!);
    env.connect(this.convolver!);

    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + 1.05);
  }

  private playSub(ctx: AudioContext, startTime: number, freq: number): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = Math.max(freq, 80); // minimum 80 Hz

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.15, startTime + 0.03);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

    osc.connect(env);
    env.connect(this.masterGain!); // Sub goes direct (no reverb/delay)

    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + 0.55);
  }

  /* ── Countdown sounds ───────────────────────────── */

  /**
   * Short ascending beep for countdown numbers (3, 2, 1).
   * Higher pitch each step to build anticipation.
   */
  playCountdownTick(step: number): void {
    if (this.muted) return;
    if (!this.ensureContext()) return;

    const ctx = this.ctx!;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    // Ascending pitch: 3→440Hz, 2→554Hz, 1→659Hz
    const freqs = [440, 554.37, 659.25];
    const freq = freqs[Math.min(step, freqs.length - 1)];

    // Clean sine beep
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.3, now + 0.015);
    env.gain.exponentialRampToValueAtTime(0.08, now + 0.12);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(env);
    env.connect(this.masterGain!);

    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
    osc.start(now);
    osc.stop(now + 0.4);
  }

  /**
   * Bright rising "GO!" sound — chord burst with shimmer.
   */
  playCountdownGo(): void {
    if (this.muted) return;
    if (!this.ensureContext()) return;

    const ctx = this.ctx!;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    // Major chord burst: C5-E5-G5
    const goFreqs = [523.25, 659.25, 783.99];

    for (let i = 0; i < goFreqs.length; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(goFreqs[i], now);
      osc.frequency.linearRampToValueAtTime(goFreqs[i] * 1.02, now + 0.15);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.18, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.06, now + 0.2);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(env);
      env.connect(this.filterNode!);
      env.connect(this.convolver!);

      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
      osc.start(now + i * 0.02);
      osc.stop(now + 0.65);
    }

    // High shimmer sweep
    const sweep = ctx.createOscillator();
    sweep.type = "sine";
    sweep.frequency.setValueAtTime(1200, now);
    sweep.frequency.exponentialRampToValueAtTime(2400, now + 0.15);

    const sEnv = ctx.createGain();
    sEnv.gain.setValueAtTime(0, now);
    sEnv.gain.linearRampToValueAtTime(0.08, now + 0.03);
    sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    sweep.connect(sEnv);
    sEnv.connect(this.masterGain!);

    sweep.onended = () => {
      sweep.disconnect();
      sEnv.disconnect();
    };
    sweep.start(now);
    sweep.stop(now + 0.45);
  }

  /* ── Cleanup ────────────────────────────────────── */

  destroy(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.initialized = false;
  }
}

"use client";

import type { SoundKey } from "./types";

/**
 * Procedural ambient engine — every soundscape is synthesised live with Web Audio,
 * so there are no assets to ship and nothing ever loops audibly.
 */

type Layer = { key: SoundKey; gain: GainNode; dispose: () => void };

class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private brown!: AudioBuffer;
  analyser: AnalyserNode | null = null;
  private layer: Layer | null = null;
  private volume = 0.6;

  get playing(): SoundKey | null {
    return this.layer?.key ?? null;
  }

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.master.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.5;
      this.sfxBus.connect(ctx.destination);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(3.2, 2.4);
      this.reverb.connect(this.master);
      this.noise = this.makeNoise(false);
      this.brown = this.makeNoise(true);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private makeNoise(brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (brown) {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else d[i] = w;
      }
    }
    return buf;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private noiseSource(brown = false): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    src.loop = true;
    src.loopStart = Math.random();
    return src;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  play(key: SoundKey) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (this.layer?.key === key) return;
    this.stop();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const dispose = this.build(key, gain);
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.9);
    this.layer = { key, gain, dispose };
  }

  stop() {
    const layer = this.layer;
    if (!layer || !this.ctx) return;
    this.layer = null;
    layer.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    window.setTimeout(() => {
      layer.dispose();
      layer.gain.disconnect();
    }, 2200);
  }

  private build(key: SoundKey, out: GainNode): () => void {
    const ctx = this.ctx!;
    const nodes: AudioScheduledSourceNode[] = [];
    const timers: number[] = [];
    const start = <T extends AudioScheduledSourceNode>(n: T) => {
      n.start();
      nodes.push(n);
      return n;
    };

    if (key === "rain") {
      const hiss = start(this.noiseSource());
      const hp = new BiquadFilterNode(ctx, { type: "highpass", frequency: 500 });
      const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 4200 });
      const g = new GainNode(ctx, { gain: 0.16 });
      hiss.connect(hp).connect(lp).connect(g).connect(out);
      const rumble = start(this.noiseSource(true));
      const rlp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 260 });
      const rg = new GainNode(ctx, { gain: 0.5 });
      rumble.connect(rlp).connect(rg).connect(out);
      // individual drops
      const dropBus = new GainNode(ctx, { gain: 0.5 });
      dropBus.connect(out);
      dropBus.connect(this.reverb);
      timers.push(
        window.setInterval(() => {
          const t = ctx.currentTime;
          for (let i = 0; i < 3; i++) {
            if (Math.random() > 0.55) continue;
            const s = this.noiseSource();
            const bp = new BiquadFilterNode(ctx, { type: "bandpass", frequency: 1400 + Math.random() * 3600, Q: 4 });
            const e = new GainNode(ctx, { gain: 0 });
            const at = t + Math.random() * 0.09;
            e.gain.setValueAtTime(0, at);
            e.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.12, at + 0.004);
            e.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
            s.connect(bp).connect(e).connect(dropBus);
            s.start(at);
            s.stop(at + 0.1);
          }
        }, 90),
      );
    }

    if (key === "brown") {
      const b = start(this.noiseSource(true));
      const lp = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 900 });
      const g = new GainNode(ctx, { gain: 0.85 });
      const lfo = start(new OscillatorNode(ctx, { frequency: 0.06 }));
      const lfoAmt = new GainNode(ctx, { gain: 240 });
      lfo.connect(lfoAmt).connect(lp.frequency);
      b.connect(lp).connect(g).connect(out);
    }

    if (key === "drone") {
      const filter = new BiquadFilterNode(ctx, { type: "lowpass", frequency: 520, Q: 0.7 });
      const lfo = start(new OscillatorNode(ctx, { frequency: 0.045 }));
      const lfoAmt = new GainNode(ctx, { gain: 320 });
      lfo.connect(lfoAmt).connect(filter.frequency);
      const g = new GainNode(ctx, { gain: 0.14 });
      filter.connect(g);
      g.connect(out);
      g.connect(this.reverb);
      const voices: [number, OscillatorType, number][] = [
        [55, "sawtooth", 0.5],
        [55.2, "sawtooth", 0.4],
        [82.41, "triangle", 0.7],
        [110, "sine", 0.8],
        [164.81, "sine", 0.35],
        [220.4, "sine", 0.18],
      ];
      for (const [f, type, v] of voices) {
        const o = start(new OscillatorNode(ctx, { frequency: f, type, detune: (Math.random() - 0.5) * 8 }));
        const vg = new GainNode(ctx, { gain: v });
        o.connect(vg).connect(filter);
      }
    }

    if (key === "orbit") {
      // soft pad bed
      const pad = new GainNode(ctx, { gain: 0.05 });
      pad.connect(out);
      pad.connect(this.reverb);
      for (const f of [110, 164.81, 220]) {
        const o = start(new OscillatorNode(ctx, { frequency: f, type: "sine", detune: (Math.random() - 0.5) * 6 }));
        o.connect(pad);
      }
      // generative bells through a feedback delay
      const delay = new DelayNode(ctx, { delayTime: 0.48, maxDelayTime: 2 });
      const fb = new GainNode(ctx, { gain: 0.38 });
      const wet = new GainNode(ctx, { gain: 0.5 });
      delay.connect(fb).connect(delay);
      delay.connect(wet);
      wet.connect(out);
      wet.connect(this.reverb);
      const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
      let step = 0;
      const tick = () => {
        const t = ctx.currentTime + 0.05;
        const f = scale[Math.floor(Math.random() * scale.length)];
        const o = new OscillatorNode(ctx, { frequency: f, type: "sine" });
        const o2 = new OscillatorNode(ctx, { frequency: f * 2.001, type: "triangle" });
        const e = new GainNode(ctx, { gain: 0 });
        const peak = 0.07 + Math.random() * 0.05;
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(peak, t + 0.03);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        const o2g = new GainNode(ctx, { gain: 0.18 });
        o.connect(e);
        o2.connect(o2g).connect(e);
        e.connect(out);
        e.connect(delay);
        e.connect(this.reverb);
        o.start(t);
        o2.start(t);
        o.stop(t + 3.4);
        o2.stop(t + 3.4);
        step++;
        timers.push(window.setTimeout(tick, (step % 7 === 0 ? 2400 : 600) + Math.random() * 1100));
      };
      tick();
    }

    return () => {
      for (const t of timers) {
        window.clearInterval(t);
        window.clearTimeout(t);
      }
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
        n.disconnect();
      }
    };
  }

  /** micro-interaction tick */
  tick(pitch = 1) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = new OscillatorNode(ctx, { frequency: 1850 * pitch, type: "sine" });
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.08);
  }

  /** completion chime — a small inharmonic bell */
  chime(root = 660) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [1, 2.01, 2.76, 4.07].forEach((m, i) => {
      const o = new OscillatorNode(ctx, { frequency: root * m, type: "sine" });
      const g = new GainNode(ctx, { gain: 0 });
      const peak = 0.12 / (i + 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 - i * 0.25);
      o.connect(g);
      g.connect(this.sfxBus);
      o.start(t);
      o.stop(t + 1.7);
    });
  }
}

export const audio = new AmbientEngine();

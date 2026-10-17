import Hls from 'hls.js';
import { AudioBands, PlaybackStatus } from '../types';

type StatusCallback = (status: PlaybackStatus) => void;

class RadioAudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private hls: Hls | null = null;

  // Tuning static noise nodes
  private staticSource: AudioBufferSourceNode | null = null;
  private staticGain: GainNode | null = null;

  private currentUrl = '';
  private currentHls = false;
  private usingCorsWebAudio = false;
  private volume = 0.8;
  private muted = false;
  private tuningSoundEnabled = true;
  private loadToken = 0;
  private statusCallbacks = new Set<StatusCallback>();
  private status: PlaybackStatus = 'idle';

  private freqData: Uint8Array | null = null;
  private prevEnergies: Float32Array | null = null;
  private smoothPulse = 0;

  onStatusChange(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    return () => this.statusCallbacks.delete(cb);
  }

  private emitStatus(s: PlaybackStatus): void {
    this.status = s;
    for (const cb of this.statusCallbacks) cb(s);
  }

  getStatus(): PlaybackStatus {
    return this.status;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        this.audioContext = new Ctx();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.78;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.muted ? 0 : this.volume;
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
        this.prevEnergies = new Float32Array(this.analyser.frequencyBinCount);
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  setVolume(vol: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, vol));
    this.muted = muted;
    const effective = this.muted ? 0 : this.volume;
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(effective, this.audioContext.currentTime, 0.015);
    }
    if (this.audioEl && !this.usingCorsWebAudio) {
      this.audioEl.volume = effective;
      this.audioEl.muted = this.muted;
    }
  }

  setTuningSoundEnabled(enabled: boolean): void {
    this.tuningSoundEnabled = enabled;
    if (!enabled) this.stopTuningStatic();
  }

  private startTuningStatic(): void {
    this.stopTuningStatic();
    if (!this.tuningSoundEnabled || this.muted || this.volume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 0.9;

      const gain = ctx.createGain();
      const targetGain = this.volume * 0.06;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.08);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.staticSource = source;
      this.staticGain = gain;
    } catch {
      // Ignore AudioContext restriction errors
    }
  }

  private stopTuningStatic(): void {
    const src = this.staticSource;
    const gain = this.staticGain;
    this.staticSource = null;
    this.staticGain = null;
    if (!src) return;
    try {
      if (gain && this.audioContext) {
        gain.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.03);
        setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {}
        }, 120);
      } else {
        src.stop();
        src.disconnect();
      }
    } catch {}
  }

  private cleanupAudioElement(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.mediaSource) {
      try {
        this.mediaSource.disconnect();
      } catch {}
      this.mediaSource = null;
    }
    if (this.audioEl) {
      this.audioEl.onplaying = null;
      this.audioEl.onpause = null;
      this.audioEl.onwaiting = null;
      this.audioEl.onerror = null;
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
      this.audioEl = null;
    }
    this.usingCorsWebAudio = false;
  }

  playStream(url: string, isHls = false): void {
    const token = ++this.loadToken;
    this.currentUrl = url;
    this.currentHls = isHls;
    this.cleanupAudioElement();
    this.emitStatus('loading');
    this.startTuningStatic();
    this.attemptLoad(url, isHls, true, token);
  }

  private attemptLoad(url: string, isHls: boolean, useCors: boolean, token: number): void {
    if (token !== this.loadToken) return;

    const audio = new Audio();
    audio.preload = 'auto';
    if (useCors) {
      audio.crossOrigin = 'anonymous';
    }
    this.audioEl = audio;
    this.usingCorsWebAudio = false;

    if (useCors) {
      const ctx = this.ensureContext();
      if (ctx && this.analyser) {
        try {
          this.mediaSource = ctx.createMediaElementSource(audio);
          this.mediaSource.connect(this.analyser);
          this.usingCorsWebAudio = true;
          audio.volume = 1;
          audio.muted = false;
        } catch {
          this.usingCorsWebAudio = false;
        }
      }
    }

    if (!this.usingCorsWebAudio) {
      audio.volume = this.muted ? 0 : this.volume;
      audio.muted = this.muted;
    }

    let didStartPlaying = false;

    const handleFailure = () => {
      if (token !== this.loadToken) return;
      if (useCors && !didStartPlaying) {
        // Fallback to non-CORS HTML5 audio (many Shoutcast/Icecast servers omit Access-Control-Allow-Origin)
        this.cleanupAudioElement();
        this.attemptLoad(url, isHls, false, token);
        return;
      }
      this.stopTuningStatic();
      this.emitStatus('error');
    };

    const timeoutId = window.setTimeout(() => {
      if (token === this.loadToken && !didStartPlaying) {
        handleFailure();
      }
    }, 8500);

    audio.onplaying = () => {
      if (token !== this.loadToken) return;
      didStartPlaying = true;
      window.clearTimeout(timeoutId);
      this.stopTuningStatic();
      this.emitStatus('playing');
    };

    audio.onwaiting = () => {
      if (token !== this.loadToken) return;
      if (didStartPlaying) {
        this.emitStatus('loading');
      }
    };

    audio.onerror = () => {
      window.clearTimeout(timeoutId);
      handleFailure();
    };

    if (isHls && Hls.isSupported() && !audio.canPlayType('application/vnd.apple.mpegurl')) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      this.hls = hls;
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (token !== this.loadToken) return;
        audio.play().catch((err) => {
          if (err?.name === 'NotAllowedError') {
            window.clearTimeout(timeoutId);
            this.stopTuningStatic();
            this.emitStatus('paused');
          } else {
            handleFailure();
          }
        });
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          window.clearTimeout(timeoutId);
          handleFailure();
        }
      });
    } else {
      audio.src = url;
      audio.play().catch((err) => {
        if (token !== this.loadToken) return;
        if (err?.name === 'NotAllowedError') {
          window.clearTimeout(timeoutId);
          this.stopTuningStatic();
          this.emitStatus('paused');
        } else {
          window.clearTimeout(timeoutId);
          handleFailure();
        }
      });
    }
  }

  pause(): void {
    this.loadToken++;
    this.stopTuningStatic();
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.emitStatus('paused');
  }

  resume(): void {
    if (this.currentUrl) {
      this.playStream(this.currentUrl, this.currentHls);
    }
  }

  stop(): void {
    this.loadToken++;
    this.stopTuningStatic();
    this.cleanupAudioElement();
    this.emitStatus('idle');
  }

  /**
   * Sample real-time FFT bands (`bass`, `mid`, `high`, `volume`, `pulse`) for the Immersive visualizer
   * and mini spectrum analyzer, with smooth harmonic fallback when playing a non-CORS stream.
   */
  getAudioBands(timeSec: number): AudioBands {
    if (this.status !== 'playing') {
      return {
        bass: 0.05,
        mid: 0.05,
        high: 0.05,
        volume: 0.05,
        pulse: 0,
        isSynthetic: true,
      };
    }

    if (this.usingCorsWebAudio && this.analyser && this.freqData && this.audioContext) {
      this.analyser.getByteFrequencyData(this.freqData);
      let sumCheck = 0;
      for (let i = 0; i < 64; i++) sumCheck += this.freqData[i];

      if (sumCheck > 0) {
        const nyquist = this.audioContext.sampleRate / 2;
        const binCount = this.freqData.length;
        const hzToBin = (hz: number) =>
          Math.max(0, Math.min(binCount - 1, Math.round((hz / nyquist) * binCount)));

        const avgRange = (loHz: number, hiHz: number) => {
          const b0 = hzToBin(loHz);
          const b1 = hzToBin(hiHz);
          if (b1 <= b0) return 0;
          let s = 0;
          for (let i = b0; i <= b1; i++) s += this.freqData![i];
          return s / ((b1 - b0 + 1) * 255);
        };

        const bass = Math.min(1, avgRange(40, 250) * 1.35);
        const mid = Math.min(1, avgRange(250, 3000) * 1.45);
        const high = Math.min(1, avgRange(3000, 12000) * 1.85);
        const volume = Math.min(1, bass * 0.45 + mid * 0.4 + high * 0.15);

        let flux = 0;
        const maxFluxBin = hzToBin(4000);
        if (this.prevEnergies) {
          for (let i = 1; i <= maxFluxBin; i++) {
            const cur = this.freqData[i] / 255;
            const diff = cur - this.prevEnergies[i];
            if (diff > 0) flux += diff;
            this.prevEnergies[i] = cur;
          }
        }
        const rawPulse = Math.min(1, (flux / Math.max(1, maxFluxBin)) * 12);
        this.smoothPulse = Math.max(rawPulse, this.smoothPulse * 0.86);

        return {
          bass,
          mid,
          high,
          volume,
          pulse: this.smoothPulse,
          isSynthetic: false,
          frequencyData: this.freqData,
        };
      }
    }

    // Synthetic harmonic fallback when stream lacks CORS headers
    const bass =
      0.34 +
      0.16 * Math.sin(timeSec * 0.7) +
      0.1 * Math.sin(timeSec * 1.9 + 1.3) +
      0.06 * Math.cos(timeSec * 3.1);
    const mid =
      0.3 +
      0.14 * Math.sin(timeSec * 0.9 + 2.1) +
      0.09 * Math.cos(timeSec * 2.3 + 0.4);
    const high =
      0.22 +
      0.1 * Math.sin(timeSec * 1.4 + 0.8) +
      0.07 * Math.cos(timeSec * 3.7 + 2.0);
    const volume = bass * 0.45 + mid * 0.4 + high * 0.15;
    const pulseWave = Math.max(0, Math.sin(timeSec * 2.2) * Math.sin(timeSec * 0.55));
    const pulse = Math.pow(pulseWave, 4) * 0.65;

    return {
      bass,
      mid,
      high,
      volume,
      pulse,
      isSynthetic: true,
    };
  }
}

export const audioEngine = new RadioAudioEngine();

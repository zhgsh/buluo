import type { GameScreenState, PlayMode } from './types';

export type BgmTrack = 'village' | 'battle' | 'none';

const AUDIO_STORAGE_KEY = 'clash_of_realms_audio_v1';
const DEFAULT_BGM_VOLUME = 0.55;

interface StoredAudioSettings {
  muted?: boolean;
  bgmVolume?: number;
}

export function resolveBgmTrack(screen: GameScreenState, mode: PlayMode): BgmTrack {
  if (screen === 'title' || screen === 'gameover') {
    return 'none';
  }
  return mode === 'battle' ? 'battle' : 'village';
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_BGM_VOLUME;
  return Math.max(0, Math.min(1, v));
}

interface WxAudioGlobals {
  getStorageSync?: (key: string) => unknown;
  setStorageSync?: (key: string, data: string) => void;
  createWebAudioContext?: () => AudioContext;
}

function getWxAudioGlobals(): WxAudioGlobals | undefined {
  return (globalThis as unknown as { wx?: WxAudioGlobals }).wx;
}

function loadAudioSettings(): { muted: boolean; bgmVolume: number } {
  try {
    let raw: string | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      raw = window.localStorage.getItem(AUDIO_STORAGE_KEY);
    } else {
      const wxObj = getWxAudioGlobals();
      const val = wxObj?.getStorageSync?.(AUDIO_STORAGE_KEY);
      if (typeof val === 'string' && val.length > 0) raw = val;
    }
    if (!raw) return { muted: false, bgmVolume: DEFAULT_BGM_VOLUME };
    const parsed = JSON.parse(raw) as StoredAudioSettings;
    return {
      muted: Boolean(parsed.muted),
      bgmVolume:
        typeof parsed.bgmVolume === 'number'
          ? clampVolume(parsed.bgmVolume)
          : DEFAULT_BGM_VOLUME,
    };
  } catch {
    return { muted: false, bgmVolume: DEFAULT_BGM_VOLUME };
  }
}

function saveAudioSettings(muted: boolean, bgmVolume: number): void {
  const payload = JSON.stringify({ muted, bgmVolume: clampVolume(bgmVolume) });
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUDIO_STORAGE_KEY, payload);
      return;
    }
    getWxAudioGlobals()?.setStorageSync?.(AUDIO_STORAGE_KEY, payload);
  } catch {
    // Ignore storage quota or private mode failures
  }
}

// Peaceful medieval pastoral loop (C major / A minor, 16 steps)
const VILLAGE_MELODY_HZ: ReadonlyArray<number | null> = [
  523.25, null, 659.25, 783.99,
  659.25, null, 587.33, 523.25,
  440.0, null, 523.25, 659.25,
  587.33, 523.25, 392.0, null,
];
const VILLAGE_BASS_HZ: ReadonlyArray<number | null> = [
  130.81, null, null, null,
  110.0, null, null, null,
  87.31, null, null, null,
  98.0, null, null, null,
];

// Urgent battle war-march loop (D minor, 16 steps)
const BATTLE_MELODY_HZ: ReadonlyArray<number | null> = [
  293.66, null, 349.23, 440.0,
  415.3, 440.0, 349.23, null,
  293.66, 349.23, 440.0, 523.25,
  466.16, 440.0, 349.23, 329.63,
];
const BATTLE_BASS_HZ: ReadonlyArray<number | null> = [
  73.42, null, 73.42, null,
  87.31, null, 87.31, null,
  98.0, null, 87.31, null,
  82.41, null, 73.42, null,
];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private muted: boolean;
  private bgmVolume: number;
  private desiredTrack: BgmTrack = 'none';
  private activeTrack: BgmTrack = 'none';
  private bgmTimerId: number | null = null;
  private bgmStep = 0;
  private pageHidden = false;
  private hasUserGesture = false;

  constructor() {
    const initial = loadAudioSettings();
    this.muted = initial.muted;
    this.bgmVolume = initial.bgmVolume;
  }

  private ensureContext(allowWhenMuted = false): AudioContext | null {
    if (!allowWhenMuted && this.muted) return null;
    const wxObj = getWxAudioGlobals();
    const hasBrowserAudio = typeof window !== 'undefined';
    if (!hasBrowserAudio && !wxObj?.createWebAudioContext) return null;
    if (!this.ctx && !this.hasUserGesture) return null;
    if (!this.ctx) {
      if (hasBrowserAudio) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      } else if (wxObj?.createWebAudioContext) {
        this.ctx = wxObj.createWebAudioContext();
      }
      if (!this.ctx) return null;
    }
    if (!this.bgmGain && this.ctx) {
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.computeEffectiveBgmGain(), this.ctx.currentTime);
      this.bgmGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended' && this.hasUserGesture && typeof this.ctx.resume === 'function') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private computeEffectiveBgmGain(): number {
    if (this.muted || this.pageHidden || this.desiredTrack === 'none') {
      return 0;
    }
    return this.bgmVolume * 0.28;
  }

  private syncBgmGain(immediate = false): void {
    if (!this.ctx || !this.bgmGain) return;
    const target = this.computeEffectiveBgmGain();
    const now = this.ctx.currentTime;
    try {
      this.bgmGain.gain.cancelScheduledValues(now);
      if (immediate) {
        this.bgmGain.gain.setValueAtTime(target, now);
      } else {
        this.bgmGain.gain.setTargetAtTime(target, now, 0.08);
      }
    } catch {
      this.bgmGain.gain.value = target;
    }
  }

  private stopBgmLoop(): void {
    if (this.bgmTimerId !== null) {
      globalThis.clearInterval(this.bgmTimerId);
    }
    this.bgmTimerId = null;
  }

  private startBgmLoopIfReady(): void {
    const wxObj = getWxAudioGlobals();
    if (typeof window === 'undefined' && !wxObj?.createWebAudioContext) return;
    if (this.desiredTrack === 'none' || this.pageHidden) {
      this.stopBgmLoop();
      this.activeTrack = 'none';
      this.syncBgmGain();
      return;
    }

    if (!this.hasUserGesture) return;

    const ctx = this.ensureContext(true);
    if (!ctx) return;

    const track = this.desiredTrack;
    const needsRestart = this.activeTrack !== track || this.bgmTimerId === null;
    if (!needsRestart) {
      this.syncBgmGain();
      return;
    }

    this.stopBgmLoop();
    this.activeTrack = track;
    this.bgmStep = 0;
    this.syncBgmGain();

    const stepMs = track === 'battle' ? 215 : 310;
    if (ctx.state === 'running') {
      this.scheduleBgmStep(track, this.bgmStep++);
    }
    this.bgmTimerId = globalThis.setInterval(() => {
      if (this.desiredTrack !== track || this.pageHidden) {
        this.stopBgmLoop();
        return;
      }
      if (!this.ctx || this.ctx.state !== 'running') return;
      this.scheduleBgmStep(track, this.bgmStep++);
    }, stepMs) as unknown as number;
  }

  private scheduleBgmStep(track: Exclude<BgmTrack, 'none'>, step: number): void {
    const ctx = this.ctx;
    const bus = this.bgmGain;
    if (!ctx || !bus || this.muted || this.pageHidden) return;
    if (this.bgmVolume <= 0.001) return;

    const idx = step % 16;
    const now = ctx.currentTime + 0.015;

    if (track === 'village') {
      const melodyHz = VILLAGE_MELODY_HZ[idx];
      if (melodyHz) {
        this.playBgmVoice(ctx, bus, melodyHz, 0.28, 'triangle', 0.24, now, 1800);
        // Subtle octave shimmer on downbeats
        if (idx % 4 === 0) {
          this.playBgmVoice(ctx, bus, melodyHz * 2, 0.22, 'sine', 0.07, now + 0.02, 2400);
        }
      }
      const bassHz = VILLAGE_BASS_HZ[idx];
      if (bassHz) {
        this.playBgmVoice(ctx, bus, bassHz, 0.95, 'sine', 0.26, now, 500);
      }
    } else {
      const melodyHz = BATTLE_MELODY_HZ[idx];
      if (melodyHz) {
        this.playBgmVoice(ctx, bus, melodyHz, 0.17, 'sawtooth', 0.16, now, 1350);
      }
      const bassHz = BATTLE_BASS_HZ[idx];
      if (bassHz) {
        this.playBgmVoice(ctx, bus, bassHz, 0.19, 'sawtooth', 0.25, now, 420);
      }
      // War drum kick on beats 0, 4, 8, 12 and double-kick on 10
      if (idx % 4 === 0 || idx === 10) {
        this.playBgmDrumKick(ctx, bus, now);
      }
      // Crisp snare march accent on off-beats 2, 6, 14
      if (idx === 2 || idx === 6 || idx === 14) {
        this.playBgmSnare(ctx, bus, now);
      }
    }
  }

  private playBgmVoice(
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    duration: number,
    type: OscillatorType,
    peak: number,
    startTime: number,
    filterCutoff: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  }

  private playBgmDrumKick(ctx: AudioContext, destination: AudioNode, startTime: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, startTime);
    osc.frequency.exponentialRampToValueAtTime(38, startTime + 0.14);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.42, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.16);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(startTime);
    osc.stop(startTime + 0.18);
  }

  private playBgmSnare(ctx: AudioContext, destination: AudioNode, startTime: number): void {
    const duration = 0.09;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.35));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1350;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    src.start(startTime);
  }

  public unlockAudio(): void {
    this.hasUserGesture = true;
    const ctx = this.ensureContext(true);
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume()
        .then(() => {
          this.startBgmLoopIfReady();
        })
        .catch(() => {});
    } else {
      this.startBgmLoopIfReady();
    }
  }

  public setPageHidden(hidden: boolean): void {
    this.pageHidden = hidden;
    if (hidden) {
      this.stopBgmLoop();
      this.syncBgmGain(true);
    } else if (this.desiredTrack !== 'none') {
      this.startBgmLoopIfReady();
    }
  }

  public getBgmTrack(): BgmTrack {
    return this.desiredTrack;
  }

  public setBgmTrack(track: BgmTrack): void {
    if (this.desiredTrack === track && (track === 'none' || this.bgmTimerId !== null)) {
      return;
    }
    this.desiredTrack = track;
    if (track === 'none') {
      this.stopBgmLoop();
      this.activeTrack = 'none';
      this.syncBgmGain();
      return;
    }
    this.startBgmLoopIfReady();
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public setBgmVolume(volume: number): void {
    this.bgmVolume = clampVolume(volume);
    saveAudioSettings(this.muted, this.bgmVolume);
    this.syncBgmGain();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    saveAudioSettings(this.muted, this.bgmVolume);
    this.syncBgmGain();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
    delay = 0
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const jitter = 0.94 + Math.random() * 0.12;
    osc.frequency.setValueAtTime(freqStart * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd * jitter), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoiseBurst(duration: number, filterFreq: number, gainPeak = 0.14) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.35));
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  public playClick() {
    this.playTone(540, 380, 0.06, 'triangle', 0.08);
  }

  public playCollectGold() {
    this.playTone(880, 1320, 0.09, 'sine', 0.11);
    this.playTone(1320, 1760, 0.12, 'sine', 0.1, 0.06);
  }

  public playCollectElixir() {
    this.playTone(520, 960, 0.12, 'sine', 0.11);
    this.playTone(780, 1240, 0.13, 'triangle', 0.09, 0.06);
  }

  public playBuildPlace() {
    this.playTone(180, 110, 0.11, 'square', 0.1);
    this.playTone(320, 440, 0.08, 'triangle', 0.08, 0.05);
  }

  public playUpgradeComplete() {
    this.playTone(523.25, 523.25, 0.11, 'triangle', 0.12, 0);
    this.playTone(659.25, 659.25, 0.11, 'triangle', 0.12, 0.08);
    this.playTone(783.99, 1046.5, 0.22, 'triangle', 0.14, 0.16);
  }

  public playDeployTroop() {
    this.playTone(280, 460, 0.08, 'triangle', 0.1);
  }

  public playCannonFire() {
    this.playTone(145, 42, 0.18, 'sawtooth', 0.12);
    this.playNoiseBurst(0.16, 480, 0.13);
  }

  public playArrowShot() {
    this.playTone(950, 420, 0.07, 'triangle', 0.05);
  }

  public playMortarFire() {
    this.playTone(110, 35, 0.28, 'sawtooth', 0.15);
    this.playNoiseBurst(0.24, 340, 0.16);
  }

  public playExplosion() {
    this.playTone(95, 28, 0.32, 'sawtooth', 0.16);
    this.playNoiseBurst(0.3, 620, 0.2);
  }

  public playSpellCast(isHeal: boolean) {
    if (isHeal) {
      this.playTone(587, 880, 0.25, 'sine', 0.12);
      this.playTone(880, 1174, 0.3, 'sine', 0.1, 0.08);
    } else {
      this.playTone(260, 520, 0.22, 'sawtooth', 0.1);
      this.playTone(390, 780, 0.28, 'triangle', 0.1, 0.07);
    }
  }

  public playStarEarned() {
    this.playTone(587.33, 587.33, 0.12, 'triangle', 0.14, 0);
    this.playTone(880, 1174.66, 0.25, 'triangle', 0.15, 0.09);
  }

  public playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.02, 0.22, 'triangle', 0.14, idx * 0.1);
    });
  }

  public playDefeat() {
    this.playTone(330, 220, 0.24, 'sawtooth', 0.1);
    this.playTone(220, 146.8, 0.35, 'sawtooth', 0.11, 0.18);
  }
}

export const sound = new SoundEngine();

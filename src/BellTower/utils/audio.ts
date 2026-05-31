// Bell tower audio. Per CLAUDE.md memory rules:
//   - AudioContext init only on first user gesture
//   - no continuous drone; every sound is a one-shot
//
// Voices:
//   - bong: cluster of detuned sines + low fundamental + filtered noise hit,
//     ~6s exponential decay. Vol scales with pull strength.
//   - distant bong: same recipe at lower vol + extra low-pass, for the
//     "someone else rang" ticker animation.
//   - chime: 3-note milestone celebration (when the platform hits the daily
//     threshold). One per session.
//   - pop / haptic: global tap feedback.

let actx: AudioContext | null = null;
let master: GainNode | null = null;
let liveVoices = 0;
const MAX_VOICES = 16;
let muted = false;
const MASTER_VOL = 0.55;

export function initAudio(): void {
  if (actx) return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    actx = new Ctx();
    master = actx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    master.connect(actx.destination);
  } catch (_) {
    actx = null;
  }
}

export function audioReady(): boolean {
  return !!actx && actx.state === 'running' && liveVoices < MAX_VOICES;
}

export function isMuted(): boolean { return muted; }
export function setMuted(next: boolean): void {
  muted = next;
  if (!actx || !master) return;
  try { master.gain.setValueAtTime(muted ? 0 : MASTER_VOL, actx.currentTime); } catch (_) {}
}

function trackVoice(durMs: number) {
  liveVoices++;
  setTimeout(() => { liveVoices--; }, durMs + 30);
}

/**
 * The bell. `strength` 0..1 — full pulls get a longer decay + harder hit;
 * lighter pulls (rare; only the test-ring during dev) still ring.
 * `distant=true` is the muted "someone else just rang" voice.
 */
export function playBong(strength = 1, distant = false): void {
  if (!audioReady() || !actx || !master) return;
  const t = actx.currentTime;
  const s = Math.max(0.4, Math.min(1, strength));
  const decay = distant ? 4 : 6.5 + s * 2;     // sec
  const hitGain = (distant ? 0.18 : 0.34) * (0.6 + s * 0.5);

  // Bus → optional low-pass (for "distant")
  const bus = actx.createGain();
  bus.gain.value = 1;
  let chain: AudioNode = bus;
  if (distant) {
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    bus.connect(lp);
    chain = lp;
  }
  chain.connect(master);

  // Partial set inspired by a heavy bronze bell. Octave below + fundamental
  // + minor 3rd + 5th + octave above (all slightly detuned).
  const partials: Array<{ freq: number; vol: number }> = [
    { freq: 110,  vol: 0.32 },
    { freq: 220,  vol: 1.00 },
    { freq: 261,  vol: 0.45 },
    { freq: 329,  vol: 0.35 },
    { freq: 440,  vol: 0.55 },
    { freq: 522,  vol: 0.20 },
    { freq: 880,  vol: 0.18 },
  ];
  for (const p of partials) {
    const o = actx.createOscillator();
    const g = actx.createGain();
    const detune = (Math.random() - 0.5) * 6;     // ± 3 cents
    o.type = 'sine';
    o.frequency.value = p.freq;
    o.detune.value = detune;
    const peak = hitGain * p.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + decay + 0.05);
  }

  // Initial mallet "thud" — short noise hit through a bandpass.
  const sr = actx.sampleRate;
  const buf = actx.createBuffer(1, Math.floor(sr * 0.08), sr);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const src = actx.createBufferSource();
  src.buffer = buf;
  const bp = actx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 280;
  bp.Q.value = 0.9;
  const ng = actx.createGain();
  ng.gain.value = distant ? 0.10 : 0.22;
  src.connect(bp).connect(ng).connect(bus);
  src.start(t);
  src.stop(t + 0.09);

  trackVoice(decay * 1000);
}

/** 3-note chime for the daily milestone. */
export function playMilestoneChime(): void {
  if (!audioReady() || !actx || !master) return;
  const t = actx.currentTime;
  const make = (f: number, delay: number) => {
    const o = actx!.createOscillator();
    const g = actx!.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.exponentialRampToValueAtTime(0.22, t + delay + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 2.0);
    o.connect(g).connect(master!);
    o.start(t + delay);
    o.stop(t + delay + 2.1);
  };
  make(440, 0);
  make(660, 0.20);
  make(880, 0.42);
  trackVoice(2400);
}

export function hapticTap(ms = 12): void {
  try {
    if ('vibrate' in navigator) (navigator as Navigator & { vibrate: (n: number) => void }).vibrate(ms);
  } catch (_) {}
}

// Global delegated UI tap feedback.
let globalInstalled = false;
export function installGlobalTapFeedback(): void {
  if (globalInstalled || typeof window === 'undefined') return;
  globalInstalled = true;
  window.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const interactive = target.closest('button, [role="button"], a[href]') as HTMLElement | null;
    if (!interactive) return;
    if ((interactive as HTMLButtonElement).disabled) return;
    if (interactive.closest('[data-no-feedback]')) return;
    playUiPop();
    hapticTap(8);
  }, true);
}
function playUiPop() {
  if (!audioReady() || !actx || !master) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = 'sine';
  o.frequency.value = 360 + Math.random() * 60;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.12);
}

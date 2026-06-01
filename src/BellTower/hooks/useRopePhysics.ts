// Rope + bell physics.
//   - Drag downward → `pull` (0..1) tracks how far the player has pulled.
//   - Release → spring + damping bring pull back to 0 over ~0.6s.
//   - When pull crosses RING_THRESHOLD on the upward swing, fire onRing.
//   - Bell tilt is a damped pendulum that gets impulsed by the same release.
//   - Clapper is a SECOND, lighter pendulum that lags the bell — so when the
//     bell swings, the clapper visibly catches up and strikes the rim. Each
//     strike re-impulses the bell (slight "clack") and fires onClapperHit.
//
// All animation runs in a single RAF loop and writes via CSS variables.

import { useCallback, useEffect, useRef, useState } from 'react';

const RING_THRESHOLD = 0.45;
const PULL_MAX = 1;
const SPRING_K = 0.18;
const DAMP = 0.88;

// Bell: heavy bronze. Slow oscillation, slow decay (visible ~4-5 swings).
// With BELL_K = 0.018, period ≈ 47 frames ≈ 780ms — one full oscillation
// per ~800ms. BELL_DAMP = 0.994 lets ~6-7 visible swings before settling.
const BELL_K = 0.018;
const BELL_DAMP = 0.994;

// Clapper: lighter, faster restoring force toward the bell's angle.
const CLAP_K = 0.075;
const CLAP_DAMP = 0.965;
const CLAP_RIM = 0.16;       // |clapper - bell| ≥ this radians = strike

// Cap angles so we never visually break.
const BELL_MAX_RAD = 0.70;   // ~40°
const CLAP_MAX_RAD = 0.35;

// Impulses. Sized for the velocity-per-frame convention: at max_amp A and
// stiffness K, max_velocity ≈ A·sqrt(K). For A=0.55, that's ~0.074 rad/frame.
// Hard ring impulse ≈ 0.082 → peak around 0.60 rad ≈ 34°.
const RING_IMPULSE_BASE = 0.055;
const RING_IMPULSE_STRENGTH = 0.030;
const CLAPPER_LAG_IMPULSE = 0.040;

export type RopeRefs = {
  pullVar: (v: number) => void;
  bellVar: (rad: number) => void;
  clapVar: (rad: number) => void;
};

export function useRopePhysics(opts: {
  enabled: boolean;
  onRing: (strength: number) => void;
  onFirstTouch?: () => void;
  onClapperStrike?: () => void;
  refs: RopeRefs;
}) {
  const { enabled, refs } = opts;
  const [isDragging, setIsDragging] = useState(false);
  const [hasRung, setHasRung] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const hasRungRef = useRef(hasRung);
  hasRungRef.current = hasRung;

  const pullRef = useRef(0);
  const velRef = useRef(0);
  const bellAngRef = useRef(0);
  const bellVelRef = useRef(0);
  const clapAngRef = useRef(0);
  const clapVelRef = useRef(0);
  // Strike detection: latch true when |diff| > CLAP_RIM; reset false when
  // |diff| drops below CLAP_RIM * 0.7. Each rising edge fires one strike.
  const clapArmedRef = useRef(false);

  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startPull: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const firstTouchedRef = useRef(false);
  const ropeAreaRef = useRef<{ topY: number; bottomY: number } | null>(null);
  const cbRef = useRef(opts);
  cbRef.current = opts;

  const setRopeArea = useCallback((topY: number, bottomY: number) => {
    ropeAreaRef.current = { topY, bottomY };
  }, []);

  const tick = useCallback(() => {
    rafRef.current = null;
    let pull = pullRef.current;
    let vel = velRef.current;
    let bAng = bellAngRef.current;
    let bVel = bellVelRef.current;
    let cAng = clapAngRef.current;
    let cVel = clapVelRef.current;
    const isDraggingNow = !!dragRef.current;

    if (!isDraggingNow) {
      const prev = pull;
      const force = -pull * SPRING_K;
      vel = (vel + force) * DAMP;
      pull = Math.max(0, pull + vel);
      if (Math.abs(vel) < 0.0005 && pull < 0.001) {
        pull = 0;
        vel = 0;
      }
      // Detect ring on the upward swing (pull falling through threshold fast).
      if (!hasRungRef.current && enabledRef.current && prev > RING_THRESHOLD && pull <= RING_THRESHOLD) {
        const strength = Math.min(1, prev / PULL_MAX + Math.abs(vel) * 4);
        // Bell impulse — sized so peak angle stays inside BELL_MAX_RAD even
        // at full strength. Direction randomized for natural feel.
        const dir = Math.random() > 0.5 ? 1 : -1;
        bVel += dir * (RING_IMPULSE_BASE + strength * RING_IMPULSE_STRENGTH);
        cVel += -dir * CLAPPER_LAG_IMPULSE;   // clapper lags the bell
        cbRef.current.onRing(strength);
      }
    }

    // Bell pendulum.
    bVel += -bAng * BELL_K;
    bVel *= BELL_DAMP;
    bAng += bVel;
    if (Math.abs(bAng) > BELL_MAX_RAD) {
      bAng = Math.sign(bAng) * BELL_MAX_RAD;
      bVel *= -0.4;
    }

    // Clapper — restoring force is toward the bell's current angle (not 0).
    // This keeps the clapper hanging "inside" the swinging bell.
    cVel += -(cAng - bAng) * CLAP_K;
    cVel *= CLAP_DAMP;
    cAng += cVel;
    if (Math.abs(cAng) > CLAP_MAX_RAD) {
      cAng = Math.sign(cAng) * CLAP_MAX_RAD;
      cVel *= -0.5;
    }

    // Strike detection: clapper hits the rim when |clap - bell| exceeds
    // CLAP_RIM. Latched: each rising edge fires one strike; must drop
    // below 70% of the rim before the next one can fire. (Otherwise a
    // clapper that just rests at maxAngle would re-fire every frame.)
    const diff = cAng - bAng;
    const absDiff = Math.abs(diff);
    if (!clapArmedRef.current && absDiff > CLAP_RIM) {
      clapArmedRef.current = true;
      const side = diff > 0 ? 1 : -1;
      // Small reverse impulse on the bell from the strike.
      bVel += -side * 0.010;
      cbRef.current.onClapperStrike?.();
    } else if (clapArmedRef.current && absDiff < CLAP_RIM * 0.7) {
      clapArmedRef.current = false;
    }

    // Settle thresholds.
    const stillBell = Math.abs(bVel) < 0.0008 && Math.abs(bAng) < 0.0008;
    const stillClap = Math.abs(cVel) < 0.0008 && Math.abs(cAng - bAng) < 0.0008;
    if (stillBell && stillClap && pull === 0 && !isDraggingNow) {
      bAng = 0; bVel = 0; cAng = 0; cVel = 0;
    }

    pullRef.current = pull;
    velRef.current = vel;
    bellAngRef.current = bAng;
    bellVelRef.current = bVel;
    clapAngRef.current = cAng;
    clapVelRef.current = cVel;

    refs.pullVar(pull);
    refs.bellVar(bAng);
    refs.clapVar(cAng);

    if (pull > 0 || Math.abs(bAng) > 0 || Math.abs(cAng) > 0 || Math.abs(bVel) > 0 || Math.abs(cVel) > 0 || isDraggingNow) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [refs]);

  const ensureTicking = useCallback(() => {
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabledRef.current || hasRungRef.current) return;
    if (e.button === 2) return;
    if (!firstTouchedRef.current) {
      firstTouchedRef.current = true;
      cbRef.current.onFirstTouch?.();
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startPull: pullRef.current,
    };
    setIsDragging(true);
    ensureTicking();
  }, [ensureTicking]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const area = ropeAreaRef.current;
      const span = area ? Math.max(80, area.bottomY - area.topY) : 240;
      // Progressive resistance: easy first 25% then logarithmic.
      const dy = e.clientY - d.startY;
      const linear = d.startPull + dy / span;
      const eased = linear <= 0.25
        ? linear
        : 0.25 + (1 - 0.25) * (1 - Math.exp(-(linear - 0.25) * 2.4));
      const next = Math.max(0, Math.min(PULL_MAX, eased));
      pullRef.current = next;
      velRef.current = 0;
      ensureTicking();
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
      ensureTicking();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [ensureTicking]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  /** Impulse the bell from external code (e.g. distant rings). */
  const nudgeBell = useCallback((magnitude = 0.06) => {
    bellVelRef.current += (Math.random() > 0.5 ? 1 : -1) * magnitude;
    ensureTicking();
  }, [ensureTicking]);

  return {
    isDragging,
    hasRung,
    setHasRung,
    onPointerDown,
    setRopeArea,
    nudgeBell,
  };
}

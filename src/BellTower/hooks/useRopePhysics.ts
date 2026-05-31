// Rope + bell physics.
//   - Drag downward → `pull` (0..1) tracks how far the player has pulled.
//   - Release → spring + damping bring pull back to 0 over ~0.6s.
//   - When pull crosses RING_THRESHOLD on the upward swing, fire onRing.
//   - Bell tilt is a damped pendulum that gets impulsed by the same release.
//
// All animation runs in a single RAF loop and writes via CSS variables — no
// React state churn per frame.

import { useCallback, useEffect, useRef, useState } from 'react';

const RING_THRESHOLD = 0.45;
const PULL_MAX = 1;
const SPRING_K = 0.18;
const DAMP = 0.88;
const BELL_K = 0.04;
const BELL_DAMP = 0.985;

export type RopeRefs = {
  pullVar: (v: number) => void;
  bellVar: (rad: number) => void;
};

export function useRopePhysics(opts: {
  enabled: boolean;
  onRing: (strength: number) => void;
  onFirstTouch?: () => void;
  refs: RopeRefs;
}) {
  const { enabled, refs } = opts;
  const [isDragging, setIsDragging] = useState(false);
  const [hasRung, setHasRung] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const hasRungRef = useRef(hasRung);
  hasRungRef.current = hasRung;

  const pullRef = useRef(0);          // 0..1
  const velRef = useRef(0);           // pull velocity per frame
  const bellAngRef = useRef(0);       // radians
  const bellVelRef = useRef(0);
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

  // Main RAF loop — runs while a pull is non-zero or the bell is swinging.
  const tick = useCallback(() => {
    rafRef.current = null;
    let pull = pullRef.current;
    let vel = velRef.current;
    let bAng = bellAngRef.current;
    let bVel = bellVelRef.current;
    const isDraggingNow = !!dragRef.current;

    if (!isDraggingNow) {
      // Spring pull back to 0.
      const prev = pull;
      const force = -pull * SPRING_K;
      vel = (vel + force) * DAMP;
      pull = Math.max(0, pull + vel);
      if (Math.abs(vel) < 0.0005 && pull < 0.001) {
        pull = 0;
        vel = 0;
      }
      // Detect ring on the upward swing (pull falling fast through threshold).
      if (!hasRungRef.current && enabledRef.current && prev > RING_THRESHOLD && pull <= RING_THRESHOLD) {
        const strength = Math.min(1, prev / PULL_MAX + Math.abs(vel) * 4);
        // Impulse the bell (sign alternates to feel real, but always strikes)
        bVel += (Math.random() > 0.5 ? 1 : -1) * (0.18 + strength * 0.10);
        cbRef.current.onRing(strength);
      }
    }

    // Bell pendulum (always running, fades fast when at rest)
    bVel += -bAng * BELL_K;
    bVel *= BELL_DAMP;
    bAng += bVel;
    if (Math.abs(bVel) < 0.0001 && Math.abs(bAng) < 0.0005) {
      bAng = 0;
      bVel = 0;
    }

    pullRef.current = pull;
    velRef.current = vel;
    bellAngRef.current = bAng;
    bellVelRef.current = bVel;

    refs.pullVar(pull);
    refs.bellVar(bAng);

    // Schedule next frame only if still moving (or dragging).
    if (pull > 0 || Math.abs(bAng) > 0 || isDraggingNow) {
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
      // Pulling downward (positive dy) increases pull.
      const dy = e.clientY - d.startY;
      const next = Math.max(0, Math.min(PULL_MAX, d.startPull + dy / span));
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

  /** Impulse the bell from external code (e.g. "distant ring" ticker). */
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

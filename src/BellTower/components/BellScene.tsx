// Cathedral interior with a bronze bell up top and a rope hanging down.
// Movement is driven via CSS custom properties (--pull, --bell-rad).

import { forwardRef, useImperativeHandle, useRef } from 'react';
import './BellScene.less';

export type BellSceneHandle = {
  setPull: (v: number) => void;            // 0..1
  setBellRad: (rad: number) => void;
  measureRope: () => { topY: number; bottomY: number };
};

export type BellSceneProps = {
  onPointerDown: (e: React.PointerEvent) => void;
  ringingPulse: number;                    // bump up briefly on ring for the bell glow
  hasRung: boolean;
  dragging: boolean;
};

const BellScene = forwardRef<BellSceneHandle, BellSceneProps>(function BellScene(
  { onPointerDown, ringingPulse, hasRung, dragging }, ref
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ropeRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setPull: (v) => {
      if (rootRef.current) rootRef.current.style.setProperty('--pull', String(v));
    },
    setBellRad: (rad) => {
      if (bellRef.current) bellRef.current.style.setProperty('--bell-rad', String(rad));
    },
    measureRope: () => {
      const el = ropeRef.current;
      if (!el) return { topY: 0, bottomY: 0 };
      const r = el.getBoundingClientRect();
      return { topY: r.top, bottomY: r.bottom };
    },
  }), []);

  return (
    <div
      ref={rootRef}
      className={`bt-scene ${hasRung ? 'is-rung' : ''} ${dragging ? 'is-pulling' : ''}`}
      style={{ '--pulse': ringingPulse } as React.CSSProperties}
    >
      {/* Arched window light + smoky volume rays */}
      <div className="bt-arch" aria-hidden="true">
        <div className="bt-arch__shaft bt-arch__shaft--a" />
        <div className="bt-arch__shaft bt-arch__shaft--b" />
        <div className="bt-arch__shaft bt-arch__shaft--c" />
      </div>

      {/* Wood beam crossing top */}
      <div className="bt-beam" aria-hidden="true" />

      {/* Bell hanging from the beam */}
      <div className="bt-bell-mount" aria-hidden="true">
        <div className="bt-bell-yoke" />
        <div ref={bellRef} className="bt-bell">
          <svg viewBox="0 0 200 240" width="180" height="216" aria-hidden="true">
            <defs>
              <linearGradient id="bell-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#caa05a" />
                <stop offset="0.45" stopColor="#7a5b1d" />
                <stop offset="0.9" stopColor="#3a2a0d" />
              </linearGradient>
              <linearGradient id="bell-rim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3a2a0d" />
                <stop offset="0.5" stopColor="#a07c2f" />
                <stop offset="1" stopColor="#3a2a0d" />
              </linearGradient>
              <radialGradient id="bell-shine" cx="0.32" cy="0.28" r="0.45">
                <stop offset="0" stopColor="#fff5cf" stopOpacity="0.75" />
                <stop offset="1" stopColor="#fff5cf" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Crown (top loop) */}
            <path d="M88 8 Q100 0 112 8 L112 26 L88 26 Z" fill="url(#bell-body)" />
            {/* Body */}
            <path
              d="M40 200 Q30 100 100 28 Q170 100 160 200 Z"
              fill="url(#bell-body)"
              stroke="#1a0e02"
              strokeWidth="2"
            />
            {/* Highlight */}
            <ellipse cx="70" cy="100" rx="32" ry="60" fill="url(#bell-shine)" />
            {/* Rim band */}
            <rect x="36" y="196" width="128" height="14" rx="3" fill="url(#bell-rim)" stroke="#1a0e02" strokeWidth="1.2" />
            {/* Lip shadow */}
            <ellipse cx="100" cy="216" rx="64" ry="6" fill="#1a0e02" opacity="0.55" />
            {/* Clapper hint */}
            <ellipse cx="100" cy="178" rx="6" ry="14" fill="#2d1e08" />
          </svg>
          {/* Glow halo on ring */}
          <div className="bt-bell__halo" />
        </div>
      </div>

      {/* Rope from beam to user hand */}
      <div className="bt-rope-wrap" aria-hidden="true">
        <div ref={ropeRef} className="bt-rope">
          <div className="bt-rope__line" />
          <div className="bt-rope__line bt-rope__line--shadow" />
          <div ref={handleRef} className="bt-rope__handle">
            <div className="bt-rope__knot" />
            <div className="bt-rope__tassel" />
          </div>
        </div>
      </div>

      {/* Drag affordance — entire bottom half is the touchable area */}
      <div
        className="bt-rope-touch"
        onPointerDown={onPointerDown}
        data-no-feedback
      />

      <div className="bt-floor" aria-hidden="true" />
    </div>
  );
});

export default BellScene;

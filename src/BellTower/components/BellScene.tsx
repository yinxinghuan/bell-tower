// Cathedral interior with a heavy bronze bell hanging from a wooden yoke
// inside a vaulted stone arch. Movement driven via CSS custom properties
// (--pull, --bell-rad, --clap-rad).

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './BellScene.less';

export type BellSceneHandle = {
  setPull: (v: number) => void;
  setBellRad: (rad: number) => void;
  setClapRad: (rad: number) => void;
  measureRope: () => { topY: number; bottomY: number };
  triggerRipple: () => void;          // bumped when the bell hits — spawn shockwave + dust
};

export type BellSceneProps = {
  onPointerDown: (e: React.PointerEvent) => void;
  ringingPulse: number;
  hasRung: boolean;
  dragging: boolean;
};

type Ripple = { id: number; bornAt: number };

const BellScene = forwardRef<BellSceneHandle, BellSceneProps>(function BellScene(
  { onPointerDown, ringingPulse, hasRung, dragging }, ref
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ropeRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const clapperRef = useRef<SVGGElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextRippleId = useRef(0);

  useImperativeHandle(ref, () => ({
    setPull: (v) => {
      if (rootRef.current) rootRef.current.style.setProperty('--pull', String(v));
    },
    setBellRad: (rad) => {
      if (bellRef.current) bellRef.current.style.setProperty('--bell-rad', String(rad));
    },
    setClapRad: (rad) => {
      if (clapperRef.current) clapperRef.current.style.setProperty('--clap-rad', String(rad));
    },
    measureRope: () => {
      const el = ropeRef.current;
      if (!el) return { topY: 0, bottomY: 0 };
      const r = el.getBoundingClientRect();
      return { topY: r.top, bottomY: r.bottom };
    },
    triggerRipple: () => {
      const id = ++nextRippleId.current;
      setRipples(rs => [...rs, { id, bornAt: Date.now() }]);
    },
  }), []);

  // GC old ripples after they finish animating (2s).
  useEffect(() => {
    if (ripples.length === 0) return;
    const t = setTimeout(() => {
      setRipples(rs => rs.filter(r => Date.now() - r.bornAt < 2100));
    }, 2200);
    return () => clearTimeout(t);
  }, [ripples]);

  return (
    <div
      ref={rootRef}
      className={`bt-scene ${hasRung ? 'is-rung' : ''} ${dragging ? 'is-pulling' : ''}`}
      style={{ '--pulse': ringingPulse } as React.CSSProperties}
    >
      {/* Background — stone wall + soft warm lighting from below-front-right */}
      <div className="bt-walls" aria-hidden="true">
        <div className="bt-walls__stone" />
        <div className="bt-walls__warmth" />
        <div className="bt-walls__darkness" />
      </div>

      {/* Pointed stone arch behind the beam, suggesting tower chamber */}
      <div className="bt-arch" aria-hidden="true">
        <svg viewBox="0 0 360 360" preserveAspectRatio="xMidYMin meet">
          <defs>
            <linearGradient id="arch-stone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2c241a" stopOpacity="0.0" />
              <stop offset="0.5" stopColor="#3b2e1f" stopOpacity="0.55" />
              <stop offset="1" stopColor="#1a1208" stopOpacity="0.85" />
            </linearGradient>
            <pattern id="stone-blocks" width="60" height="30" patternUnits="userSpaceOnUse">
              <rect width="60" height="30" fill="transparent" />
              <path d="M0 0 L60 0 M0 30 L60 30 M30 0 L30 15 M0 15 L60 15 M15 15 L15 30 M45 15 L45 30"
                stroke="rgba(0,0,0,0.45)" strokeWidth="0.7" />
            </pattern>
          </defs>
          {/* Arch fill — pointed gothic arch around the central bell area */}
          <path
            d="M40 360 L40 200 Q40 40 180 22 Q320 40 320 200 L320 360 Z"
            fill="url(#arch-stone)"
          />
          {/* Block joint pattern, very low opacity */}
          <path
            d="M40 360 L40 200 Q40 40 180 22 Q320 40 320 200 L320 360 Z"
            fill="url(#stone-blocks)"
            opacity="0.35"
          />
          {/* Arch keystone hint at top */}
          <path
            d="M168 22 L192 22 L194 38 L166 38 Z"
            fill="rgba(0,0,0,0.5)"
            stroke="rgba(255,200,140,0.05)"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Wood beam — chunky timber with chamfered end-cuts visible left + right of bell */}
      <div className="bt-beam" aria-hidden="true">
        <div className="bt-beam__end bt-beam__end--l" />
        <div className="bt-beam__core" />
        <div className="bt-beam__end bt-beam__end--r" />
        <div className="bt-beam__bolt bt-beam__bolt--l" />
        <div className="bt-beam__bolt bt-beam__bolt--r" />
      </div>

      {/* Bell + yoke. Yoke crosses through the bell crown; bell hangs below. */}
      <div className="bt-bell-mount" aria-hidden="true">
        <div className="bt-yoke">
          <div className="bt-yoke__bolt bt-yoke__bolt--l" />
          <div className="bt-yoke__bolt bt-yoke__bolt--r" />
        </div>

        <div ref={bellRef} className="bt-bell">
          {/* Halo behind for ring glow */}
          <div className="bt-bell__halo" />

          <svg viewBox="0 0 260 320" width="220" height="270" aria-hidden="true">
            <defs>
              <linearGradient id="bell-shoulder" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0"    stopColor="#f0d29a" />
                <stop offset="0.18" stopColor="#caa05a" />
                <stop offset="0.55" stopColor="#7a5618" />
                <stop offset="1"    stopColor="#241808" />
              </linearGradient>
              <linearGradient id="bell-soundbow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7a5618" />
                <stop offset="0.4" stopColor="#a07c2f" />
                <stop offset="1" stopColor="#352208" />
              </linearGradient>
              <radialGradient id="bell-highlight" cx="0.35" cy="0.25" r="0.5">
                <stop offset="0" stopColor="#fff3c8" stopOpacity="0.9" />
                <stop offset="0.4" stopColor="#fff3c8" stopOpacity="0.32" />
                <stop offset="1" stopColor="#fff3c8" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="bell-shadow" cx="0.78" cy="0.65" r="0.55">
                <stop offset="0" stopColor="#1a0e02" stopOpacity="0.0" />
                <stop offset="1" stopColor="#1a0e02" stopOpacity="0.55" />
              </radialGradient>
              <linearGradient id="bell-mouth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#050200" />
                <stop offset="1" stopColor="#1a0c02" />
              </linearGradient>
              <linearGradient id="iron" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#8a7864" />
                <stop offset="0.5" stopColor="#3a2f24" />
                <stop offset="1" stopColor="#0e0a06" />
              </linearGradient>
            </defs>

            {/* Crown loops (canons) — two iron loops at top through which the yoke pin passes */}
            <ellipse cx="110" cy="22" rx="10" ry="14" fill="none" stroke="url(#iron)" strokeWidth="4" />
            <ellipse cx="150" cy="22" rx="10" ry="14" fill="none" stroke="url(#iron)" strokeWidth="4" />
            {/* Yoke pin going through */}
            <rect x="92" y="14" width="76" height="6" rx="2" fill="url(#iron)" />

            {/* Argent (the saddle joining the crown to the shoulder) */}
            <path d="M85 36 Q130 24 175 36 L168 54 Q130 46 92 54 Z" fill="#2a1c08" />

            {/* Bell body — shoulder + waist + sound bow + lip
                Path traces: top center → out-and-down through shoulder bulge → tighter through waist
                → flare out at sound bow → straight lip → mirrored on the other side. */}
            <path
              d="
                M130 50
                Q 70 60, 50 130
                Q 38 200, 50 250
                L 38 260
                L 38 282
                L 222 282
                L 222 260
                L 210 250
                Q 222 200, 210 130
                Q 190 60, 130 50
                Z
              "
              fill="url(#bell-shoulder)"
              stroke="#0c0602"
              strokeWidth="1.5"
            />

            {/* Sound bow — the slightly thicker dark belt above the lip */}
            <path
              d="M 40 252 Q 130 268, 220 252 L 222 268 Q 130 282, 38 268 Z"
              fill="url(#bell-soundbow)"
              opacity="0.85"
            />

            {/* Highlight — soft warm gleam on the upper-left where light hits */}
            <ellipse cx="92" cy="125" rx="28" ry="78" fill="url(#bell-highlight)" opacity="0.55" />
            <ellipse cx="80" cy="180" rx="7" ry="30" fill="rgba(255,240,200,0.10)" />

            {/* Shadow side — opposite the light, in the lower-right */}
            <ellipse cx="186" cy="180" rx="55" ry="95" fill="url(#bell-shadow)" />

            {/* Lip rim — thin highlight along the bottom curve */}
            <path
              d="M 38 282 L 222 282"
              stroke="#f3d49a"
              strokeWidth="1.2"
              opacity="0.55"
              fill="none"
            />

            {/* Mouth cavity — open bottom of the bell. A wider, darker ellipse
                that recedes below the lip so we can clearly see the bell is
                hollow. */}
            <ellipse cx="130" cy="293" rx="86" ry="11" fill="url(#bell-mouth)" />
            <ellipse cx="130" cy="289" rx="86" ry="4" fill="#000" opacity="0.6" />

            {/* Clapper — own group, rotates independently around its top pivot.
                The clapper hangs from the inside top of the bell. */}
            <g
              ref={clapperRef}
              className="bt-bell__clapper"
              style={{ transformOrigin: '130px 60px' } as React.CSSProperties}
            >
              {/* Shaft */}
              <rect x="127" y="60" width="6" height="170" rx="2" fill="#1a0e04" />
              {/* Ball at the bottom */}
              <ellipse cx="130" cy="244" rx="14" ry="16" fill="#3a2614" stroke="#0a0502" strokeWidth="1.2" />
              <ellipse cx="125" cy="238" rx="4" ry="5" fill="rgba(255,210,140,0.4)" />
            </g>

            {/* Cast-shadow ellipse beneath the bell rim — implies the bell is 3D */}
            <ellipse cx="130" cy="296" rx="98" ry="5" fill="#000" opacity="0.55" />
          </svg>
        </div>
      </div>

      {/* Rope from beam to user hand */}
      <div className="bt-rope-wrap" aria-hidden="true">
        <div ref={ropeRef} className="bt-rope">
          <div className="bt-rope__line" />
          <div className="bt-rope__shadow" />

          {/* Hand-grip end: wooden knob + multi-strand tassel */}
          <div className="bt-rope__handle">
            <div className="bt-rope__knob">
              <div className="bt-rope__knob-hi" />
            </div>
            <div className="bt-rope__tassel">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="bt-rope__strand" style={{ '--i': i } as React.CSSProperties} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ripples — soft expanding circles each time the bell strikes */}
      <div className="bt-ripples" aria-hidden="true">
        {ripples.map(r => (
          <span key={r.id} className="bt-ripple" />
        ))}
      </div>

      {/* Drag affordance — lower 60% of the scene is the touchable area */}
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

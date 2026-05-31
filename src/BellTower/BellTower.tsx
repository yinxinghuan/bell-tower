// The Bell Tower — one ring a day, heard by everyone.

import { useCallback, useEffect, useRef, useState } from 'react';
import './BellTower.less';
import BellScene, { type BellSceneHandle } from './components/BellScene';
import Ticker from './components/Ticker';
import Wall from './components/Wall';
import { useRopePhysics } from './hooks/useRopePhysics';
import { useTolls } from './hooks/useTolls';
import {
  initAudio,
  installGlobalTapFeedback,
  isMuted,
  setMuted,
  playBong,
  playMilestoneChime,
  hapticTap,
} from './utils/audio';
import { t } from './i18n';

export default function BellTower() {
  const sceneRef = useRef<BellSceneHandle>(null);
  const [hintVisible, setHintVisible] = useState(true);
  const [muted, setMutedState] = useState(isMuted());
  const [ringingPulse, setRingingPulse] = useState(0);
  const [wallOpen, setWallOpen] = useState(false);

  const tolls = useTolls();
  const milestoneSeenRef = useRef(false);

  useEffect(() => { installGlobalTapFeedback(); }, []);

  // Animate distant rings — when a new other-user toll arrives, do a faint
  // bong + a small bell nudge. Compare by id set to detect deltas.
  const knownDistantIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const incomingIds = new Set(tolls.todayEntries.map(e => e.id));
    let firstSync = knownDistantIdsRef.current.size === 0;
    const newOnes = tolls.todayEntries.filter(e => !knownDistantIdsRef.current.has(e.id));
    knownDistantIdsRef.current = incomingIds;
    if (firstSync) return;     // don't replay history on initial load
    newOnes.forEach((entry, i) => {
      setTimeout(() => {
        playBong(0.4, true);
        ropeRef.current?.nudgeBell(0.05);
      }, i * 220);
      void entry;
    });
  }, [tolls.todayEntries]);

  // Milestone chime once per session when threshold crossed.
  useEffect(() => {
    if (tolls.milestoneHit && !milestoneSeenRef.current) {
      milestoneSeenRef.current = true;
      playMilestoneChime();
    }
  }, [tolls.milestoneHit]);

  // ─── Rope physics wiring ───────────────────────────────────────────────
  const onRing = useCallback((strength: number) => {
    if (tolls.hasRungToday) return;
    playBong(strength);
    hapticTap(28);
    setRingingPulse(1);
    setTimeout(() => setRingingPulse(0.35), 350);
    setTimeout(() => setRingingPulse(0), 1800);
    tolls.submitRing();
  }, [tolls]);

  const onFirstTouch = useCallback(() => {
    initAudio();
    setHintVisible(false);
  }, []);

  const ropeRefs = useRef({
    pullVar: (v: number) => sceneRef.current?.setPull(v),
    bellVar: (rad: number) => sceneRef.current?.setBellRad(rad),
  });

  const rope = useRopePhysics({
    enabled: !tolls.hasRungToday,
    onRing,
    onFirstTouch,
    refs: ropeRefs.current,
  });
  const ropeRef = useRef(rope);
  ropeRef.current = rope;

  // Measure rope after layout for drag-distance mapping.
  useEffect(() => {
    const m = sceneRef.current?.measureRope();
    if (m) rope.setRopeArea(m.topY, m.bottomY);
    const onResize = () => {
      const m2 = sceneRef.current?.measureRope();
      if (m2) rope.setRopeArea(m2.topY, m2.bottomY);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [rope]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }, [muted]);

  const openWall = useCallback(() => {
    setWallOpen(true);
    tolls.refresh();
  }, [tolls]);

  const todayLine = tolls.ringPlatformToday <= 0
    ? t('stats.today_loading')
    : tolls.ringPlatformToday === 1
      ? t('stats.today_one')
      : t('stats.today_many', { n: tolls.ringPlatformToday.toLocaleString() });

  return (
    <div className="bt-root">
      <header className="bt-header">
        <div className="bt-header__brand">
          <span className="bt-header__title">{t('app.name')}</span>
          <span className="bt-header__sub">{t('app.sub')}</span>
        </div>
        <div className="bt-header__actions">
          <button
            className={`bt-iconbtn ${muted ? 'is-off' : ''}`}
            onClick={toggleMute}
            aria-label={muted ? t('mute.off') : t('mute.on')}
          >
            {muted ? '✕' : '♪'}
          </button>
          <button className="bt-iconbtn" onClick={openWall} aria-label="wall">⌘</button>
        </div>
      </header>

      <div className="bt-today" data-no-feedback>{todayLine}</div>
      <Ticker entries={tolls.todayEntries} onOpenWall={openWall} />

      <BellScene
        ref={sceneRef}
        onPointerDown={rope.onPointerDown}
        ringingPulse={ringingPulse}
        hasRung={tolls.hasRungToday}
        dragging={rope.isDragging}
      />

      <div className="bt-foot">
        {tolls.hasRungToday ? (
          <div className="bt-foot__done">
            <div className="bt-foot__done-line">{t('state.rung_today')}</div>
            <div className="bt-foot__done-sub">{t('state.come_back')}</div>
          </div>
        ) : hintVisible ? (
          <div className="bt-foot__hint">{t('hint.pull')}</div>
        ) : (
          <div className="bt-foot__placeholder" />
        )}
      </div>

      <Wall
        open={wallOpen}
        onClose={() => setWallOpen(false)}
        entries={tolls.todayEntries}
        myToday={tolls.myToday}
        milestoneHit={tolls.milestoneHit}
        platformToday={tolls.ringPlatformToday}
        goal={tolls.ringPlatformDailyGoal}
      />
    </div>
  );
}

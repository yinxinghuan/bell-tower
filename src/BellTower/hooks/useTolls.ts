// Today's tolls — combines:
//   - useGameSave round-trip: own ring persists with the day key
//   - get/data/list: all other users' published toll rows, today only
//   - useGameStats('ring'): aggregate platform count (for the threshold)
//
// We poll get/data/list every 30s so the ticker feels alive without
// hammering. Re-fetch immediately right after the player rings.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  callAigramAPI,
  isInAigram,
  telegramId,
  type AigramResponse,
} from '@shared/runtime';
import { getGameUuid, useGameEvent, useGameStats } from '@shared/runtime';
import { useGameSave } from '@shared/save';
import type { Toll, WallToll } from '../types';
import { utcDayKey } from '../types';

const GAME_ID = 'bell-tower';
const POLL_MS = 30_000;
const DAILY_GOAL = 100;
const EVENT = 'ring';

interface RawRow {
  user_id: string;
  user_name?: string;
  user_avatar_url?: string;
  head_url?: string;
  resource_data: string;
}

type SavePayload = {
  tolls: Toll[];           // most-recent first, kept across days (cap 30)
};

export type UseTolls = {
  myToday: Toll | null;                  // null if we haven't rung today
  todayEntries: WallToll[];              // other users' rings, newest first
  ringPlatformToday: number;             // aggregate from useGameStats
  ringPlatformDailyGoal: number;
  milestoneHit: boolean;                 // ring goal reached
  hasRungToday: boolean;
  submitRing: () => void;
  refresh: () => Promise<void>;
};

export function useTolls(): UseTolls {
  const today = utcDayKey();
  const save = useGameSave<SavePayload>(GAME_ID);
  const event = useGameEvent();
  const { stats, refresh: refreshStats } = useGameStats(EVENT);

  // Lifted local mirror — useGameSave.savedData never echoes writes back.
  const [tolls, setTolls] = useState<Toll[]>([]);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    if (save.savedData === undefined) return;
    hydratedRef.current = true;
    const list = save.savedData?.tolls;
    setTolls(Array.isArray(list) ? list : []);
  }, [save.savedData]);

  const myToday = tolls.find(t => t.day === today) ?? null;

  const [todayEntries, setTodayEntries] = useState<WallToll[]>([]);

  const refresh = useCallback(async () => {
    const sessionId = getGameUuid();
    if (!isInAigram || !sessionId) {
      setTodayEntries([]);
      return;
    }
    try {
      const res = await callAigramAPI<AigramResponse<RawRow[]>>(
        `/note/aigram/ai/game/get/data/list?session_id=${encodeURIComponent(sessionId)}`,
        'GET',
      );
      const rows: RawRow[] = Array.isArray(res?.data) ? res.data : [];
      const flat: WallToll[] = [];
      for (const r of rows) {
        if (!r.resource_data) continue;
        if (r.user_id === telegramId) continue;       // self renders from local
        let payload: SavePayload;
        try { payload = JSON.parse(r.resource_data) as SavePayload; }
        catch (_) { continue; }
        const list = Array.isArray(payload.tolls) ? payload.tolls : [];
        for (const t of list) {
          if (!t?.ts || !t?.day) continue;
          if (t.day !== today) continue;              // today only
          flat.push({
            ...t,
            userId: r.user_id,
            userName: r.user_name || 'someone',
            userAvatarUrl: r.head_url || r.user_avatar_url || undefined,
          });
        }
      }
      flat.sort((a, b) => b.ts - a.ts);
      setTodayEntries(flat.slice(0, 100));
    } catch (_) {
      // stale stays
    }
  }, [today]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const submitRing = useCallback(() => {
    if (myToday) return;
    const ring: Toll = {
      id: `${telegramId ?? 'anon'}-${today}`,
      ts: Date.now(),
      day: today,
    };
    const next = [ring, ...tolls.filter(t => t.day !== today)].slice(0, 30);
    setTolls(next);
    save.persist({ tolls: next });
    event.trigger(EVENT);
    // Pull stats + others' rings sooner than the next poll cycle.
    setTimeout(() => { refreshStats(); refresh(); }, 800);
  }, [myToday, tolls, today, save, event, refreshStats, refresh]);

  const ringPlatformToday = stats.day_click_count || 0;
  const milestoneHit = ringPlatformToday >= DAILY_GOAL;

  return {
    myToday,
    todayEntries,
    ringPlatformToday,
    ringPlatformDailyGoal: DAILY_GOAL,
    milestoneHit,
    hasRungToday: !!myToday,
    submitRing,
    refresh,
  };
}

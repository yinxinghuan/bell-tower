export type Toll = {
  id: string;
  ts: number;          // epoch ms
  day: string;         // YYYY-MM-DD (UTC)
};

export type WallToll = Toll & {
  userId: string;
  userName: string;
  userAvatarUrl?: string;
};

/** YYYY-MM-DD in UTC. */
export function utcDayKey(ts = Date.now()): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

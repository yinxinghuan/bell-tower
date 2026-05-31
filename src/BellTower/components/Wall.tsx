// Today's tolls — chronological list with avatar + name + time.

import './Wall.less';
import type { Toll, WallToll } from '../types';
import { t, relativeTime } from '../i18n';
import { isInAigram, openAigramProfile } from '@shared/runtime';

export type WallProps = {
  open: boolean;
  onClose: () => void;
  entries: WallToll[];
  myToday: Toll | null;
  milestoneHit: boolean;
  platformToday: number;
  goal: number;
};

export default function Wall({ open, onClose, entries, myToday, milestoneHit, platformToday, goal }: WallProps) {
  if (!open) return null;
  const all: Array<WallToll | (Toll & { self: true })> = [
    ...(myToday ? [{ ...myToday, self: true as const }] : []),
    ...entries,
  ].sort((a, b) => b.ts - a.ts);

  return (
    <div className="bt-wall">
      <div className="bt-wall__bar">
        <div className="bt-wall__title">{t('wall.title')}</div>
        <button className="bt-wall__close" onClick={onClose} aria-label={t('sheet.close')}>×</button>
      </div>

      <div className="bt-wall__stats">
        {milestoneHit ? (
          <div className="bt-wall__milestone">{t('milestone.hit')}</div>
        ) : (
          <div className="bt-wall__progress">
            <div className="bt-wall__progress-text">
              {t('milestone.progress', { n: platformToday, goal })}
            </div>
            <div className="bt-wall__progress-bar">
              <div
                className="bt-wall__progress-fill"
                style={{ width: `${Math.min(100, (platformToday / goal) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bt-wall__scroll">
        {all.length === 0 ? (
          <div className="bt-wall__empty">{t('wall.empty')}</div>
        ) : (
          all.map((r, i) => {
            const isSelf = 'self' in r;
            return (
              <div key={r.id + i} className={`bt-wall__row ${isSelf ? 'is-self' : ''}`}>
                <span className="bt-wall__dot" />
                {isSelf ? (
                  <span className="bt-wall__chip bt-wall__chip--you">{t('wall.you')}</span>
                ) : (
                  <span
                    className="bt-wall__chip"
                    role="button"
                    onClick={() => isInAigram && openAigramProfile(r.userId)}
                  >
                    {r.userAvatarUrl ? (
                      <img className="bt-wall__avatar" src={r.userAvatarUrl} alt="" draggable={false} />
                    ) : (
                      <span className="bt-wall__avatar bt-wall__avatar--letter">
                        {(r.userName || '?').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="bt-wall__name">{r.userName}</span>
                  </span>
                )}
                <span className="bt-wall__time">{relativeTime(r.ts)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

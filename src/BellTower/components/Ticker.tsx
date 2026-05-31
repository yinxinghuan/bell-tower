// Top ticker: faint floating row of recent ringers. Each chip is the user's
// avatar + name + "x min ago". The strip drifts gently right-to-left.

import './Ticker.less';
import type { WallToll } from '../types';
import { relativeTime, t } from '../i18n';
import { isInAigram, openAigramProfile } from '@shared/runtime';

export type TickerProps = {
  entries: WallToll[];
  onOpenWall: () => void;
};

export default function Ticker({ entries, onOpenWall }: TickerProps) {
  return (
    <button className="bt-ticker" onClick={onOpenWall} aria-label="open wall">
      {entries.length === 0 ? (
        <span className="bt-ticker__empty">{t('ticker.empty')}</span>
      ) : (
        <div className="bt-ticker__strip">
          {entries.slice(0, 6).map((e, i) => (
            <span
              key={e.id + i}
              className="bt-ticker__chip"
              role="button"
              onClick={(ev) => {
                ev.stopPropagation();
                if (isInAigram) openAigramProfile(e.userId);
              }}
            >
              {e.userAvatarUrl ? (
                <img className="bt-ticker__avatar" src={e.userAvatarUrl} alt="" draggable={false} />
              ) : (
                <span className="bt-ticker__avatar bt-ticker__avatar--letter">
                  {(e.userName || '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="bt-ticker__name">{e.userName}</span>
              <span className="bt-ticker__time">{relativeTime(e.ts)}</span>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

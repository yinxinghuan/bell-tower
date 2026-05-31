type Locale = 'en' | 'zh';

const STR: Record<Locale, Record<string, string>> = {
  en: {
    'app.name': 'THE BELL TOWER',
    'app.sub': 'once a day',
    'hint.pull': 'pull the rope',
    'state.rung_today': 'you have rung today',
    'state.come_back': 'come back tomorrow',
    'stats.today_one': 'one ring across the world today',
    'stats.today_many': '{n} rings across the world today',
    'stats.today_loading': 'listening for today\'s rings…',
    'milestone.hit': 'the tower rang for the world today',
    'milestone.progress': '{n} / {goal} today',
    'ticker.empty': 'the rope is still',
    'wall.title': "today's tolls",
    'wall.empty': 'no rings yet today — be the first',
    'wall.you': 'YOU',
    'wall.by': 'rang by',
    'sheet.close': 'close',
    'time.just_now': 'just now',
    'time.mins_ago': '{n} min ago',
    'time.hours_ago': '{n} h ago',
    'mute.on': 'sound',
    'mute.off': 'muted',
  },
  zh: {
    'app.name': '钟楼',
    'app.sub': '一日一鸣',
    'hint.pull': '拉一下绳',
    'state.rung_today': '你今天已经敲过了',
    'state.come_back': '明天再来',
    'stats.today_one': '今天全世界响过 1 次',
    'stats.today_many': '今天全世界响过 {n} 次',
    'stats.today_loading': '正在听今日的钟声…',
    'milestone.hit': '今天钟楼为整个世界敲了一下',
    'milestone.progress': '{n} / {goal} 今日',
    'ticker.empty': '绳子还静着',
    'wall.title': '今日的钟声',
    'wall.empty': '今天还没有人敲 · 来当第一个',
    'wall.you': '你',
    'wall.by': '敲钟的人',
    'sheet.close': '关闭',
    'time.just_now': '刚刚',
    'time.mins_ago': '{n} 分钟前',
    'time.hours_ago': '{n} 小时前',
    'mute.on': '有声',
    'mute.off': '静音',
  },
};

function detectLocale(): Locale {
  try {
    const o = localStorage.getItem('bell_tower_locale');
    if (o === 'en' || o === 'zh') return o;
  } catch (_) {}
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let LOCALE: Locale = detectLocale();
export function locale(): Locale { return LOCALE; }

export function t(key: string, vars?: { n?: number | string; goal?: number | string }): string {
  let s = STR[LOCALE][key];
  if (!s) return key;
  if (vars?.n != null) s = s.replace('{n}', String(vars.n));
  if (vars?.goal != null) s = s.replace('{goal}', String(vars.goal));
  return s;
}

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('time.just_now');
  if (mins < 60) return t('time.mins_ago', { n: mins });
  return t('time.hours_ago', { n: Math.floor(mins / 60) });
}

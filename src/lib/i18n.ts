import { LanguageCode } from '../types';

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    'header.tagline': 'ORBITAL RADIO TELEMETRY',
    'header.count': '{{stations}} STATIONS · {{countries}} REGIONS',
    'search.placeholder': 'Search stations, genres, artists, countries… ( / )',
    'search.genres': 'GENRES',
    'search.artists': 'ARTISTS BY GENRE',
    'search.countries': 'COUNTRIES & TERRITORIES',
    'search.regions': 'CITIES & REGIONS',
    'search.stations': 'BROADCAST STATIONS',
    'search.liveResults': 'LIVE RADIO-BROWSER FEED',
    'search.noResults': 'No matching stations found',
    'search.showAll': 'Inspect all {{count}} matching stations →',
    'search.clearFilters': 'Reset',
    'library.button': 'Saved',
    'library.favorites': 'Starred',
    'library.recent': 'History',
    'library.emptyFavorites': 'Star any station to pin it to your orbital deck.',
    'library.emptyRecent': 'Stations you tune into will be logged here.',
    'player.idleHint': 'Select any telemetry node on the globe or launch a random hop',
    'player.SurpriseMe': 'Random Hop',
    'player.nearMe': 'Near Me',
    'player.locating': 'Locating…',
    'player.loading': 'LOCKING SIGNAL…',
    'player.error': 'CARRIER LOST — TRY NEXT NODE',
    'player.play': 'Play',
    'player.pause': 'Pause',
    'player.previous': 'Previous node',
    'player.next': 'Nearest node',
    'player.locate': 'Lock camera on station',
    'player.favorite': 'Star station',
    'player.share': 'Copy station link',
    'player.copied': 'COPIED',
    'player.minimize': 'Collapse deck',
    'player.expand': 'Expand deck',
    'mode.globe': '3D Globe',
    'mode.immersive': 'Shader Studio',
    'immersive.preset': 'Shader',
    'immersive.exitHint': 'Press Esc to return to 3D Globe',
    'settings.title': 'System Config',
    'settings.language': 'Language',
    'settings.globeView': 'Surface Mode',
    'settings.realistic': 'SAT',
    'settings.minimal': 'VEC',
    'settings.tuningSound': 'FM Static SFX',
    'settings.screensaver': 'Auto-Shader Idle',
    'settings.quality': 'Render Tier',
    'place.explore': 'Field Notes · {{place}}',
    'place.photos': '{{count}} photos',
    'place.readMore': 'Wikipedia Dossier',
    'drawer.countryTitle': '{{country}} Directory',
    'drawer.spotTitle': '{{count}} Co-located Transmitters',
    'drawer.searchResults': 'Filtered Nodes ({{count}})',
    'drawer.filterPlaceholder': 'Filter nodes by name, city, or tag…',
    'inspector.tabSignal': 'Signal & Place',
    'inspector.tabDirectory': 'Directory',
    'inspector.tabLibrary': 'Saved',
    'inspector.noSignal': 'No active signal locked. Click any cyan transmitter on the globe or press Random Hop.',
    'inspector.telemetry': 'SIGNAL TELEMETRY',
    'inspector.coordinates': 'COORDINATES',
    'inspector.localTime': 'LOCAL TIME',
    'inspector.streamSpec': 'STREAM SPEC',
    'inspector.placeStory': 'DESTINATION BRIEFING',
    'quick.jazz': 'Jazz',
    'quick.electronic': 'Electronic',
    'quick.classical': 'Classical',
    'quick.ambient': 'Ambient',
    'quick.rock': 'Rock',
    'quick.news': 'News',
    'quick.pop': 'Pop',
    'quick.world': 'World',
  },
  zh: {
    'header.tagline': '全球实时无线电遥测终端',
    'header.count': '{{stations}} 电台节点 · {{countries}} 国家/地区',
    'search.placeholder': '搜索电台、流派、音乐人、国家或城市… ( / )',
    'search.genres': '音乐流派',
    'search.artists': '关联音乐人',
    'search.countries': '国家与地区',
    'search.regions': '城市与州省',
    'search.stations': '广播电台',
    'search.liveResults': '实时 Radio-Browser 检索',
    'search.noResults': '未找到匹配的广播节点',
    'search.showAll': '查看全部 {{count}} 个匹配电台 →',
    'search.clearFilters': '重置筛选',
    'library.button': '电台库',
    'library.favorites': '星标收藏',
    'library.recent': '收听足迹',
    'library.emptyFavorites': '点击星标即可将电台固定至个人观测台。',
    'library.emptyRecent': '您调频收听过的电台将自动记录在此。',
    'player.idleHint': '点击地球上的青色信标，或启动「随机漫游」探索世界电波',
    'player.SurpriseMe': '随机漫游',
    'player.nearMe': '附近电台',
    'player.locating': '定位中…',
    'player.loading': '正在锁定电波信号…',
    'player.error': '信号中断 — 请尝试切换相邻节点',
    'player.play': '播放',
    'player.pause': '暂停',
    'player.previous': '上一节点',
    'player.next': '邻近电台',
    'player.locate': '镜头锁定当前电台',
    'player.favorite': '星标收藏',
    'player.share': '复制分享链接',
    'player.copied': '已复制',
    'player.minimize': '收起控制台',
    'player.expand': '展开控制台',
    'mode.globe': '3D 地球',
    'mode.immersive': '光影律动',
    'immersive.preset': '着色器',
    'immersive.exitHint': '按 Esc 返回 3D 地球',
    'settings.title': '终端设置',
    'settings.language': '界面语言',
    'settings.globeView': '地表渲染',
    'settings.realistic': '卫星遥感',
    'settings.minimal': '极简矢量',
    'settings.tuningSound': '调频白噪音效',
    'settings.screensaver': '空闲自动光影屏保',
    'settings.quality': '渲染画质',
    'place.explore': '人文地志 · {{place}}',
    'place.photos': '{{count}} 张影像',
    'place.readMore': '阅读维基百科词条',
    'drawer.countryTitle': '{{country}} 电台名录',
    'drawer.spotTitle': '当前坐标共 {{count}} 个频段',
    'drawer.searchResults': '检索结果 ({{count}})',
    'drawer.filterPlaceholder': '按台名、城市或流派二次筛选…',
    'inspector.tabSignal': '信号与人文',
    'inspector.tabDirectory': '频段名录',
    'inspector.tabLibrary': '收藏与足迹',
    'inspector.noSignal': '暂未锁定电波信号。请点击地球上的青色节点或点击「随机漫游」。',
    'inspector.telemetry': '实时信号遥测',
    'inspector.coordinates': '地理坐标',
    'inspector.localTime': '当地时间',
    'inspector.streamSpec': '音频编码',
    'inspector.placeStory': '所在地人文地志',
    'quick.jazz': '爵士 Jazz',
    'quick.electronic': '电子 Electro',
    'quick.classical': '古典 Classical',
    'quick.ambient': '氛围 Ambient',
    'quick.rock': '摇滚 Rock',
    'quick.news': '资讯 News',
    'quick.pop': '流行 Pop',
    'quick.world': '世界 World',
  },
};

export function t(
  lang: LanguageCode,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  let template = dict[key] ?? TRANSLATIONS.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return template;
}

export function countryCodeToFlag(cc: string): string {
  if (!cc || cc.length !== 2) return '🌐';
  const upper = cc.toUpperCase();
  const c1 = upper.charCodeAt(0);
  const c2 = upper.charCodeAt(1);
  if (c1 < 65 || c1 > 90 || c2 < 65 || c2 > 90) return '🌐';
  return String.fromCodePoint(127397 + c1, 127397 + c2);
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

export function getCountryName(cc: string, lang: LanguageCode = 'en'): string {
  if (!cc) return 'Unknown';
  const upper = cc.toUpperCase();
  try {
    let dn = displayNamesCache.get(lang);
    if (!dn) {
      const localeTag = lang === 'zh' ? 'zh-CN' : 'en';
      dn = new Intl.DisplayNames([localeTag, 'en'], { type: 'region' });
      displayNamesCache.set(lang, dn);
    }
    return dn.of(upper) || upper;
  } catch {
    return upper;
  }
}

export function formatCoords(lat: number, lng: number): string {
  if (lat === 0 && lng === 0) return 'ORBITAL CLUSTER';
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lng).toFixed(2)}°${ew}`;
}

export function formatStationLocalTime(timezone: string, now: Date = new Date()): {
  formatted: string;
  isNight: boolean;
} | null {
  if (!timezone) return null;
  try {
    const formatted = new Intl.DateTimeFormat([], {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(now);
    const hourParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hourStr = hourParts.find((p) => p.type === 'hour')?.value ?? '12';
    const hour = Number.parseInt(hourStr, 10) % 24;
    const isNight = hour < 6 || hour >= 19;
    return { formatted, isNight };
  } catch {
    return null;
  }
}

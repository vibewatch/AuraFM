import { LanguageCode } from '../types';

export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {
  en: {
    'header.tagline': 'Spin the globe, tune in to the world',
    'header.count': '{{stations}} stations · {{countries}} countries',
    'search.placeholder': 'Search stations, genres, artists, countries…',
    'search.genres': 'Genres',
    'search.artists': 'Artists (by genre)',
    'search.countries': 'Countries',
    'search.regions': 'Cities & Regions',
    'search.stations': 'Stations',
    'search.liveResults': 'Live Radio-Browser results',
    'search.noResults': 'No matching stations found',
    'search.showAll': 'Show all {{count}} matching stations',
    'search.clearFilters': 'Clear all',
    'library.button': 'Your stations',
    'library.favorites': 'Favorites',
    'library.recent': 'Recent',
    'library.emptyFavorites': 'Heart any station while listening to save it here.',
    'library.emptyRecent': 'Stations you tune into will appear here.',
    'player.idleHint': 'Click a cyan dot on the globe or roll the dice to start listening',
    'player.SurpriseMe': 'Surprise me',
    'player.loading': 'Tuning stream…',
    'player.error': 'Stream offline — try next station',
    'player.play': 'Play',
    'player.pause': 'Pause',
    'player.previous': 'Previous station',
    'player.next': 'Next nearest station',
    'player.locate': 'Center on globe',
    'player.favorite': 'Save to favorites',
    'player.share': 'Copy share link',
    'player.copied': 'Link copied!',
    'player.minimize': 'Minimize player',
    'player.expand': 'Expand player',
    'mode.globe': 'Globe',
    'mode.immersive': 'Immersive',
    'immersive.preset': 'Visual preset',
    'immersive.exitHint': 'Press Esc or click anywhere to show controls',
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.globeView': 'Globe view',
    'settings.realistic': 'Realistic',
    'settings.minimal': 'Minimal',
    'settings.tuningSound': 'Tuning static sound',
    'settings.screensaver': 'Auto-immersive screensaver',
    'settings.quality': 'Graphics quality',
    'place.explore': 'Explore {{place}}',
    'place.photos': '{{count}} photos',
    'place.readMore': 'Read on Wikipedia',
    'drawer.countryTitle': 'Stations in {{country}}',
    'drawer.spotTitle': '{{count}} stations at this location',
    'drawer.searchResults': 'Matching stations ({{count}})',
    'drawer.filterPlaceholder': 'Filter this list…',
  },
  pt: {
    'header.tagline': 'Gire o globo, sintonize o mundo',
    'header.count': '{{stations}} estações · {{countries}} países',
    'search.placeholder': 'Buscar estações, gêneros, artistas, países…',
    'search.genres': 'Gêneros',
    'search.artists': 'Artistas (por gênero)',
    'search.countries': 'Países',
    'search.regions': 'Cidades e Regiões',
    'search.stations': 'Estações',
    'search.liveResults': 'Resultados ao vivo',
    'search.noResults': 'Nenhuma estação encontrada',
    'search.showAll': 'Ver todas as {{count}} estações',
    'search.clearFilters': 'Limpar tudo',
    'library.button': 'Suas estações',
    'library.favorites': 'Favoritas',
    'library.recent': 'Recentes',
    'library.emptyFavorites': 'Marque qualquer estação com coração para salvá-la aqui.',
    'library.emptyRecent': 'As estações que você ouvir aparecerão aqui.',
    'player.idleHint': 'Clique em um ponto no globo ou jogue os dados para ouvir',
    'player.SurpriseMe': 'Surpreenda-me',
    'player.loading': 'Sintonizando…',
    'player.error': 'Transmissão indisponível — tente a próxima',
    'player.play': 'Reproduzir',
    'player.pause': 'Pausar',
    'player.previous': 'Estação anterior',
    'player.next': 'Próxima estação mais próxima',
    'player.locate': 'Centralizar no globo',
    'player.favorite': 'Salvar nos favoritos',
    'player.share': 'Copiar link',
    'player.copied': 'Link copiado!',
    'player.minimize': 'Minimizar player',
    'player.expand': 'Expandir player',
    'mode.globe': 'Globo',
    'mode.immersive': 'Imersivo',
    'immersive.preset': 'Estilo visual',
    'immersive.exitHint': 'Pressione Esc ou clique para exibir controles',
    'settings.title': 'Configurações',
    'settings.language': 'Idioma',
    'settings.globeView': 'Visual do globo',
    'settings.realistic': 'Realista',
    'settings.minimal': 'Minimalista',
    'settings.tuningSound': 'Chiado de sintonia',
    'settings.screensaver': 'Protetor de tela automático',
    'settings.quality': 'Qualidade gráfica',
    'place.explore': 'Explorar {{place}}',
    'place.photos': '{{count}} fotos',
    'place.readMore': 'Ler na Wikipédia',
    'drawer.countryTitle': 'Estações em {{country}}',
    'drawer.spotTitle': '{{count}} estações neste local',
    'drawer.searchResults': 'Estações encontradas ({{count}})',
    'drawer.filterPlaceholder': 'Filtrar lista…',
  },
  es: {
    'header.tagline': 'Gira el globo, sintoniza el mundo',
    'header.count': '{{stations}} emisoras · {{countries}} países',
    'search.placeholder': 'Buscar emisoras, géneros, artistas, países…',
    'search.genres': 'Géneros',
    'search.artists': 'Artistas (por género)',
    'search.countries': 'Países',
    'search.regions': 'Ciudades y Regiones',
    'search.stations': 'Emisoras',
    'search.liveResults': 'Resultados en vivo',
    'search.noResults': 'No se encontraron emisoras',
    'search.showAll': 'Mostrar las {{count}} emisoras',
    'search.clearFilters': 'Limpiar todo',
    'library.button': 'Tus emisoras',
    'library.favorites': 'Favoritas',
    'library.recent': 'Recientes',
    'library.emptyFavorites': 'Guarda cualquier emisora con el corazón para verla aquí.',
    'library.emptyRecent': 'Las emisoras que escuches aparecerán aquí.',
    'player.idleHint': 'Haz clic en un punto del globo o tira el dado para empezar',
    'player.SurpriseMe': 'Sorpréndeme',
    'player.loading': 'Sintonizando…',
    'player.error': 'Emisora fuera de línea — prueba la siguiente',
    'player.play': 'Reproducir',
    'player.pause': 'Pausar',
    'player.previous': 'Emisora anterior',
    'player.next': 'Siguiente emisora más cercana',
    'player.locate': 'Centrar en el globo',
    'player.favorite': 'Guardar en favoritos',
    'player.share': 'Copiar enlace',
    'player.copied': '¡Enlace copiado!',
    'player.minimize': 'Minimizar reproductor',
    'player.expand': 'Expandir reproductor',
    'mode.globe': 'Globo',
    'mode.immersive': 'Inmersivo',
    'immersive.preset': 'Estilo visual',
    'immersive.exitHint': 'Pulsa Esc o haz clic para mostrar controles',
    'settings.title': 'Ajustes',
    'settings.language': 'Idioma',
    'settings.globeView': 'Vista del globo',
    'settings.realistic': 'Realista',
    'settings.minimal': 'Minimalista',
    'settings.tuningSound': 'Sonido de sintonización',
    'settings.screensaver': 'Protector de pantalla automático',
    'settings.quality': 'Calidad gráfica',
    'place.explore': 'Explorar {{place}}',
    'place.photos': '{{count}} fotos',
    'place.readMore': 'Leer en Wikipedia',
    'drawer.countryTitle': 'Emisoras en {{country}}',
    'drawer.spotTitle': '{{count}} emisoras en esta ubicación',
    'drawer.searchResults': 'Emisoras encontradas ({{count}})',
    'drawer.filterPlaceholder': 'Filtrar lista…',
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
      dn = new Intl.DisplayNames([lang, 'en'], { type: 'region' });
      displayNamesCache.set(lang, dn);
    }
    return dn.of(upper) || upper;
  } catch {
    return upper;
  }
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

import { LanguageCode, PlaceInfo, StationSummary, WikiPhoto } from '../types';
import { getCountryName } from './i18n';

const placeCache = new Map<string, PlaceInfo | null>();

async function fetchWikiSummary(title: string, lang: LanguageCode): Promise<{
  title: string;
  description?: string;
  extract: string;
  articleUrl: string;
  thumbnailUrl?: string;
  originalUrl?: string;
} | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === 'disambiguation' || !data.extract) return null;
    return {
      title: data.title,
      description: data.description,
      extract: data.extract,
      articleUrl:
        data.content_urls?.desktop?.page ||
        `https://${lang}.wikipedia.org/wiki/${encoded}`,
      thumbnailUrl: data.thumbnail?.source,
      originalUrl: data.originalimage?.source || data.thumbnail?.source,
    };
  } catch {
    return null;
  }
}

async function fetchGeoTitle(lat: number, lng: number, lang: LanguageCode): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'geosearch',
      gscoord: `${lat}|${lng}`,
      gsradius: '10000',
      gslimit: '5',
      format: 'json',
      origin: '*',
    });
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const list = data?.query?.geosearch;
    if (Array.isArray(list) && list.length > 0) {
      return list[0].title as string;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchCommonsPhotos(query: string): Promise<WikiPhoto[]> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${query}`,
      gsrnamespace: '6',
      gsrlimit: '8',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|dimensions',
      iiurlwidth: '960',
      format: 'json',
      origin: '*',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    const photos: WikiPhoto[] = [];

    for (const p of pages as Record<string, any>[]) {
      const info = p?.imageinfo?.[0];
      if (!info?.url || !info?.thumburl) continue;
      const lowerUrl = String(info.url).toLowerCase();
      if (lowerUrl.endsWith('.svg') || lowerUrl.includes('map') || lowerUrl.includes('flag') || lowerUrl.includes('logo')) {
        continue;
      }
      if (info.width && info.height && info.width < 500) continue;

      const meta = info.extmetadata || {};
      const stripHtml = (s?: string) => (s ? s.replace(/<[^>]*>/g, '').trim() : undefined);

      photos.push({
        url: info.thumburl || info.url,
        thumbUrl: info.thumburl || info.url,
        caption: stripHtml(meta.ImageDescription?.value) || stripHtml(meta.ObjectName?.value),
        author: stripHtml(meta.Artist?.value),
        license: stripHtml(meta.LicenseShortName?.value),
        descriptionUrl: info.descriptionurl,
      });
      if (photos.length >= 6) break;
    }
    return photos;
  } catch {
    return [];
  }
}

export async function loadPlaceInfo(
  station: StationSummary,
  lang: LanguageCode
): Promise<PlaceInfo | null> {
  const countryName = getCountryName(station.countryCode, lang);
  const countryNameEn = getCountryName(station.countryCode, 'en');
  const cacheKey = `${lang}:${station.countryCode}:${station.region || ''}:${
    station.precise ? `${station.lat.toFixed(2)},${station.lng.toFixed(2)}` : 'country'
  }`;

  if (placeCache.has(cacheKey)) {
    return placeCache.get(cacheKey) ?? null;
  }

  let candidateTitle: string | null = null;
  if (station.region && station.region.length >= 2) {
    candidateTitle = `${station.region}, ${countryName}`;
  } else if (station.precise) {
    candidateTitle = await fetchGeoTitle(station.lat, station.lng, lang);
  }

  let summary = candidateTitle ? await fetchWikiSummary(candidateTitle, lang) : null;
  if (!summary && station.region) {
    summary = await fetchWikiSummary(station.region, lang);
  }
  if (!summary) {
    summary = await fetchWikiSummary(countryName, lang);
  }
  if (!summary && lang !== 'en') {
    summary = await fetchWikiSummary(countryNameEn, 'en');
  }
  if (!summary) {
    placeCache.set(cacheKey, null);
    return null;
  }

  const photoQuery =
    station.region && station.region.length > 2
      ? `${station.region} ${countryNameEn} landscape architecture`
      : `${countryNameEn} landscape city`;
  const commonsPhotos = await fetchCommonsPhotos(photoQuery);

  const photos: WikiPhoto[] = [];
  if (summary.originalUrl) {
    photos.push({
      url: summary.originalUrl,
      thumbUrl: summary.thumbnailUrl || summary.originalUrl,
      caption: summary.description || summary.title,
      descriptionUrl: summary.articleUrl,
    });
  }
  for (const cp of commonsPhotos) {
    if (!photos.some((p) => p.url === cp.url)) {
      photos.push(cp);
    }
  }

  const result: PlaceInfo = {
    title: summary.title,
    subtitle: summary.description || countryName,
    extract: summary.extract,
    articleUrl: summary.articleUrl,
    photos: photos.slice(0, 6),
  };

  placeCache.set(cacheKey, result);
  return result;
}

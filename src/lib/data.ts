import {
  ArtistEntry,
  FilterChip,
  MetaData,
  StationDetails,
  StationFull,
  StationSummary,
} from '../types';
import { getCountryName } from './i18n';

const BASE = import.meta.env.BASE_URL || './';

function assetUrl(relPath: string): string {
  const cleanBase = BASE.endsWith('/') ? BASE : `${BASE}/`;
  const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  return `${cleanBase}${cleanRel}`;
}

export function getTextureUrl(filename: string): string {
  return assetUrl(`textures/${filename}`);
}

let metaPromise: Promise<MetaData> | null = null;
let stationsPromise: Promise<StationSummary[]> | null = null;
let bordersPromise: Promise<number[][]> | null = null;
let tagsPromise: Promise<[string, number][]> | null = null;
let artistsPromise: Promise<ArtistEntry[]> | null = null;
const detailShardCache = new Map<string, Promise<Record<string, unknown[]>>>();
const liveDetailsCache = new Map<string, StationDetails>();

export function loadMeta(): Promise<MetaData> {
  if (!metaPromise) {
    metaPromise = fetch(assetUrl('data/meta.json')).then((r) => {
      if (!r.ok) throw new Error(`Failed to load meta.json: ${r.status}`);
      return r.json();
    });
  }
  return metaPromise;
}

export function loadBorders(): Promise<number[][]> {
  if (!bordersPromise) {
    bordersPromise = fetch(assetUrl('data/borders.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load borders.json: ${r.status}`);
        return r.json();
      })
      .then((data) => data.lines as number[][]);
  }
  return bordersPromise;
}

export function loadTags(): Promise<[string, number][]> {
  if (!tagsPromise) {
    tagsPromise = fetch(assetUrl('data/tags.json')).then((r) => {
      if (!r.ok) throw new Error(`Failed to load tags.json: ${r.status}`);
      return r.json();
    });
  }
  return tagsPromise;
}

export function loadArtists(): Promise<ArtistEntry[]> {
  if (!artistsPromise) {
    artistsPromise = fetch(assetUrl('data/artists.json')).then((r) => {
      if (!r.ok) throw new Error(`Failed to load artists.json: ${r.status}`);
      return r.json();
    });
  }
  return artistsPromise;
}

export function loadStations(): Promise<StationSummary[]> {
  if (!stationsPromise) {
    stationsPromise = Promise.all([
      fetch(assetUrl('data/stations.json')).then((r) => {
        if (!r.ok) throw new Error(`Failed to load stations.json: ${r.status}`);
        return r.json();
      }),
      fetch(assetUrl('data/regions.json'))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([raw, regionsData]) => {
      const tagTable: string[] = raw.tags ?? [];
      const tzTable: string[] = raw.tz ?? [];
      const rows: unknown[][] = raw.stations ?? [];
      const regionTable: string[] = regionsData?.regions ?? [];
      const regionRows: number[] = regionsData?.rows ?? [];

      return rows.map((row, idx) => {
        const [id, name, countryCode, lat, lng, preciseFlag, tagIndices, votes, tzIdx] = row as [
          string,
          string,
          string,
          number,
          number,
          number,
          number[],
          number,
          number,
        ];
        const rIdx = regionRows[idx];
        const region = rIdx !== undefined && rIdx >= 0 ? regionTable[rIdx] || '' : '';
        return {
          id,
          name,
          countryCode,
          lat,
          lng,
          precise: preciseFlag === 1,
          tags: (tagIndices || []).map((ti) => tagTable[ti]).filter(Boolean),
          votes: votes || 0,
          timezone: tzIdx >= 0 ? tzTable[tzIdx] || '' : '',
          region,
        };
      });
    });
  }
  return stationsPromise;
}

export async function loadStationDetails(stationId: string): Promise<StationDetails | null> {
  const cachedLive = liveDetailsCache.get(stationId);
  if (cachedLive) return cachedLive;

  const prefix = stationId.slice(0, 2).toLowerCase();
  let shardPromise = detailShardCache.get(prefix);
  if (!shardPromise) {
    shardPromise = fetch(assetUrl(`data/details/${prefix}.json`)).then((r) => {
      if (!r.ok) throw new Error(`Failed to load details/${prefix}.json: ${r.status}`);
      return r.json();
    });
    detailShardCache.set(prefix, shardPromise);
  }
  try {
    const shard = await shardPromise;
    const entry = shard[stationId];
    if (!entry) return null;
    const [uuid, url, homepage, favicon, region, codec, bitrate, hls] = entry as [
      string,
      string,
      string,
      string,
      string,
      string,
      number,
      number,
    ];
    return {
      uuid,
      url,
      homepage: homepage || '',
      favicon: favicon || '',
      region: region || '',
      codec: codec || '',
      bitrate: bitrate || 0,
      hls: hls === 1,
    };
  } catch {
    return null;
  }
}

export async function resolveFullStation(station: StationSummary): Promise<StationFull | null> {
  const details = await loadStationDetails(station.id);
  if (!details) return null;
  return {
    ...station,
    ...details,
    region: details.region || station.region || '',
  };
}

/**
 * Live search fallback against Radio-Browser API for stations not in the static snapshot.
 */
export async function searchLiveRadioBrowser(
  query: string,
  signal?: AbortSignal
): Promise<StationSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const params = new URLSearchParams({
    name: trimmed,
    limit: '20',
    hidebroken: 'true',
    order: 'votes',
    reverse: 'true',
  });
  try {
    const res = await fetch(`https://all.api.radio-browser.info/json/stations/search?${params}`, {
      signal,
    });
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];

    const results: StationSummary[] = [];
    for (const item of items) {
      const url = (item.url_resolved || item.url || '').trim();
      if (!url.startsWith('https://')) continue;
      const id = `rb_${String(item.stationuuid || '').replace(/-/g, '').slice(0, 12)}`;
      const lat = typeof item.geo_lat === 'number' ? item.geo_lat : 0;
      const lng = typeof item.geo_long === 'number' ? item.geo_long : 0;
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
      const tags = String(item.tags || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);

      liveDetailsCache.set(id, {
        uuid: item.stationuuid || id,
        url,
        homepage: item.homepage || '',
        favicon: item.favicon && String(item.favicon).startsWith('https://') ? item.favicon : '',
        region: item.state || '',
        codec: item.codec || '',
        bitrate: item.bitrate || 0,
        hls: item.hls === 1,
      });

      results.push({
        id,
        name: String(item.name || '').trim() || 'Live Radio',
        countryCode: String(item.countrycode || 'XX').toUpperCase(),
        lat: hasCoords ? lat : 0,
        lng: hasCoords ? lng : 0,
        precise: hasCoords,
        tags,
        votes: item.votes || 0,
        timezone: '',
        region: item.state || '',
      });
    }
    return results;
  } catch {
    return [];
  }
}

export function reportStationClick(uuid: string): void {
  if (!uuid || uuid.startsWith('rb_')) return;
  fetch(`https://all.api.radio-browser.info/json/url/${uuid}`, { method: 'GET' }).catch(() => {});
}

export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function filterStationsByChips(
  stations: StationSummary[],
  chips: FilterChip[]
): StationSummary[] {
  if (chips.length === 0) return stations;
  return stations.filter((st) =>
    chips.every((chip) => {
      if (chip.type === 'genre') {
        return st.tags.includes(chip.tag);
      }
      if (chip.type === 'artist') {
        return chip.tags.some((t) => st.tags.includes(t));
      }
      return true;
    })
  );
}

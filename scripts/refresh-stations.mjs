#!/usr/bin/env node
/**
 * Daily Radio-Browser Station Snapshot Builder
 * Fetches HTTPS-compatible live stations from Radio-Browser API and compiles:
 * - public/data/meta.json
 * - public/data/stations.json
 * - public/data/tags.json
 * - public/data/regions.json
 * - public/data/details/<00..ff>.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const API_URL =
  'https://all.api.radio-browser.info/json/stations/search?limit=25000&hidebroken=true&order=votes&reverse=true&is_https=true';

async function main() {
  console.log('Fetching stations from Radio-Browser API...');
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'GeoRadios-Static-Builder/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rawStations = await res.json();
  console.log(`Received ${rawStations.length} raw stations.`);

  const tagCounts = new Map();
  const tagIndexMap = new Map();
  const tagList = [];
  const tzList = [];
  const tzIndexMap = new Map();
  const regionList = [];
  const regionIndexMap = new Map();

  const stationsRows = [];
  const regionRows = [];
  const shards = new Map();
  for (let i = 0; i < 256; i++) {
    shards.set(i.toString(16).padStart(2, '0'), {});
  }

  const seenIds = new Set();
  const countrySet = new Set();
  let preciseCount = 0;

  for (const item of rawStations) {
    const url = String(item.url_resolved || item.url || '').trim();
    if (!url.startsWith('https://')) continue;
    const uuid = String(item.stationuuid || '').trim();
    const id = uuid.replace(/-/g, '').slice(0, 10).toLowerCase();
    if (id.length < 10 || seenIds.has(id)) continue;
    seenIds.add(id);

    const cc = String(item.countrycode || '').toUpperCase();
    if (cc.length !== 2) continue;
    countrySet.add(cc);

    const hasGeo =
      typeof item.geo_lat === 'number' &&
      typeof item.geo_long === 'number' &&
      (item.geo_lat !== 0 || item.geo_long !== 0);
    if (hasGeo) preciseCount++;

    const rawTags = String(item.tags || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length >= 2 && s.length <= 28)
      .slice(0, 8);

    const tagIndices = [];
    for (const tg of rawTags) {
      tagCounts.set(tg, (tagCounts.get(tg) || 0) + 1);
      let idx = tagIndexMap.get(tg);
      if (idx === undefined) {
        idx = tagList.length;
        tagList.push(tg);
        tagIndexMap.set(tg, idx);
      }
      tagIndices.push(idx);
    }

    const region = String(item.state || '').trim();
    let rIdx = -1;
    if (region) {
      rIdx = regionIndexMap.get(region);
      if (rIdx === undefined) {
        rIdx = regionList.length;
        regionList.push(region);
        regionIndexMap.set(region, rIdx);
      }
    }

    const tz = '';
    const tzIdx = tz ? tzIndexMap.get(tz) ?? -1 : -1;

    stationsRows.push([
      id,
      String(item.name || '').trim(),
      cc,
      hasGeo ? Number(item.geo_lat.toFixed(4)) : 0,
      hasGeo ? Number(item.geo_long.toFixed(4)) : 0,
      hasGeo ? 1 : 0,
      tagIndices,
      Number(item.votes || 0),
      tzIdx,
    ]);
    regionRows.push(rIdx);

    const prefix = id.slice(0, 2);
    const shard = shards.get(prefix);
    if (shard) {
      shard[id] = [
        uuid,
        url,
        String(item.homepage || '').trim(),
        String(item.favicon || '').startsWith('https://') ? String(item.favicon).trim() : '',
        region,
        String(item.codec || '').toUpperCase(),
        Number(item.bitrate || 0),
        item.hls === 1 ? 1 : 0,
      ];
    }
  }

  const outDir = path.resolve(process.cwd(), 'public/data');
  await fs.mkdir(path.join(outDir, 'details'), { recursive: true });

  await fs.writeFile(
    path.join(outDir, 'meta.json'),
    JSON.stringify({
      v: 1,
      generatedAt: new Date().toISOString(),
      stations: stationsRows.length,
      precise: preciseCount,
      countries: countrySet.size,
    })
  );

  await fs.writeFile(
    path.join(outDir, 'stations.json'),
    JSON.stringify({
      v: 1,
      tags: tagList,
      tz: tzList,
      stations: stationsRows,
    })
  );

  await fs.writeFile(
    path.join(outDir, 'regions.json'),
    JSON.stringify({
      v: 1,
      regions: regionList,
      rows: regionRows,
    })
  );

  const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);
  await fs.writeFile(path.join(outDir, 'tags.json'), JSON.stringify(sortedTags));

  for (const [prefix, data] of shards.entries()) {
    await fs.writeFile(path.join(outDir, 'details', `${prefix}.json`), JSON.stringify(data));
  }

  console.log(
    `Done! Wrote ${stationsRows.length} stations (${preciseCount} precise) across ${countrySet.size} countries.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

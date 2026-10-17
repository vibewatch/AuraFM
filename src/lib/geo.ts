import * as THREE from 'three';
import { CountryCluster, StationSummary } from '../types';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Convert geographic latitude/longitude (in degrees) to 3D Cartesian coordinates on a sphere of radius `r`.
 * AuraFM spherical coordinate convention:
 * phi = (90 - lat) * DEG2RAD
 * theta = (lng + 180) * DEG2RAD
 * x = -r * sin(phi) * cos(theta)
 * y = r * cos(phi)
 * z = r * sin(phi) * sin(theta)
 */
export function latLngToVec3(lat: number, lng: number, radius = 1): [number, number, number] {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  return [
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  ];
}

export function vec3ToLatLng(x: number, y: number, z: number): { lat: number; lng: number } {
  const r = Math.hypot(x, y, z) || 1;
  const ny = Math.max(-1, Math.min(1, y / r));
  const lat = 90 - Math.acos(ny) * RAD2DEG;
  const theta = Math.atan2(z, -x);
  let lng = theta * RAD2DEG - 180;
  if (lng < -180) lng += 360;
  if (lng > 180) lng -= 360;
  return { lat, lng };
}

/**
 * Great-circle angular distance in radians between two lat/lng points.
 */
export function haversineRad(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLng = (lng2 - lng1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * Spherical linear interpolation between two 3D vectors on the unit sphere.
 */
export function slerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-5) return a;
  const sinOmega = Math.sin(omega);
  const wA = Math.sin((1 - t) * omega) / sinOmega;
  const wB = Math.sin(t * omega) / sinOmega;
  return [a[0] * wA + b[0] * wB, a[1] * wA + b[1] * wB, a[2] * wA + b[2] * wB];
}

/**
 * Compute elevated 3D geodesic flight arc points between two geographic coordinates.
 */
export function buildArcPoints(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  segments = 64
): [number, number, number][] {
  const uA = latLngToVec3(from.lat, from.lng, 1);
  const uB = latLngToVec3(to.lat, to.lng, 1);
  const dot = Math.max(-1, Math.min(1, uA[0] * uB[0] + uA[1] * uB[1] + uA[2] * uB[2]));
  const angle = Math.acos(dot);
  const maxHeight = Math.min(0.35, (angle / Math.PI) * 0.35);
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = slerpVec3(uA, uB, t);
    const r = 1.003 + Math.sin(t * Math.PI) * maxHeight;
    points.push([u[0] * r, u[1] * r, u[2] * r]);
  }
  return points;
}

/**
 * Real-time subsolar point & normalized sun direction vector in globe coordinates.
 */
export function getSunDirection(date: Date = new Date()): THREE.Vector3 {
  const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
    Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (date.getUTCHours() - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const subsolarLat = declRad * RAD2DEG;
  const utcMinutes =
    date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let subsolarLng = (720 - utcMinutes - eqTime) / 4;
  subsolarLng = ((((subsolarLng + 180) % 360) + 360) % 360) - 180;
  const [x, y, z] = latLngToVec3(subsolarLat, subsolarLng, 1);
  return new THREE.Vector3(x, y, z).normalize();
}

/**
 * 2-degree spatial hash grid for fast O(1) picking of precise stations and country clusters on the globe.
 */
export class SpatialGrid {
  private cellDeg: number;
  private stationCells = new Map<string, number[]>();
  private stations: StationSummary[];
  private clusters: CountryCluster[];

  constructor(stations: StationSummary[], clusters: CountryCluster[], cellDeg = 2) {
    this.cellDeg = cellDeg;
    this.stations = stations;
    this.clusters = clusters;
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i];
      const key = this.cellKey(s.lat, s.lng);
      let bucket = this.stationCells.get(key);
      if (!bucket) {
        bucket = [];
        this.stationCells.set(key, bucket);
      }
      bucket.push(i);
    }
  }

  private cellKey(lat: number, lng: number): string {
    return `${Math.floor((lat + 90) / this.cellDeg)}:${Math.floor((lng + 180) / this.cellDeg)}`;
  }

  findStationsNear(
    lat: number,
    lng: number,
    maxDeg: number,
    allowedSet?: Set<string> | null
  ): { station: StationSummary; index: number; distanceRad: number }[] {
    const cellSpan = Math.ceil(maxDeg / this.cellDeg);
    const baseRow = Math.floor((lat + 90) / this.cellDeg);
    const baseCol = Math.floor((lng + 180) / this.cellDeg);
    const totalCols = Math.ceil(360 / this.cellDeg);
    const maxRad = maxDeg * DEG2RAD;
    const candidates: { station: StationSummary; index: number; distanceRad: number }[] = [];

    for (let r = baseRow - cellSpan; r <= baseRow + cellSpan; r++) {
      for (let c = baseCol - cellSpan; c <= baseCol + cellSpan; c++) {
        const wrappedCol = ((c % totalCols) + totalCols) % totalCols;
        const bucket = this.stationCells.get(`${r}:${wrappedCol}`);
        if (!bucket) continue;
        for (const idx of bucket) {
          const st = this.stations[idx];
          if (allowedSet && !allowedSet.has(st.id)) continue;
          const dist = haversineRad(lat, lng, st.lat, st.lng);
          if (dist <= maxRad) {
            candidates.push({ station: st, index: idx, distanceRad: dist });
          }
        }
      }
    }
    candidates.sort((a, b) => a.distanceRad - b.distanceRad);
    return candidates;
  }

  findClusterNear(
    lat: number,
    lng: number,
    maxDeg: number,
    allowedSet?: Set<string> | null
  ): { cluster: CountryCluster; index: number; distanceRad: number } | null {
    const maxRad = maxDeg * DEG2RAD;
    let best: { cluster: CountryCluster; index: number; distanceRad: number } | null = null;
    for (let i = 0; i < this.clusters.length; i++) {
      const cl = this.clusters[i];
      if (allowedSet && !cl.stations.some((s) => allowedSet.has(s.id))) continue;
      const dist = haversineRad(lat, lng, cl.lat, cl.lng);
      if (dist <= maxRad && (!best || dist < best.distanceRad)) {
        best = { cluster: cl, index: i, distanceRad: dist };
      }
    }
    return best;
  }
}

/**
 * Group non-precise stations by countryCode and compute their geographic centroids.
 */
export function buildCountryClusters(allStations: StationSummary[]): CountryCluster[] {
  const preciseCoordsByCountry = new Map<string, { latSum: number; lngSum: number; count: number }>();
  const nonPreciseByCountry = new Map<string, StationSummary[]>();

  for (const s of allStations) {
    if (s.precise) {
      const prev = preciseCoordsByCountry.get(s.countryCode) ?? { latSum: 0, lngSum: 0, count: 0 };
      prev.latSum += s.lat;
      prev.lngSum += s.lng;
      prev.count += 1;
      preciseCoordsByCountry.set(s.countryCode, prev);
    } else {
      let list = nonPreciseByCountry.get(s.countryCode);
      if (!list) {
        list = [];
        nonPreciseByCountry.set(s.countryCode, list);
      }
      list.push(s);
    }
  }

  const clusters: CountryCluster[] = [];
  for (const [countryCode, list] of nonPreciseByCountry.entries()) {
    list.sort((a, b) => b.votes - a.votes);
    const pAvg = preciseCoordsByCountry.get(countryCode);
    const lat = pAvg && pAvg.count > 0 ? pAvg.latSum / pAvg.count : list[0].lat;
    const lng = pAvg && pAvg.count > 0 ? pAvg.lngSum / pAvg.count : list[0].lng;
    clusters.push({
      countryCode,
      lat,
      lng,
      stations: list,
    });
  }
  clusters.sort((a, b) => b.stations.length - a.stations.length);
  return clusters;
}

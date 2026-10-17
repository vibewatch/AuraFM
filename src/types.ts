export type LanguageCode = 'en' | 'zh';
export type GlobeViewMode = 'realistic' | 'minimal';
export type VisualMode = 'globe' | 'immersive';
export type ImmersivePreset = 'waves' | 'dusk' | 'ember' | 'aurora' | 'sculpture';
export type QualityTier = 'auto' | 'low' | 'medium' | 'high';
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type InspectorTab = 'place' | 'directory' | 'library';

export interface MetaData {
  v: number;
  generatedAt: string;
  stations: number;
  precise: number;
  countries: number;
}

export interface StationSummary {
  id: string;
  name: string;
  countryCode: string;
  lat: number;
  lng: number;
  precise: boolean;
  tags: string[];
  votes: number;
  timezone: string;
  region?: string;
}

export interface StationDetails {
  uuid: string;
  url: string;
  homepage: string;
  favicon: string;
  region: string;
  codec: string;
  bitrate: number;
  hls: boolean;
}

export type StationFull = StationSummary & StationDetails;

export interface CountryCluster {
  countryCode: string;
  lat: number;
  lng: number;
  stations: StationSummary[];
}

export interface ArtistEntry {
  name: string;
  tags: string[];
  aliases?: string[];
}

export type FilterChip =
  | {
      id: string;
      type: 'genre';
      label: string;
      tag: string;
    }
  | {
      id: string;
      type: 'artist';
      label: string;
      tags: string[];
    };

export interface FlightArc {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  fullSpin?: boolean;
}

export interface WikiPhoto {
  url: string;
  thumbUrl: string;
  caption?: string;
  author?: string;
  license?: string;
  descriptionUrl?: string;
}

export interface PlaceInfo {
  title: string;
  subtitle?: string;
  extract: string;
  articleUrl: string;
  photos: WikiPhoto[];
}

export interface AudioBands {
  bass: number;
  mid: number;
  high: number;
  volume: number;
  pulse: number;
  isSynthetic: boolean;
  frequencyData?: Uint8Array;
}

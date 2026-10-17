import { create } from 'zustand';
import {
  ArtistEntry,
  CountryCluster,
  FilterChip,
  FlightArc,
  GlobeViewMode,
  ImmersivePreset,
  InspectorTab,
  LanguageCode,
  MetaData,
  PlaceInfo,
  PlaybackStatus,
  QualityTier,
  StationFull,
  StationSummary,
  VisualMode,
} from '../types';
import { audioEngine } from '../lib/audio';
import {
  filterStationsByChips,
  loadArtists,
  loadBorders,
  loadMeta,
  loadStations,
  loadTags,
  reportStationClick,
  resolveFullStation,
} from '../lib/data';
import { buildCountryClusters, haversineRad, SpatialGrid } from '../lib/geo';
import { loadPlaceInfo } from '../lib/wikipedia';

interface PersistedSettings {
  language: LanguageCode;
  globeView: GlobeViewMode;
  visualMode: VisualMode;
  immersivePreset: ImmersivePreset;
  qualityTier: QualityTier;
  tuningSound: boolean;
  screensaver: boolean;
  volume: number;
  muted: boolean;
  playerMinimized: boolean;
}

interface PersistedLibrary {
  favorites: StationSummary[];
  recent: StationSummary[];
}

const SETTINGS_STORAGE_KEY = 'georadios:settings:v1';
const LIBRARY_STORAGE_KEY = 'georadios:library:v1';

function readPersistedSettings(): PersistedSettings {
  const defaults: PersistedSettings = {
    language: 'en',
    globeView: 'realistic',
    visualMode: 'globe',
    immersivePreset: 'waves',
    qualityTier: 'auto',
    tuningSound: true,
    screensaver: false,
    volume: 0.8,
    muted: false,
    playerMinimized: false,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const validLang: LanguageCode =
      parsed.language === 'zh' || parsed.language === 'en' ? parsed.language : 'en';
    return { ...defaults, ...parsed, language: validLang };
  } catch {
    return defaults;
  }
}

function savePersistedSettings(settings: PersistedSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

function readPersistedLibrary(): PersistedLibrary {
  try {
    const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return { favorites: [], recent: [] };
    const parsed = JSON.parse(raw);
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
    };
  } catch {
    return { favorites: [], recent: [] };
  }
}

function savePersistedLibrary(lib: PersistedLibrary): void {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(lib));
  } catch {}
}

export interface AppState extends PersistedSettings, PersistedLibrary {
  // Static datasets
  isLoadingData: boolean;
  meta: MetaData | null;
  allStations: StationSummary[];
  preciseStations: StationSummary[];
  clusters: CountryCluster[];
  borders: number[][];
  tags: [string, number][];
  artists: ArtistEntry[];
  spatialGrid: SpatialGrid | null;

  // Filters
  filterChips: FilterChip[];
  filteredStationIds: Set<string> | null;

  // Player state
  currentStation: StationFull | null;
  playbackStatus: PlaybackStatus;
  historyBackStack: StationSummary[];

  // Camera & Globe interaction
  cameraTarget: {
    lat: number;
    lng: number;
    distance?: number;
    fullSpin?: boolean;
    token: number;
  } | null;
  flightArc: FlightArc | null;

  // Drawers & Inspector Rail
  selectedCountryCode: string | null;
  spotStations: StationSummary[] | null;
  searchDrawerStations: { title: string; stations: StationSummary[] } | null;
  libraryOpen: boolean;
  libraryTab: 'favorites' | 'recent';
  settingsOpen: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;

  // Wikipedia Place Explorer
  placeInfo: PlaceInfo | null;
  placeModalOpen: boolean;

  // Actions
  initialize: () => Promise<void>;
  selectStation: (
    station: StationSummary,
    options?: { pushHistory?: boolean; fullSpin?: boolean; flyTo?: boolean }
  ) => Promise<void>;
  togglePlayPause: () => void;
  playPrevious: () => void;
  playNextNearest: () => void;
  playSurpriseMe: () => void;
  locateCurrentStation: () => void;
  flyToCoords: (lat: number, lng: number, distance?: number, fullSpin?: boolean) => void;

  // Filter actions
  addFilterChip: (chip: FilterChip) => void;
  removeFilterChip: (id: string) => void;
  clearFilterChips: () => void;

  // Library actions
  toggleFavorite: (station: StationSummary) => void;
  isFavorite: (stationId: string) => boolean;

  // UI actions
  setSelectedCountryCode: (cc: string | null) => void;
  setSpotStations: (stations: StationSummary[] | null) => void;
  setSearchDrawerStations: (payload: { title: string; stations: StationSummary[] } | null) => void;
  setLibraryOpen: (open: boolean, tab?: 'favorites' | 'recent') => void;
  setSettingsOpen: (open: boolean) => void;
  setPlaceModalOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean, tab?: InspectorTab) => void;

  // Settings actions
  setLanguage: (lang: LanguageCode) => void;
  setGlobeView: (view: GlobeViewMode) => void;
  setVisualMode: (mode: VisualMode) => void;
  setImmersivePreset: (preset: ImmersivePreset) => void;
  setQualityTier: (tier: QualityTier) => void;
  setTuningSound: (enabled: boolean) => void;
  setScreensaver: (enabled: boolean) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlayerMinimized: (minimized: boolean) => void;
}

const initialSettings = readPersistedSettings();
const initialLibrary = readPersistedLibrary();

export const useAppStore = create<AppState>((set, get) => {
  audioEngine.setVolume(initialSettings.volume, initialSettings.muted);
  audioEngine.setTuningSoundEnabled(initialSettings.tuningSound);
  audioEngine.onStatusChange((status) => {
    set({ playbackStatus: status });
  });

  const persistCurrentSettings = () => {
    const s = get();
    savePersistedSettings({
      language: s.language,
      globeView: s.globeView,
      visualMode: s.visualMode,
      immersivePreset: s.immersivePreset,
      qualityTier: s.qualityTier,
      tuningSound: s.tuningSound,
      screensaver: s.screensaver,
      volume: s.volume,
      muted: s.muted,
      playerMinimized: s.playerMinimized,
    });
  };

  return {
    ...initialSettings,
    ...initialLibrary,

    isLoadingData: true,
    meta: null,
    allStations: [],
    preciseStations: [],
    clusters: [],
    borders: [],
    tags: [],
    artists: [],
    spatialGrid: null,

    filterChips: [],
    filteredStationIds: null,

    currentStation: null,
    playbackStatus: 'idle',
    historyBackStack: [],

    cameraTarget: null,
    flightArc: null,

    selectedCountryCode: null,
    spotStations: null,
    searchDrawerStations: null,
    libraryOpen: false,
    libraryTab: 'favorites',
    settingsOpen: false,
    inspectorOpen: false,
    inspectorTab: 'place',

    placeInfo: null,
    placeModalOpen: false,

    initialize: async () => {
      try {
        const [meta, allStations, borders, tags, artists] = await Promise.all([
          loadMeta(),
          loadStations(),
          loadBorders(),
          loadTags(),
          loadArtists(),
        ]);

        const preciseStations = allStations.filter((s) => s.precise);
        const clusters = buildCountryClusters(allStations);
        const spatialGrid = new SpatialGrid(preciseStations, clusters, 2);

        set({
          meta,
          allStations,
          preciseStations,
          clusters,
          borders,
          tags,
          artists,
          spatialGrid,
          isLoadingData: false,
        });

        // Check URL parameter ?station=<id> for shared deep-link
        const params = new URLSearchParams(window.location.search);
        const sharedId = params.get('station');
        if (sharedId) {
          const found = allStations.find((s) => s.id === sharedId);
          if (found) {
            await get().selectStation(found, { flyTo: true });
          }
        }
      } catch (err) {
        console.error('Failed to initialize GeoRadios data:', err);
        set({ isLoadingData: false });
      }
    },

    selectStation: async (station, options = {}) => {
      const { pushHistory = true, fullSpin = false, flyTo = true } = options;
      const prev = get().currentStation;

      if (pushHistory && prev && prev.id !== station.id) {
        set((state) => ({
          historyBackStack: [prev, ...state.historyBackStack.filter((s) => s.id !== prev.id)].slice(
            0,
            40
          ),
        }));
      }

      // Compute flight arc if transitioning from a previous station
      if (prev && prev.id !== station.id && (prev.lat !== 0 || prev.lng !== 0) && (station.lat !== 0 || station.lng !== 0)) {
        set({
          flightArc: {
            id: `${prev.id}->${station.id}:${Date.now()}`,
            from: { lat: prev.lat, lng: prev.lng },
            to: { lat: station.lat, lng: station.lng },
            fullSpin,
          },
        });
      }

      if (flyTo && (station.lat !== 0 || station.lng !== 0)) {
        set({
          cameraTarget: {
            lat: station.lat,
            lng: station.lng,
            distance: station.precise ? 3.18 : 3.32,
            fullSpin,
            token: Date.now() + Math.random(),
          },
        });
      }

      // Resolve full station details from shard
      const full = await resolveFullStation(station);
      if (!full) {
        set({ playbackStatus: 'error' });
        return;
      }

      // Update recent history
      const nextRecent = [station, ...get().recent.filter((s) => s.id !== station.id)].slice(0, 30);
      set({
        currentStation: full,
        recent: nextRecent,
        placeInfo: null,
      });
      savePersistedLibrary({ favorites: get().favorites, recent: nextRecent });

      // Update URL parameter without reloading
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('station', full.id);
        window.history.replaceState({}, '', url.toString());
      } catch {}

      // Start audio playback
      audioEngine.playStream(full.url, full.hls);
      reportStationClick(full.uuid);

      // Update MediaSession metadata
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: full.name,
            artist: full.region ? `${full.region} · ${full.countryCode}` : full.countryCode,
            album: 'AuraFM · 星环电波',
            artwork: full.favicon ? [{ src: full.favicon, sizes: '96x96', type: 'image/png' }] : [],
          });
        } catch {}
      }

      // Load Wikipedia Place Explorer asynchronously
      loadPlaceInfo(full, get().language).then((info) => {
        if (get().currentStation?.id === full.id) {
          set({
            placeInfo: info,
          });
        }
      });
    },

    togglePlayPause: () => {
      const { playbackStatus, currentStation } = get();
      if (!currentStation) {
        get().playSurpriseMe();
        return;
      }
      if (playbackStatus === 'playing' || playbackStatus === 'loading') {
        audioEngine.pause();
      } else {
        audioEngine.resume();
      }
    },

    playPrevious: () => {
      const stack = get().historyBackStack;
      if (stack.length === 0) return;
      const [prev, ...rest] = stack;
      set({ historyBackStack: rest });
      get().selectStation(prev, { pushHistory: false, flyTo: true });
    },

    playNextNearest: () => {
      const { currentStation, preciseStations, allStations, filteredStationIds } = get();
      const poolSource = preciseStations.length > 0 ? preciseStations : allStations;
      const pool = filteredStationIds
        ? poolSource.filter((s) => filteredStationIds.has(s.id))
        : poolSource;

      if (pool.length === 0) return;
      if (!currentStation) {
        get().playSurpriseMe();
        return;
      }

      let nearest: StationSummary | null = null;
      let bestDist = Infinity;
      for (const s of pool) {
        if (s.id === currentStation.id) continue;
        const d = haversineRad(currentStation.lat, currentStation.lng, s.lat, s.lng);
        // Pick a nearby station (preferring distinct coordinates > 0.0005 rad so we hop around the region)
        const metric = d < 0.0002 ? d + 0.02 : d;
        if (metric < bestDist) {
          bestDist = metric;
          nearest = s;
        }
      }
      if (nearest) {
        get().selectStation(nearest, { pushHistory: true, flyTo: true });
      }
    },

    playSurpriseMe: () => {
      const { preciseStations, allStations, filteredStationIds, currentStation } = get();
      const basePool = preciseStations.length > 0 ? preciseStations : allStations;
      const pool = filteredStationIds
        ? basePool.filter((s) => filteredStationIds.has(s.id))
        : basePool;
      if (pool.length === 0) return;

      // Prefer well-voted stations in diverse countries
      const candidates = pool.filter((s) => s.id !== currentStation?.id);
      const list = candidates.length > 0 ? candidates : pool;
      const picked = list[Math.floor(Math.random() * list.length)];
      get().selectStation(picked, { pushHistory: true, fullSpin: true, flyTo: true });
    },

    locateCurrentStation: () => {
      const cur = get().currentStation;
      if (!cur) return;
      get().flyToCoords(cur.lat, cur.lng, cur.precise ? 3.12 : 3.28, false);
    },

    flyToCoords: (lat, lng, distance = 2.0, fullSpin = false) => {
      set({
        cameraTarget: {
          lat,
          lng,
          distance,
          fullSpin,
          token: Date.now() + Math.random(),
        },
      });
    },

    addFilterChip: (chip) => {
      const existing = get().filterChips;
      if (existing.some((c) => c.id === chip.id)) return;
      const nextChips = [...existing, chip];
      const matching = filterStationsByChips(get().allStations, nextChips);
      set({
        filterChips: nextChips,
        filteredStationIds: new Set(matching.map((s) => s.id)),
      });
    },

    removeFilterChip: (id) => {
      const nextChips = get().filterChips.filter((c) => c.id !== id);
      if (nextChips.length === 0) {
        set({ filterChips: [], filteredStationIds: null });
      } else {
        const matching = filterStationsByChips(get().allStations, nextChips);
        set({
          filterChips: nextChips,
          filteredStationIds: new Set(matching.map((s) => s.id)),
        });
      }
    },

    clearFilterChips: () => {
      set({ filterChips: [], filteredStationIds: null });
    },

    toggleFavorite: (station) => {
      const favs = get().favorites;
      const exists = favs.some((s) => s.id === station.id);
      const nextFavs = exists
        ? favs.filter((s) => s.id !== station.id)
        : [station, ...favs];
      set({ favorites: nextFavs });
      savePersistedLibrary({ favorites: nextFavs, recent: get().recent });
    },

    isFavorite: (stationId) => {
      return get().favorites.some((s) => s.id === stationId);
    },

    setSelectedCountryCode: (cc) =>
      set({
        selectedCountryCode: cc,
        spotStations: null,
        searchDrawerStations: null,
        inspectorOpen: Boolean(cc),
        inspectorTab: 'directory',
      }),

    setSpotStations: (stations) =>
      set({
        spotStations: stations,
        selectedCountryCode: null,
        searchDrawerStations: null,
        inspectorOpen: Boolean(stations && stations.length > 0),
        inspectorTab: 'directory',
      }),

    setSearchDrawerStations: (payload) =>
      set({
        searchDrawerStations: payload,
        selectedCountryCode: null,
        spotStations: null,
        inspectorOpen: Boolean(payload),
        inspectorTab: 'directory',
      }),

    setLibraryOpen: (open, tab) =>
      set((s) => ({
        libraryOpen: open,
        libraryTab: tab ?? s.libraryTab,
        inspectorOpen: open,
        inspectorTab: 'library',
        settingsOpen: open ? false : s.settingsOpen,
      })),

    setSettingsOpen: (open) =>
      set((s) => ({
        settingsOpen: open,
        libraryOpen: open ? false : s.libraryOpen,
      })),

    setPlaceModalOpen: (open) =>
      set({
        placeModalOpen: open,
        inspectorOpen: open ? true : get().inspectorOpen,
        inspectorTab: open ? 'place' : get().inspectorTab,
      }),

    setInspectorOpen: (open, tab) =>
      set((s) => ({
        inspectorOpen: open,
        inspectorTab: tab ?? s.inspectorTab,
        libraryOpen: open && (tab ?? s.inspectorTab) === 'library',
      })),

    setLanguage: (language) => {
      set({ language });
      persistCurrentSettings();
      const cur = get().currentStation;
      if (cur) {
        loadPlaceInfo(cur, language).then((info) => {
          if (get().currentStation?.id === cur.id) set({ placeInfo: info });
        });
      }
    },

    setGlobeView: (globeView) => {
      set({ globeView });
      persistCurrentSettings();
    },

    setVisualMode: (visualMode) => {
      set({ visualMode });
      persistCurrentSettings();
    },

    setImmersivePreset: (immersivePreset) => {
      set({ immersivePreset });
      persistCurrentSettings();
    },

    setQualityTier: (qualityTier) => {
      set({ qualityTier });
      persistCurrentSettings();
    },

    setTuningSound: (tuningSound) => {
      audioEngine.setTuningSoundEnabled(tuningSound);
      set({ tuningSound });
      persistCurrentSettings();
    },

    setScreensaver: (screensaver) => {
      set({ screensaver });
      persistCurrentSettings();
    },

    setVolume: (volume) => {
      const muted = volume <= 0 ? true : false;
      audioEngine.setVolume(volume, muted);
      set({ volume, muted });
      persistCurrentSettings();
    },

    toggleMute: () => {
      const nextMuted = !get().muted;
      audioEngine.setVolume(get().volume, nextMuted);
      set({ muted: nextMuted });
      persistCurrentSettings();
    },

    setPlayerMinimized: (playerMinimized) => {
      set({ playerMinimized });
      persistCurrentSettings();
    },
  };
});

import React, { useMemo, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Radio,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { countryCodeToFlag, getCountryName, t } from '../lib/i18n';
import { normalizeText } from '../lib/data';
import { GlobeViewMode, LanguageCode, QualityTier, StationSummary } from '../types';

export const Overlays: React.FC = () => {
  const language = useAppStore((s) => s.language);
  const globeView = useAppStore((s) => s.globeView);
  const tuningSound = useAppStore((s) => s.tuningSound);
  const screensaver = useAppStore((s) => s.screensaver);
  const qualityTier = useAppStore((s) => s.qualityTier);
  const settingsOpen = useAppStore((s) => s.settingsOpen);

  const selectedCountryCode = useAppStore((s) => s.selectedCountryCode);
  const spotStations = useAppStore((s) => s.spotStations);
  const searchDrawerStations = useAppStore((s) => s.searchDrawerStations);
  const allStations = useAppStore((s) => s.allStations);
  const filteredStationIds = useAppStore((s) => s.filteredStationIds);
  const currentStation = useAppStore((s) => s.currentStation);
  const favorites = useAppStore((s) => s.favorites);

  const placeInfo = useAppStore((s) => s.placeInfo);
  const placeModalOpen = useAppStore((s) => s.placeModalOpen);

  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setGlobeView = useAppStore((s) => s.setGlobeView);
  const setTuningSound = useAppStore((s) => s.setTuningSound);
  const setScreensaver = useAppStore((s) => s.setScreensaver);
  const setQualityTier = useAppStore((s) => s.setQualityTier);

  const setSelectedCountryCode = useAppStore((s) => s.setSelectedCountryCode);
  const setSpotStations = useAppStore((s) => s.setSpotStations);
  const setSearchDrawerStations = useAppStore((s) => s.setSearchDrawerStations);
  const selectStation = useAppStore((s) => s.selectStation);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const setPlaceModalOpen = useAppStore((s) => s.setPlaceModalOpen);

  const [drawerQuery, setDrawerQuery] = useState('');
  const [photoIdx, setPhotoIdx] = useState(0);

  // Active drawer data
  const activeDrawer = useMemo((): {
    title: string;
    flag?: string;
    stations: StationSummary[];
    onClose: () => void;
  } | null => {
    if (spotStations && spotStations.length > 0) {
      return {
        title: t(language, 'drawer.spotTitle', { count: spotStations.length }),
        flag: countryCodeToFlag(spotStations[0].countryCode),
        stations: spotStations,
        onClose: () => {
          setSpotStations(null);
          setDrawerQuery('');
        },
      };
    }
    if (selectedCountryCode) {
      const countryStations = allStations
        .filter(
          (s) =>
            s.countryCode === selectedCountryCode &&
            (!filteredStationIds || filteredStationIds.has(s.id))
        )
        .sort((a, b) => b.votes - a.votes);
      return {
        title: t(language, 'drawer.countryTitle', {
          country: getCountryName(selectedCountryCode, language),
        }),
        flag: countryCodeToFlag(selectedCountryCode),
        stations: countryStations,
        onClose: () => {
          setSelectedCountryCode(null);
          setDrawerQuery('');
        },
      };
    }
    if (searchDrawerStations) {
      return {
        title: t(language, 'drawer.searchResults', {
          count: searchDrawerStations.stations.length,
        }),
        stations: searchDrawerStations.stations,
        onClose: () => {
          setSearchDrawerStations(null);
          setDrawerQuery('');
        },
      };
    }
    return null;
  }, [
    spotStations,
    selectedCountryCode,
    searchDrawerStations,
    allStations,
    filteredStationIds,
    language,
    setSpotStations,
    setSelectedCountryCode,
    setSearchDrawerStations,
  ]);

  const filteredDrawerList = useMemo(() => {
    if (!activeDrawer) return [];
    const q = normalizeText(drawerQuery);
    if (!q) return activeDrawer.stations.slice(0, 250);
    return activeDrawer.stations
      .filter(
        (s) =>
          normalizeText(s.name).includes(q) ||
          (s.region && normalizeText(s.region).includes(q)) ||
          s.tags.some((tg) => normalizeText(tg).includes(q))
      )
      .slice(0, 250);
  }, [activeDrawer, drawerQuery]);

  return (
    <>
      {/* Top-Right Settings Button & Popover */}
      <div className="pointer-events-auto fixed top-4 right-4 z-30">
        <button
          type="button"
          onClick={() => setSettingsOpen(!settingsOpen)}
          aria-label={t(language, 'settings.title')}
          className={`flex h-10 w-10 items-center justify-center rounded-2xl border shadow-xl backdrop-blur-xl transition ${
            settingsOpen
              ? 'border-cyan-400/50 bg-cyan-950/90 text-cyan-200'
              : 'border-white/10 bg-slate-950/75 text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Settings className="h-4 w-4" />
        </button>

        {settingsOpen && (
          <div className="mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-white">
                {t(language, 'settings.title')}
              </span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Language */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                {t(language, 'settings.language')}
              </label>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1">
                {(
                  [
                    ['en', 'EN'],
                    ['pt', 'PT'],
                    ['es', 'ES'],
                  ] as [LanguageCode, string][]
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLanguage(code)}
                    className={`rounded-lg py-1 text-xs font-semibold transition ${
                      language === code
                        ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Globe View (Realistic / Minimal) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                {t(language, 'settings.globeView')}
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1">
                {(['realistic', 'minimal'] as GlobeViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setGlobeView(mode)}
                    className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                      globeView === mode
                        ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t(language, `settings.${mode}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tuning static sound toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-200">{t(language, 'settings.tuningSound')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={tuningSound}
                onClick={() => setTuningSound(!tuningSound)}
                className={`relative h-5 w-9 rounded-full transition ${
                  tuningSound ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                    tuningSound ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Screensaver toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-200">{t(language, 'settings.screensaver')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={screensaver}
                onClick={() => setScreensaver(!screensaver)}
                className={`relative h-5 w-9 rounded-full transition ${
                  screensaver ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                    screensaver ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Quality tier */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
                {t(language, 'settings.quality')}
              </label>
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-900 p-1">
                {(['auto', 'low', 'medium', 'high'] as QualityTier[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQualityTier(q)}
                    className={`rounded-lg py-1 text-[11px] font-semibold capitalize transition ${
                      qualityTier === q
                        ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Wikipedia Place Explorer Floating Pill */}
      {placeInfo && !placeModalOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-36 z-20 flex justify-center px-4">
          <button
            type="button"
            onClick={() => {
              setPhotoIdx(0);
              setPlaceModalOpen(true);
            }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/15 bg-slate-950/85 py-1.5 pr-3.5 pl-2 shadow-xl backdrop-blur-xl transition hover:scale-105 hover:border-cyan-400/50"
          >
            {placeInfo.photos[0] ? (
              <img
                src={placeInfo.photos[0].thumbUrl}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                <Camera className="h-3.5 w-3.5" />
              </div>
            )}
            <span className="text-xs font-medium text-white">
              {t(language, 'place.explore', { place: placeInfo.title })} ›
            </span>
            {placeInfo.photos.length > 0 && (
              <span className="text-[11px] text-cyan-300">
                · {t(language, 'place.photos', { count: placeInfo.photos.length })}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Wikipedia Place Explorer Modal */}
      {placeInfo && placeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-slate-900 shadow-2xl">
            {/* Photo Carousel */}
            {placeInfo.photos.length > 0 && (
              <div className="relative h-64 w-full bg-slate-950 sm:h-72">
                <img
                  src={placeInfo.photos[photoIdx]?.url}
                  alt={placeInfo.photos[photoIdx]?.caption || placeInfo.title}
                  className="h-full w-full object-cover"
                />
                {placeInfo.photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPhotoIdx(
                          (photoIdx - 1 + placeInfo.photos.length) % placeInfo.photos.length
                        )
                      }
                      className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-slate-950/70 p-2 text-white hover:bg-slate-950"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoIdx((photoIdx + 1) % placeInfo.photos.length)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-slate-950/70 p-2 text-white hover:bg-slate-950"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
                <div className="absolute right-3 bottom-2 rounded-full bg-slate-950/75 px-2.5 py-0.5 text-[10px] text-slate-300">
                  {photoIdx + 1} / {placeInfo.photos.length}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPlaceModalOpen(false)}
              className="absolute top-3 right-3 rounded-full bg-slate-950/80 p-2 text-slate-200 hover:bg-slate-950 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="overflow-y-auto p-5 space-y-3">
              <div>
                <h3 className="text-lg font-bold text-white">{placeInfo.title}</h3>
                {placeInfo.subtitle && (
                  <p className="text-xs text-cyan-300">{placeInfo.subtitle}</p>
                )}
              </div>
              <p className="text-xs leading-relaxed text-slate-300">{placeInfo.extract}</p>
              <div className="pt-2">
                <a
                  href={placeInfo.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/15"
                >
                  <span>{t(language, 'place.readMore')}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Station List Side Drawer (Country / Spot / Search All) */}
      {activeDrawer && (
        <div className="pointer-events-auto fixed top-16 right-4 bottom-36 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              {activeDrawer.flag && <span className="text-base">{activeDrawer.flag}</span>}
              <h3 className="truncate text-xs font-bold text-white">{activeDrawer.title}</h3>
            </div>
            <button
              type="button"
              onClick={activeDrawer.onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {activeDrawer.stations.length > 6 && (
            <div className="border-b border-white/10 px-3 py-2">
              <div className="flex items-center rounded-xl bg-slate-900 px-2.5 py-1.5">
                <Search className="mr-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={drawerQuery}
                  onChange={(e) => setDrawerQuery(e.target.value)}
                  placeholder={t(language, 'drawer.filterPlaceholder')}
                  className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredDrawerList.map((st) => {
              const isPlaying = currentStation?.id === st.id;
              const isFav = favorites.some((f) => f.id === st.id);
              return (
                <div
                  key={st.id}
                  className={`flex items-center justify-between rounded-xl px-2.5 py-2 transition ${
                    isPlaying
                      ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectStation(st, { pushHistory: true, flyTo: st.precise })}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <Radio
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isPlaying ? 'text-emerald-400' : 'text-cyan-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">{st.name}</div>
                      <div className="truncate text-[10px] text-slate-400">
                        {st.region ? `${st.region} · ` : ''}
                        {st.tags.slice(0, 2).join(', ') || getCountryName(st.countryCode, language)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(st)}
                    className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-amber-400"
                  >
                    <Heart
                      className={`h-3.5 w-3.5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  ListMusic,
  Radio,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  countryCodeToFlag,
  formatStationLocalTime,
  getCountryName,
  t,
} from '../lib/i18n';
import { normalizeText } from '../lib/data';
import { InspectorTab, StationSummary } from '../types';

export const Overlays: React.FC = () => {
  const language = useAppStore((s) => s.language);
  const selectedCountryCode = useAppStore((s) => s.selectedCountryCode);
  const spotStations = useAppStore((s) => s.spotStations);
  const searchDrawerStations = useAppStore((s) => s.searchDrawerStations);
  const allStations = useAppStore((s) => s.allStations);
  const filteredStationIds = useAppStore((s) => s.filteredStationIds);
  const currentStation = useAppStore((s) => s.currentStation);
  const favorites = useAppStore((s) => s.favorites);
  const recent = useAppStore((s) => s.recent);
  const libraryTab = useAppStore((s) => s.libraryTab);
  const inspectorOpen = useAppStore((s) => s.inspectorOpen);
  const inspectorTab = useAppStore((s) => s.inspectorTab);
  const placeInfo = useAppStore((s) => s.placeInfo);

  const selectStation = useAppStore((s) => s.selectStation);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const setLibraryOpen = useAppStore((s) => s.setLibraryOpen);
  const setInspectorOpen = useAppStore((s) => s.setInspectorOpen);

  const [drawerQuery, setDrawerQuery] = useState('');
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    setPhotoIdx(0);
  }, [placeInfo?.title]);

  const directoryPayload = useMemo((): {
    title: string;
    flag?: string;
    stations: StationSummary[];
  } => {
    if (spotStations && spotStations.length > 0) {
      return {
        title: t(language, 'drawer.spotTitle', { count: spotStations.length }),
        flag: countryCodeToFlag(spotStations[0].countryCode),
        stations: spotStations,
      };
    }
    const activeCC = selectedCountryCode || currentStation?.countryCode;
    if (activeCC) {
      const countryStations = allStations
        .filter(
          (s) =>
            s.countryCode === activeCC &&
            (!filteredStationIds || filteredStationIds.has(s.id))
        )
        .sort((a, b) => b.votes - a.votes);
      return {
        title: getCountryName(activeCC, language),
        flag: countryCodeToFlag(activeCC),
        stations: countryStations,
      };
    }
    if (searchDrawerStations) {
      return {
        title: t(language, 'drawer.searchResults', {
          count: searchDrawerStations.stations.length,
        }),
        stations: searchDrawerStations.stations,
      };
    }
    const pool = filteredStationIds
      ? allStations.filter((s) => filteredStationIds.has(s.id))
      : allStations;
    return {
      title: language === 'zh' ? '全球精选电台' : 'Featured Stations',
      stations: pool.slice(0, 150),
    };
  }, [
    spotStations,
    selectedCountryCode,
    currentStation?.countryCode,
    searchDrawerStations,
    allStations,
    filteredStationIds,
    language,
  ]);

  const filteredDirectoryList = useMemo(() => {
    const q = normalizeText(drawerQuery);
    if (!q) return directoryPayload.stations.slice(0, 150);
    return directoryPayload.stations
      .filter(
        (s) =>
          normalizeText(s.name).includes(q) ||
          (s.region && normalizeText(s.region).includes(q)) ||
          s.tags.some((tg) => normalizeText(tg).includes(q))
      )
      .slice(0, 150);
  }, [directoryPayload, drawerQuery]);

  const nearbyCountryStations = useMemo(() => {
    if (!currentStation) return [];
    return allStations
      .filter(
        (s) =>
          s.countryCode === currentStation.countryCode &&
          s.id !== currentStation.id
      )
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 5);
  }, [allStations, currentStation]);

  const localTime = currentStation?.timezone
    ? formatStationLocalTime(currentStation.timezone)
    : null;

  // When collapsed, show a sleek floating capsule trigger if a place story or station is active
  if (!inspectorOpen) {
    if (!currentStation && !placeInfo) return null;
    return (
      <div className="pointer-events-auto fixed top-20 right-5 z-20">
        <button
          type="button"
          onClick={() => setInspectorOpen(true, 'place')}
          className="glass-pill group flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400/40"
        >
          {placeInfo?.photos[0] ? (
            <img
              src={placeInfo.photos[0].thumbUrl}
              alt=""
              className="h-7 w-7 rounded-full object-cover ring-1 ring-white/20"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300">
              <Compass className="h-3.5 w-3.5" />
            </span>
          )}
          <div className="text-left">
            <div className="text-[13px] font-medium text-white">
              {placeInfo?.title ||
                (currentStation
                  ? getCountryName(currentStation.countryCode, language)
                  : '')}
            </div>
            <div className="text-[10px] text-cyan-300/80">
              {language === 'zh' ? '城市人文 · 频道列表' : 'City Story · Channels'}
            </div>
          </div>
          <Sparkles className="h-3.5 w-3.5 text-cyan-300 transition group-hover:rotate-12" />
        </button>
      </div>
    );
  }

  return (
    <aside className="glass-card pointer-events-auto fixed top-20 right-5 z-30 flex w-[348px] max-w-[calc(100vw-2.5rem)] max-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-[28px]">
      {/* Top Pill Navigation */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex flex-1 items-center rounded-full bg-white/6 p-1">
          {(
            [
              ['place', language === 'zh' ? '城市人文' : 'Story', Compass],
              ['directory', language === 'zh' ? '频道列表' : 'Channels', ListMusic],
              ['library', language === 'zh' ? '我的收藏' : 'Saved', Bookmark],
            ] as [InspectorTab, string, React.FC<{ className?: string }>][]
          ).map(([tabKey, label, Icon]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setInspectorOpen(true, tabKey)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition ${
                inspectorTab === tabKey
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40 font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setInspectorOpen(false)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/6 text-slate-300 transition hover:bg-white/15 hover:text-white"
          aria-label="Close card"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* TAB 1: MAGAZINE PLACE STORY & NEARBY STATIONS */}
      {inspectorTab === 'place' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {!currentStation ? (
            <div className="rounded-2xl bg-white/4 p-6 text-center text-[13px] text-slate-400">
              {t(language, 'inspector.noSignal')}
            </div>
          ) : (
            <>
              {/* Magazine Hero Card */}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/45">
                {placeInfo && placeInfo.photos.length > 0 ? (
                  <div className="relative h-44 w-full bg-slate-900">
                    <img
                      src={placeInfo.photos[photoIdx]?.url}
                      alt={placeInfo.photos[photoIdx]?.caption || placeInfo.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />

                    {placeInfo.photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoIdx(
                              (photoIdx - 1 + placeInfo.photos.length) %
                                placeInfo.photos.length
                            )
                          }
                          className="absolute top-3 right-11 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/65 text-white backdrop-blur-md hover:bg-slate-950"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPhotoIdx((photoIdx + 1) % placeInfo.photos.length)
                          }
                          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/65 text-white backdrop-blur-md hover:bg-slate-950"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    <div className="absolute inset-x-3.5 bottom-3 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-cyan-300">
                          {countryCodeToFlag(currentStation.countryCode)}{' '}
                          {getCountryName(currentStation.countryCode, language)}
                        </div>
                        <h3 className="truncate text-lg font-semibold text-white">
                          {placeInfo.title}
                        </h3>
                      </div>
                      {localTime && (
                        <span className="shrink-0 rounded-full bg-slate-950/70 px-2.5 py-1 font-mono-tech text-xs text-slate-200 backdrop-blur-md">
                          {localTime.isNight ? '🌙' : '☀️'} {localTime.formatted}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <div>
                      <div className="text-xs font-medium text-cyan-300">
                        {countryCodeToFlag(currentStation.countryCode)}{' '}
                        {getCountryName(currentStation.countryCode, language)}
                      </div>
                      <h3 className="mt-0.5 text-base font-semibold text-white">
                        {placeInfo?.title ||
                          currentStation.region ||
                          currentStation.name}
                      </h3>
                    </div>
                    {localTime && (
                      <span className="rounded-full bg-white/8 px-2.5 py-1 font-mono-tech text-xs text-slate-200">
                        {localTime.isNight ? '🌙' : '☀️'} {localTime.formatted}
                      </span>
                    )}
                  </div>
                )}

                {placeInfo ? (
                  <div className="p-3.5 space-y-2.5">
                    <p className="text-[13px] leading-relaxed text-slate-300 line-clamp-4">
                      {placeInfo.extract}
                    </p>
                    <div className="flex items-center justify-between pt-0.5">
                      <a
                        href={placeInfo.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"
                      >
                        <span>{t(language, 'place.readMore')}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {placeInfo.photos.length > 1 && (
                        <span className="font-mono-tech text-[11px] text-slate-400">
                          {photoIdx + 1} / {placeInfo.photos.length}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pb-4 pt-1 text-xs text-slate-400">
                    {language === 'zh'
                      ? '正在加载当地城市文化与地理风貌...'
                      : 'Loading destination story...'}
                  </div>
                )}
              </div>

              {/* Nearby Stations in Same Country */}
              {nearbyCountryStations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-slate-400">
                      {language === 'zh' ? '同国家/地区其他电台' : 'More in this Country'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectorOpen(true, 'directory')}
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      {language === 'zh' ? '查看全部 →' : 'View all →'}
                    </button>
                  </div>

                  <div className="space-y-1">
                    {nearbyCountryStations.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          selectStation(st, { pushHistory: true, flyTo: st.precise })
                        }
                        className="flex w-full items-center justify-between rounded-2xl bg-white/4 px-3 py-2 text-left transition hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Radio className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-medium text-white">
                              {st.name}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {st.region || st.tags[0] || getCountryName(st.countryCode, language)}
                            </div>
                          </div>
                        </div>
                        {st.tags[0] && (
                          <span className="ml-2 shrink-0 rounded-full bg-white/6 px-2 py-0.5 text-[11px] text-slate-300">
                            {st.tags[0]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: CLEAN CHANNEL DIRECTORY */}
      {inspectorTab === 'directory' && (
        <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 min-w-0">
                {directoryPayload.flag && (
                  <span className="text-base">{directoryPayload.flag}</span>
                )}
                <h3 className="truncate text-sm font-semibold text-white">
                  {directoryPayload.title}
                </h3>
              </div>
              <span className="rounded-full bg-cyan-400/15 px-2.5 py-0.5 font-mono-tech text-xs font-medium text-cyan-300">
                {filteredDirectoryList.length}
              </span>
            </div>

            <div className="flex items-center rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5">
              <Search className="mr-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={drawerQuery}
                onChange={(e) => setDrawerQuery(e.target.value)}
                placeholder={t(language, 'drawer.filterPlaceholder')}
                className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {filteredDirectoryList.map((st) => {
              const isPlaying = currentStation?.id === st.id;
              const isFav = favorites.some((f) => f.id === st.id);
              return (
                <div
                  key={st.id}
                  className={`flex items-center justify-between rounded-2xl px-3 py-2 transition ${
                    isPlaying
                      ? 'bg-cyan-400/18 text-white ring-1 ring-cyan-400/40'
                      : 'hover:bg-white/8 text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      selectStation(st, { pushHistory: true, flyTo: st.precise })
                    }
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${
                        isPlaying
                          ? 'bg-cyan-400 text-slate-950 font-bold'
                          : 'bg-white/6 text-slate-300'
                      }`}
                    >
                      {isPlaying ? '▶' : countryCodeToFlag(st.countryCode)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-white">
                        {st.name}
                      </div>
                      <div className="truncate text-xs text-slate-400">
                        {st.region ? `${st.region} · ` : ''}
                        {st.tags[0] || getCountryName(st.countryCode, language)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(st)}
                    className="ml-2 rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-amber-400"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        isFav ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SAVED & LISTENING HISTORY */}
      {inspectorTab === 'library' && (
        <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="mb-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLibraryOpen(true, 'favorites')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition ${
                libraryTab === 'favorites'
                  ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/35'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Star className="h-3.5 w-3.5" />
              <span>{t(language, 'library.favorites')}</span>
              <span className="font-mono-tech text-[11px]">({favorites.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLibraryOpen(true, 'recent')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition ${
                libraryTab === 'recent'
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/35'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{t(language, 'library.recent')}</span>
              <span className="font-mono-tech text-[11px]">({recent.length})</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
            {(libraryTab === 'favorites' ? favorites : recent).length === 0 ? (
              <div className="rounded-2xl bg-white/4 p-8 text-center text-[13px] text-slate-400">
                {t(
                  language,
                  libraryTab === 'favorites'
                    ? 'library.emptyFavorites'
                    : 'library.emptyRecent'
                )}
              </div>
            ) : (
              (libraryTab === 'favorites' ? favorites : recent).map((st) => {
                const isPlaying = currentStation?.id === st.id;
                const isFav = favorites.some((f) => f.id === st.id);
                return (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between rounded-2xl px-3 py-2 transition ${
                      isPlaying ? 'bg-cyan-400/18 ring-1 ring-cyan-400/40' : 'hover:bg-white/8'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectStation(st, { pushHistory: true, flyTo: true })}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className="text-base">{countryCodeToFlag(st.countryCode)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-white">
                          {st.name}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          {st.region ? `${st.region} · ` : ''}
                          {getCountryName(st.countryCode, language)}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(st)}
                      className="ml-2 rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-amber-400"
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${
                          isFav ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

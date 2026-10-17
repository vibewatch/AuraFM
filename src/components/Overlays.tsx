import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  ListFilter,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  countryCodeToFlag,
  formatCoords,
  formatStationLocalTime,
  getCountryName,
  t,
} from '../lib/i18n';
import { normalizeText } from '../lib/data';
import { audioEngine } from '../lib/audio';
import { InspectorTab, StationSummary } from '../types';

export const Overlays: React.FC = () => {
  const language = useAppStore((s) => s.language);
  const selectedCountryCode = useAppStore((s) => s.selectedCountryCode);
  const spotStations = useAppStore((s) => s.spotStations);
  const searchDrawerStations = useAppStore((s) => s.searchDrawerStations);
  const allStations = useAppStore((s) => s.allStations);
  const filteredStationIds = useAppStore((s) => s.filteredStationIds);
  const currentStation = useAppStore((s) => s.currentStation);
  const playbackStatus = useAppStore((s) => s.playbackStatus);
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
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setPhotoIdx(0);
  }, [placeInfo?.title]);

  // Real-time 24-band Spectrum Canvas in Signal Telemetry tab
  useEffect(() => {
    if (!inspectorOpen || inspectorTab !== 'place') return;
    const canvas = spectrumCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const barCount = 24;
    const smoothed = new Float32Array(barCount);

    const renderSpectrum = (now: number) => {
      raf = requestAnimationFrame(renderSpectrum);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bands = audioEngine.getAudioBands(now / 1000);
      const gap = 2;
      const barWidth = (w - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        let target = 0.08;
        if (playbackStatus === 'playing') {
          if (bands.frequencyData && !bands.isSynthetic) {
            const bin = Math.min(
              bands.frequencyData.length - 1,
              Math.floor(Math.pow(i / barCount, 1.5) * 180) + 1
            );
            target = Math.max(0.08, (bands.frequencyData[bin] / 255) * 0.95);
          } else {
            const phase = i / barCount;
            const wave =
              Math.sin(now * 0.004 + i * 0.45) * 0.25 +
              Math.cos(now * 0.007 - i * 0.3) * 0.2;
            const env =
              phase < 0.35 ? bands.bass : phase < 0.75 ? bands.mid : bands.high;
            target = Math.max(0.1, Math.min(0.95, env * 1.1 + wave * 0.35));
          }
        }
        smoothed[i] += (target - smoothed[i]) * 0.22;
        const bh = Math.max(3, smoothed[i] * h);
        const x = i * (barWidth + gap);
        const y = h - bh;

        const grad = ctx.createLinearGradient(0, h, 0, 0);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.65, '#34d399');
        grad.addColorStop(1, '#a7f3d0');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, bh);
      }
    };

    raf = requestAnimationFrame(renderSpectrum);
    return () => cancelAnimationFrame(raf);
  }, [inspectorOpen, inspectorTab, playbackStatus]);

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
      title: t(language, 'drawer.searchResults', { count: pool.length }),
      stations: pool.slice(0, 200),
    };
  }, [
    spotStations,
    selectedCountryCode,
    searchDrawerStations,
    allStations,
    filteredStationIds,
    language,
  ]);

  const filteredDirectoryList = useMemo(() => {
    const q = normalizeText(drawerQuery);
    if (!q) return directoryPayload.stations.slice(0, 200);
    return directoryPayload.stations
      .filter(
        (s) =>
          normalizeText(s.name).includes(q) ||
          (s.region && normalizeText(s.region).includes(q)) ||
          s.tags.some((tg) => normalizeText(tg).includes(q))
      )
      .slice(0, 200);
  }, [directoryPayload, drawerQuery]);

  const localTime = currentStation?.timezone
    ? formatStationLocalTime(currentStation.timezone)
    : null;

  if (!inspectorOpen) {
    if (!placeInfo) return null;
    return (
      <div className="pointer-events-auto fixed top-24 right-3 z-20">
        <button
          type="button"
          onClick={() => setInspectorOpen(true, 'place')}
          className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400/50"
        >
          {placeInfo.photos[0] && (
            <img
              src={placeInfo.photos[0].thumbUrl}
              alt=""
              className="h-5 w-5 rounded object-cover"
            />
          )}
          <span className="font-condensed font-semibold">
            {t(language, 'place.explore', { place: placeInfo.title })}
          </span>
          <span className="font-mono-tech text-[10px] text-cyan-300">
            [{placeInfo.photos.length}]
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside className="glass-panel pointer-events-auto fixed top-24 right-3 bottom-24 z-30 flex w-[356px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl">
      {/* Top Segmented Inspector Tabs */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-2 py-1.5">
        <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-slate-900/90 p-0.5">
          {(
            [
              ['place', t(language, 'inspector.tabSignal'), Activity],
              ['directory', t(language, 'inspector.tabDirectory'), ListFilter],
              ['library', t(language, 'inspector.tabLibrary'), Bookmark],
            ] as [InspectorTab, string, React.FC<{ className?: string }>][]
          ).map(([tabKey, label, Icon]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setInspectorOpen(true, tabKey)}
              className={`flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-semibold transition ${
                inspectorTab === tabKey
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setInspectorOpen(false)}
          className="ml-1.5 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Close inspector"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* TAB 1: SIGNAL TELEMETRY & INLINE PLACE BRIEFING */}
      {inspectorTab === 'place' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!currentStation ? (
            <div className="rounded-lg border border-white/5 bg-slate-900/50 p-4 text-center text-xs text-slate-400">
              {t(language, 'inspector.noSignal')}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-[10px] font-semibold tracking-wider text-cyan-400 uppercase">
                    {t(language, 'inspector.telemetry')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 font-mono-tech text-[10px] font-semibold ${
                      playbackStatus === 'playing'
                        ? 'text-emerald-400'
                        : playbackStatus === 'loading'
                        ? 'text-cyan-300'
                        : playbackStatus === 'error'
                        ? 'text-rose-400'
                        : 'text-amber-300'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        playbackStatus === 'playing'
                          ? 'bg-emerald-400 animate-pulse'
                          : playbackStatus === 'loading'
                          ? 'bg-cyan-400 animate-ping'
                          : playbackStatus === 'error'
                          ? 'bg-rose-400'
                          : 'bg-amber-400'
                      }`}
                    />
                    {playbackStatus === 'playing'
                      ? language === 'zh'
                        ? 'LIVE · 信号锁定'
                        : 'LIVE · LOCKED'
                      : playbackStatus === 'loading'
                      ? language === 'zh'
                        ? 'SYNC · 调谐中'
                        : 'SYNC · TUNING'
                      : playbackStatus === 'error'
                      ? language === 'zh'
                        ? 'LINK · 待命'
                        : 'LINK · STANDBY'
                      : language === 'zh'
                      ? 'PAUSED · 暂停'
                      : 'PAUSED'}
                  </span>
                </div>

                <div>
                  <div className="text-sm font-bold text-white leading-tight">
                    {currentStation.name}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-300">
                    {countryCodeToFlag(currentStation.countryCode)}{' '}
                    {currentStation.region ? `${currentStation.region}, ` : ''}
                    {getCountryName(currentStation.countryCode, language)}
                  </div>
                </div>

                <div className="rounded border border-white/5 bg-slate-900/90 p-1.5">
                  <canvas
                    ref={spectrumCanvasRef}
                    width={280}
                    height={36}
                    className="h-9 w-full block"
                  />
                </div>

                <div className="grid grid-cols-12 gap-1.5 pt-0.5">
                  <div className="col-span-5 rounded bg-white/5 px-2 py-1">
                    <div className="font-mono-tech text-[9px] text-slate-400">
                      {t(language, 'inspector.coordinates')}
                    </div>
                    <div className="truncate font-mono-tech text-[10.5px] font-semibold text-slate-100">
                      {formatCoords(currentStation.lat, currentStation.lng)}
                    </div>
                  </div>
                  <div className="col-span-4 rounded bg-white/5 px-2 py-1">
                    <div className="font-mono-tech text-[9px] text-slate-400">
                      {t(language, 'inspector.localTime')}
                    </div>
                    <div className="truncate font-mono-tech text-[10.5px] font-semibold text-slate-100">
                      {localTime
                        ? `${localTime.isNight ? '🌙' : '☀️'} ${localTime.formatted}`
                        : 'UTC'}
                    </div>
                  </div>
                  <div className="col-span-3 rounded bg-white/5 px-2 py-1">
                    <div className="font-mono-tech text-[9px] text-slate-400">
                      {t(language, 'inspector.streamSpec')}
                    </div>
                    <div className="truncate font-mono-tech text-[10.5px] font-semibold text-cyan-300">
                      {currentStation.codec || 'AAC'}
                      {currentStation.bitrate ? ` ${currentStation.bitrate}k` : ''}
                    </div>
                  </div>
                </div>
              </div>

              {placeInfo && (
                <div className="rounded-lg border border-white/10 bg-slate-950/70 overflow-hidden">
                  <div className="border-b border-white/10 px-2.5 py-1.5 flex items-center justify-between">
                    <span className="font-mono-tech text-[10px] font-semibold tracking-wider text-amber-300 uppercase">
                      {t(language, 'inspector.placeStory')}
                    </span>
                    {placeInfo.photos.length > 0 && (
                      <span className="font-mono-tech text-[10px] text-slate-400">
                        {photoIdx + 1} / {placeInfo.photos.length}
                      </span>
                    )}
                  </div>

                  {placeInfo.photos.length > 0 && (
                    <div className="relative h-44 w-full bg-slate-900">
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
                                (photoIdx - 1 + placeInfo.photos.length) %
                                  placeInfo.photos.length
                              )
                            }
                            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-slate-950/75 p-1 text-white hover:bg-slate-950"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPhotoIdx((photoIdx + 1) % placeInfo.photos.length)
                            }
                            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-slate-950/75 p-1 text-white hover:bg-slate-950"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {placeInfo.photos.length > 1 && (
                        <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-slate-950/90 to-transparent p-1.5 overflow-x-auto">
                          {placeInfo.photos.map((ph, idx) => (
                            <button
                              key={ph.url}
                              type="button"
                              onClick={() => setPhotoIdx(idx)}
                              className={`h-7 w-10 shrink-0 overflow-hidden rounded border transition ${
                                idx === photoIdx
                                  ? 'border-cyan-400 scale-105'
                                  : 'border-white/20 opacity-60 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={ph.thumbUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-2.5 space-y-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">{placeInfo.title}</h4>
                      {placeInfo.subtitle && (
                        <div className="text-[11px] text-cyan-300">{placeInfo.subtitle}</div>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300 line-clamp-6">
                      {placeInfo.extract}
                    </p>
                    <a
                      href={placeInfo.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-white/15"
                    >
                      <span>{t(language, 'place.readMore')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: HIGH-DENSITY STATION DIRECTORY */}
      {inspectorTab === 'directory' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/10 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {directoryPayload.flag && <span>{directoryPayload.flag}</span>}
                <h3 className="truncate text-xs font-bold text-white uppercase tracking-wide">
                  {directoryPayload.title}
                </h3>
              </div>
              <span className="font-mono-tech text-[10px] text-cyan-300">
                {filteredDirectoryList.length}
              </span>
            </div>
            <div className="flex items-center rounded-lg border border-white/10 bg-slate-900/90 px-2 py-1">
              <Search className="mr-1.5 h-3 w-3 text-slate-400" />
              <input
                type="text"
                value={drawerQuery}
                onChange={(e) => setDrawerQuery(e.target.value)}
                placeholder={t(language, 'drawer.filterPlaceholder')}
                className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {filteredDirectoryList.map((st, idx) => {
              const isPlaying = currentStation?.id === st.id;
              const isFav = favorites.some((f) => f.id === st.id);
              return (
                <div
                  key={st.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 text-xs transition ${
                    isPlaying
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'hover:bg-white/5 text-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectStation(st, { pushHistory: true, flyTo: st.precise })}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="w-5 shrink-0 font-mono-tech text-[10px] text-slate-500">
                      {isPlaying ? '▶' : String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">{st.name}</div>
                      <div className="truncate text-[10px] text-slate-400">
                        {countryCodeToFlag(st.countryCode)}{' '}
                        {st.region ? `${st.region} · ` : ''}
                        {st.tags[0] || getCountryName(st.countryCode, language)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(st)}
                    className="ml-1.5 rounded p-1 text-slate-400 hover:bg-white/10 hover:text-amber-400"
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

      {/* TAB 3: SAVED & HISTORY */}
      {inspectorTab === 'library' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-1 border-b border-white/10 px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => setLibraryOpen(true, 'favorites')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition ${
                libraryTab === 'favorites'
                  ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Star className="h-3 w-3" />
              <span>{t(language, 'library.favorites')}</span>
              <span className="font-mono-tech text-[10px]">({favorites.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLibraryOpen(true, 'recent')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition ${
                libraryTab === 'recent'
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>{t(language, 'library.recent')}</span>
              <span className="font-mono-tech text-[10px]">({recent.length})</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {(libraryTab === 'favorites' ? favorites : recent).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {t(
                  language,
                  libraryTab === 'favorites' ? 'library.emptyFavorites' : 'library.emptyRecent'
                )}
              </div>
            ) : (
              (libraryTab === 'favorites' ? favorites : recent).map((st) => {
                const isPlaying = currentStation?.id === st.id;
                const isFav = favorites.some((f) => f.id === st.id);
                return (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between px-2.5 py-2 text-xs transition ${
                      isPlaying ? 'bg-emerald-500/15' : 'hover:bg-white/5'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => selectStation(st, { pushHistory: true, flyTo: true })}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span>{countryCodeToFlag(st.countryCode)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-white">{st.name}</div>
                        <div className="truncate text-[10px] text-slate-400">
                          {st.region ? `${st.region}, ` : ''}
                          {getCountryName(st.countryCode, language)}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(st)}
                      className="ml-1.5 rounded p-1 text-slate-400 hover:bg-white/10 hover:text-amber-400"
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

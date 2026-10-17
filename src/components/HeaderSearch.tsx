import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Disc3,
  Globe2,
  Layers,
  MapPin,
  Music,
  PanelRight,
  Radio,
  Search,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { countryCodeToFlag, getCountryName, t } from '../lib/i18n';
import { normalizeText, searchLiveRadioBrowser } from '../lib/data';
import { ArtistEntry, StationSummary } from '../types';

const QUICK_GENRES: { key: string; tag: string }[] = [
  { key: 'quick.jazz', tag: 'jazz' },
  { key: 'quick.electronic', tag: 'electronic' },
  { key: 'quick.classical', tag: 'classical' },
  { key: 'quick.ambient', tag: 'ambient' },
  { key: 'quick.rock', tag: 'rock' },
  { key: 'quick.pop', tag: 'pop' },
  { key: 'quick.news', tag: 'news' },
  { key: 'quick.world', tag: 'world music' },
];

export const HeaderSearch: React.FC = () => {
  const meta = useAppStore((s) => s.meta);
  const allStations = useAppStore((s) => s.allStations);
  const tags = useAppStore((s) => s.tags);
  const artists = useAppStore((s) => s.artists);
  const language = useAppStore((s) => s.language);
  const globeView = useAppStore((s) => s.globeView);
  const visualMode = useAppStore((s) => s.visualMode);
  const tuningSound = useAppStore((s) => s.tuningSound);
  const filterChips = useAppStore((s) => s.filterChips);
  const filteredStationIds = useAppStore((s) => s.filteredStationIds);
  const favorites = useAppStore((s) => s.favorites);
  const inspectorOpen = useAppStore((s) => s.inspectorOpen);

  const selectStation = useAppStore((s) => s.selectStation);
  const addFilterChip = useAppStore((s) => s.addFilterChip);
  const removeFilterChip = useAppStore((s) => s.removeFilterChip);
  const clearFilterChips = useAppStore((s) => s.clearFilterChips);
  const setSelectedCountryCode = useAppStore((s) => s.setSelectedCountryCode);
  const setSearchDrawerStations = useAppStore((s) => s.setSearchDrawerStations);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setGlobeView = useAppStore((s) => s.setGlobeView);
  const setVisualMode = useAppStore((s) => s.setVisualMode);
  const setTuningSound = useAppStore((s) => s.setTuningSound);
  const setInspectorOpen = useAppStore((s) => s.setInspectorOpen);
  const flyToCoords = useAppStore((s) => s.flyToCoords);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [liveStations, setLiveStations] = useState<StationSummary[]>([]);
  const [utcTime, setUtcTime] = useState(() => new Date().toISOString().slice(11, 19));
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setUtcTime(new Date().toISOString().slice(11, 19));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if ((e.key === '/' && !inInput) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const countryEntries = useMemo(() => {
    const map = new Map<
      string,
      { cc: string; name: string; norm: string; count: number; lat: number; lng: number }
    >();
    for (const st of allStations) {
      let item = map.get(st.countryCode);
      if (!item) {
        const name = getCountryName(st.countryCode, language);
        item = {
          cc: st.countryCode,
          name,
          norm: normalizeText(name),
          count: 0,
          lat: st.lat,
          lng: st.lng,
        };
        map.set(st.countryCode, item);
      }
      item.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allStations, language]);

  const searchResults = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return null;

    const matchedGenres = tags
      .filter(([tagName]) => normalizeText(tagName).includes(q))
      .slice(0, 6);

    const matchedArtists: ArtistEntry[] = artists
      .filter(
        (a) =>
          normalizeText(a.name).includes(q) ||
          (a.aliases && a.aliases.some((al) => normalizeText(al).includes(q)))
      )
      .slice(0, 4);

    const matchedCountries = countryEntries
      .filter((c) => c.norm.includes(q) || c.cc.toLowerCase() === q)
      .slice(0, 5);

    const matchedStations: StationSummary[] = [];
    for (const st of allStations) {
      if (
        normalizeText(st.name).includes(q) ||
        (st.region && normalizeText(st.region).includes(q))
      ) {
        matchedStations.push(st);
      }
    }
    matchedStations.sort((a, b) => b.votes - a.votes);

    return {
      genres: matchedGenres,
      artists: matchedArtists,
      countries: matchedCountries,
      stations: matchedStations.slice(0, 8),
      allMatchedStations: matchedStations,
    };
  }, [query, tags, artists, countryEntries, allStations]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setLiveStations([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchLiveRadioBrowser(q, controller.signal).then((res) => {
        setLiveStations(res.slice(0, 5));
      });
    }, 360);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const stationCount = filteredStationIds
    ? filteredStationIds.size
    : meta?.stations ?? allStations.length;
  const countryCount = meta?.countries ?? 205;

  const toggleQuickGenre = (tag: string, label: string) => {
    const chipId = `genre:${tag}`;
    if (filterChips.some((c) => c.id === chipId)) {
      removeFilterChip(chipId);
    } else {
      addFilterChip({ id: chipId, type: 'genre', label, tag });
    }
  };

  return (
    <header
      ref={containerRef}
      className="pointer-events-none fixed inset-x-3 top-3 z-30 flex flex-col gap-2"
    >
      {/* Top Orbital Command Bar */}
      <div className="glass-panel pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-1.5">
        {/* Left: Brand Identity + Live Telemetry Counter */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
            </span>
            <h1 className="font-condensed text-sm font-bold tracking-wider text-white uppercase">
              GeoRadios
            </h1>
            <span className="hidden md:inline-block rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono-tech text-[10px] font-medium text-cyan-300 border border-cyan-400/20">
              {t(language, 'header.tagline')}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 border-l border-white/10 pl-3 font-mono-tech text-[11px] text-slate-300">
            <span>
              {t(language, 'header.count', {
                stations: stationCount.toLocaleString(),
                countries: countryCount,
              })}
            </span>
            <span className="hidden lg:inline text-slate-500">·</span>
            <span className="hidden lg:inline text-cyan-400/90">UTC {utcTime}</span>
          </div>
        </div>

        {/* Center: High-Density Omnibox Search */}
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <div className="flex items-center rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1 focus-within:border-cyan-400/60">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onFocus={() => setFocused(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocused(true);
              }}
              placeholder={t(language, 'search.placeholder')}
              className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="ml-1 rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block rounded border border-white/10 bg-white/5 px-1.5 py-0.2 font-mono-tech text-[10px] text-slate-400">
                /
              </kbd>
            )}
          </div>

          {/* Search Omnibox Dropdown */}
          {focused && searchResults && (
            <div className="glass-panel absolute left-0 right-0 top-full mt-1.5 max-h-[68vh] overflow-y-auto rounded-xl p-2 z-50">
              {/* Genres */}
              {searchResults.genres.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-0.5 font-mono-tech text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {t(language, 'search.genres')}
                  </div>
                  <div className="flex flex-wrap gap-1 px-1.5 py-1">
                    {searchResults.genres.map(([tagName, count]) => (
                      <button
                        key={tagName}
                        type="button"
                        onClick={() => {
                          addFilterChip({
                            id: `genre:${tagName}`,
                            type: 'genre',
                            label: tagName,
                            tag: tagName,
                          });
                          setQuery('');
                          setFocused(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:text-white"
                      >
                        <Music className="h-3 w-3 text-cyan-400" />
                        <span>{tagName}</span>
                        <span className="font-mono-tech text-[10px] text-slate-400">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Artists */}
              {searchResults.artists.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-0.5 font-mono-tech text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {t(language, 'search.artists')}
                  </div>
                  {searchResults.artists.map((artist) => (
                    <button
                      key={artist.name}
                      type="button"
                      onClick={() => {
                        addFilterChip({
                          id: `artist:${artist.name}`,
                          type: 'artist',
                          label: artist.name,
                          tags: artist.tags,
                        });
                        setQuery('');
                        setFocused(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs text-slate-200 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Disc3 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span className="truncate font-medium">{artist.name}</span>
                      </div>
                      <span className="ml-2 truncate font-mono-tech text-[10px] text-slate-400">
                        {artist.tags.slice(0, 3).join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Countries */}
              {searchResults.countries.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-0.5 font-mono-tech text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {t(language, 'search.countries')}
                  </div>
                  {searchResults.countries.map((c) => (
                    <button
                      key={c.cc}
                      type="button"
                      onClick={() => {
                        flyToCoords(c.lat, c.lng, 2.0, false);
                        setSelectedCountryCode(c.cc);
                        setFocused(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs text-slate-200 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <span>{countryCodeToFlag(c.cc)}</span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                      <span className="font-mono-tech text-[11px] text-cyan-300">
                        {c.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Stations */}
              {searchResults.stations.length > 0 && (
                <div className="mb-1">
                  <div className="px-2 py-0.5 font-mono-tech text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {t(language, 'search.stations')}
                  </div>
                  {searchResults.stations.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        selectStation(st, { pushHistory: true, flyTo: true });
                        setFocused(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs text-slate-200 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Radio className="h-3 w-3 shrink-0 text-cyan-400" />
                        <span className="truncate font-semibold text-white">{st.name}</span>
                        <span className="truncate text-[11px] text-slate-400">
                          {countryCodeToFlag(st.countryCode)}{' '}
                          {st.region || getCountryName(st.countryCode, language)}
                        </span>
                      </div>
                      {st.tags[0] && (
                        <span className="ml-2 shrink-0 rounded bg-white/5 px-1.5 py-0.2 font-mono-tech text-[10px] text-slate-400">
                          {st.tags[0]}
                        </span>
                      )}
                    </button>
                  ))}

                  {searchResults.allMatchedStations.length > 8 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchDrawerStations({
                          title: query.trim(),
                          stations: searchResults.allMatchedStations,
                        });
                        setFocused(false);
                      }}
                      className="mt-1 w-full rounded-lg bg-cyan-500/15 py-1 text-center text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
                    >
                      {t(language, 'search.showAll', {
                        count: searchResults.allMatchedStations.length,
                      })}
                    </button>
                  )}
                </div>
              )}

              {/* Live Radio-Browser Fallback */}
              {liveStations.length > 0 && (
                <div className="mt-1.5 border-t border-white/10 pt-1.5">
                  <div className="px-2 py-0.5 font-mono-tech text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
                    {t(language, 'search.liveResults')}
                  </div>
                  {liveStations.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        selectStation(st, { pushHistory: true, flyTo: st.precise });
                        setFocused(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs text-slate-200 hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="h-3 w-3 shrink-0 text-emerald-400" />
                        <span className="truncate font-medium">{st.name}</span>
                      </div>
                      <span className="ml-2 shrink-0 text-[10px] text-slate-400">
                        {countryCodeToFlag(st.countryCode)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchResults.genres.length === 0 &&
                searchResults.artists.length === 0 &&
                searchResults.countries.length === 0 &&
                searchResults.stations.length === 0 &&
                liveStations.length === 0 && (
                  <div className="py-5 text-center text-xs text-slate-400">
                    {t(language, 'search.noResults')}
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Right: Direct Segmented Telemetry Controls (Surface, Stage, FM Static, Language, Inspector) */}
        <div className="flex items-center gap-1.5">
          {/* Globe Surface Mode: SAT vs VEC */}
          <div
            className="hidden sm:flex items-center rounded-lg border border-white/10 bg-slate-950/80 p-0.5"
            title={t(language, 'settings.globeView')}
          >
            <button
              type="button"
              onClick={() => setGlobeView('realistic')}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                globeView === 'realistic'
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t(language, 'settings.realistic')}
            </button>
            <button
              type="button"
              onClick={() => setGlobeView('minimal')}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                globeView === 'minimal'
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t(language, 'settings.minimal')}
            </button>
          </div>

          {/* Stage Switch: 3D Globe vs Shader Studio */}
          <div className="flex items-center rounded-lg border border-white/10 bg-slate-950/80 p-0.5">
            <button
              type="button"
              onClick={() => setVisualMode('globe')}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                visualMode === 'globe'
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe2 className="h-3 w-3" />
              <span>{t(language, 'mode.globe')}</span>
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('immersive')}
              className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                visualMode === 'immersive'
                  ? 'bg-purple-500/25 text-purple-200 ring-1 ring-purple-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>{t(language, 'mode.immersive')}</span>
            </button>
          </div>

          {/* FM Static Sound Toggle */}
          <button
            type="button"
            onClick={() => setTuningSound(!tuningSound)}
            title={t(language, 'settings.tuningSound')}
            className={`hidden md:flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
              tuningSound
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : 'border-white/10 bg-slate-950/60 text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className="h-3 w-3" />
            <span className="font-mono-tech">FM</span>
          </button>

          {/* Language Switcher: 中文 | EN */}
          <div
            className="flex items-center rounded-lg border border-white/10 bg-slate-950/80 p-0.5"
            aria-label={t(language, 'settings.language')}
          >
            <button
              type="button"
              onClick={() => setLanguage('zh')}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                language === 'zh'
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              中文
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                language === 'en'
                  ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Saved Library & Inspector Rail Toggle */}
          <button
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen, 'library')}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              inspectorOpen
                ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                : 'border-white/10 bg-slate-950/80 text-slate-200 hover:bg-white/10'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 text-amber-400" />
            <span>{t(language, 'library.button')}</span>
            {favorites.length > 0 && (
              <span className="rounded bg-amber-400/20 px-1 font-mono-tech text-[10px] font-bold text-amber-300">
                {favorites.length}
              </span>
            )}
            <PanelRight className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Sub-bar: Quick-Filter Genre Pills & Active Filter Chips */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 px-1">
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/75 px-2 py-1 backdrop-blur-md overflow-x-auto max-w-full">
          <Layers className="mr-1 h-3 w-3 shrink-0 text-cyan-400" />
          {QUICK_GENRES.map((g) => {
            const active = filterChips.some((c) => c.id === `genre:${g.tag}`);
            const label = t(language, g.key);
            return (
              <button
                key={g.tag}
                type="button"
                onClick={() => toggleQuickGenre(g.tag, g.tag)}
                className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                  active
                    ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Custom Active Chips */}
        {filterChips.map((chip) => (
          <span
            key={chip.id}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/40 bg-cyan-950/85 px-2 py-0.5 text-[11px] font-medium text-cyan-200 shadow backdrop-blur-md"
          >
            <span className="font-mono-tech">#</span>
            <span>{chip.label}</span>
            <button
              type="button"
              onClick={() => removeFilterChip(chip.id)}
              className="ml-0.5 rounded p-0.5 hover:bg-white/15"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {filterChips.length > 0 && (
          <button
            type="button"
            onClick={clearFilterChips}
            className="rounded-md border border-white/10 bg-slate-950/80 px-2 py-0.5 text-[11px] text-slate-300 hover:text-white"
          >
            {t(language, 'search.clearFilters')}
          </button>
        )}
      </div>
    </header>
  );
};

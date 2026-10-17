import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Disc3,
  Globe2,
  MapPin,
  Music,
  Radio,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { countryCodeToFlag, getCountryName, t } from '../lib/i18n';
import { normalizeText, searchLiveRadioBrowser } from '../lib/data';
import { ArtistEntry, ImmersivePreset, StationSummary } from '../types';

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

const AURA_THEMES: {
  id: ImmersivePreset;
  zh: string;
  zhShort: string;
  en: string;
  enShort: string;
  dotColor: string;
}[] = [
  { id: 'waves', zh: '蔚蓝大气', zhShort: '大气', en: 'Atmosphere', enShort: 'Atmo', dotColor: '#38bdf8' },
  { id: 'aurora', zh: '极地极光', zhShort: '极光', en: 'Aurora', enShort: 'Aurora', dotColor: '#34d399' },
  { id: 'ember', zh: '晨昏流金', zhShort: '晨昏', en: 'Terminator', enShort: 'Solar', dotColor: '#fbbf24' },
  { id: 'dusk', zh: '深空磁层', zhShort: '磁层', en: 'Magneto', enShort: 'Mag', dotColor: '#60a5fa' },
  { id: 'sculpture', zh: '电离辉光', zhShort: '电离', en: 'Ionosphere', enShort: 'Iono', dotColor: '#22d3ee' },
];

export const HeaderSearch: React.FC = () => {
  const meta = useAppStore((s) => s.meta);
  const allStations = useAppStore((s) => s.allStations);
  const tags = useAppStore((s) => s.tags);
  const artists = useAppStore((s) => s.artists);
  const language = useAppStore((s) => s.language);
  const globeView = useAppStore((s) => s.globeView);
  const immersivePreset = useAppStore((s) => s.immersivePreset);
  const filterChips = useAppStore((s) => s.filterChips);
  const filteredStationIds = useAppStore((s) => s.filteredStationIds);
  const favorites = useAppStore((s) => s.favorites);
  const inspectorOpen = useAppStore((s) => s.inspectorOpen);
  const inspectorTab = useAppStore((s) => s.inspectorTab);

  const selectStation = useAppStore((s) => s.selectStation);
  const addFilterChip = useAppStore((s) => s.addFilterChip);
  const removeFilterChip = useAppStore((s) => s.removeFilterChip);
  const clearFilterChips = useAppStore((s) => s.clearFilterChips);
  const setSelectedCountryCode = useAppStore((s) => s.setSelectedCountryCode);
  const setSearchDrawerStations = useAppStore((s) => s.setSearchDrawerStations);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setGlobeView = useAppStore((s) => s.setGlobeView);
  const setImmersivePreset = useAppStore((s) => s.setImmersivePreset);
  const setInspectorOpen = useAppStore((s) => s.setInspectorOpen);
  const flyToCoords = useAppStore((s) => s.flyToCoords);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [liveStations, setLiveStations] = useState<StationSummary[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const toggleQuickGenre = (tag: string, label: string) => {
    const chipId = `genre:${tag}`;
    if (filterChips.some((c) => c.id === chipId)) {
      removeFilterChip(chipId);
    } else {
      addFilterChip({ id: chipId, type: 'genre', label, tag });
    }
  };

  const currentAura =
    AURA_THEMES.find((a) => a.id === immersivePreset) || AURA_THEMES[0];

  const cycleAuraTheme = () => {
    const idx = AURA_THEMES.findIndex((a) => a.id === immersivePreset);
    const next = AURA_THEMES[(idx + 1) % AURA_THEMES.length];
    setImmersivePreset(next.id);
  };

  return (
    <header
      ref={containerRef}
      className="pointer-events-none fixed inset-x-3 top-3 sm:inset-x-5 sm:top-5 z-30 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-3 md:gap-4"
    >
      {/* Left: Floating Brand & Live Count Capsule */}
      <div className="glass-pill pointer-events-auto order-1 flex shrink-0 items-center gap-2 sm:gap-3 rounded-full px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: currentAura.dotColor }}
            />
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: currentAura.dotColor }}
            />
          </span>
          <span className="font-display text-[14px] sm:text-[15px] font-semibold tracking-tight text-white">
            GeoRadios
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1 border-l border-white/12 pl-2.5 sm:pl-3 text-[11px] sm:text-xs text-slate-300/90">
          <span className="font-mono-tech font-medium text-cyan-300">
            {stationCount.toLocaleString()}
          </span>
          <span className="hidden lg:inline">
            {language === 'zh' ? '全球在线电台' : 'Live Stations'}
          </span>
        </div>
      </div>

      {/* Center (Row 2 on mobile, Center on md+): Floating Spotlight Search & Mood Capsule */}
      <div className="pointer-events-auto relative order-3 md:order-2 w-full md:w-auto md:flex-1 md:max-w-md min-w-0">
        <div
          className={`glass-pill flex items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 transition-all duration-200 ${
            focused
              ? 'ring-1 ring-cyan-400/50 bg-slate-900/85'
              : 'hover:border-white/20'
          }`}
        >
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
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
            className="w-full min-w-0 bg-transparent text-[13px] text-white placeholder-slate-400 focus:outline-none"
          />

          {/* Active Filter Chip Badge inside capsule */}
          {filterChips.length > 0 && !query && (
            <button
              type="button"
              onClick={clearFilterChips}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-400/20 px-2.5 py-0.5 text-xs font-medium text-cyan-200 border border-cyan-400/35 hover:bg-cyan-400/30"
            >
              <span>{filterChips[0].label}</span>
              {filterChips.length > 1 && <span>+{filterChips.length - 1}</span>}
              <X className="h-3 w-3" />
            </button>
          )}

          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono-tech text-[11px] text-slate-400">
              /
            </kbd>
          )}
        </div>

        {/* Progressive Disclosure Popover: Mood Pills (when empty) or Instant Search Results */}
        {focused && (
          <div className="glass-card absolute left-0 right-0 top-full mt-2.5 max-h-[68vh] overflow-y-auto rounded-3xl p-4 z-50">
            {!searchResults ? (
              <div>
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-slate-400">
                    {language === 'zh' ? '探索音乐风格与流派' : 'Explore Moods & Genres'}
                  </span>
                  {filterChips.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFilterChips}
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      {t(language, 'search.clearFilters')}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_GENRES.map((g) => {
                    const active = filterChips.some((c) => c.id === `genre:${g.tag}`);
                    const label = t(language, g.key);
                    return (
                      <button
                        key={g.tag}
                        type="button"
                        onClick={() => toggleQuickGenre(g.tag, label)}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                          active
                            ? 'bg-cyan-400 text-slate-950 font-semibold shadow-md shadow-cyan-500/20'
                            : 'border border-white/10 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Genres */}
                {searchResults.genres.length > 0 && (
                  <div>
                    <div className="mb-1.5 px-2 text-xs font-medium text-slate-400">
                      {t(language, 'search.genres')}
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-1">
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:text-white"
                        >
                          <Music className="h-3 w-3 text-cyan-400" />
                          <span>{tagName}</span>
                          <span className="font-mono-tech text-[11px] text-slate-400">{count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artists */}
                {searchResults.artists.length > 0 && (
                  <div>
                    <div className="mb-1 px-2 text-xs font-medium text-slate-400">
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
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[13px] text-slate-200 hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Disc3 className="h-4 w-4 shrink-0 text-amber-400" />
                          <span className="truncate font-medium">{artist.name}</span>
                        </div>
                        <span className="ml-2 truncate text-xs text-slate-400">
                          {artist.tags.slice(0, 3).join(' · ')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Countries */}
                {searchResults.countries.length > 0 && (
                  <div>
                    <div className="mb-1 px-2 text-xs font-medium text-slate-400">
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
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[13px] text-slate-200 hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{countryCodeToFlag(c.cc)}</span>
                          <span className="font-medium">{c.name}</span>
                        </div>
                        <span className="font-mono-tech text-xs text-cyan-300">
                          {c.count.toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Stations */}
                {searchResults.stations.length > 0 && (
                  <div>
                    <div className="mb-1 px-2 text-xs font-medium text-slate-400">
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
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[13px] text-slate-200 hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Radio className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                          <span className="truncate font-medium text-white">{st.name}</span>
                          <span className="truncate text-xs text-slate-400">
                            {countryCodeToFlag(st.countryCode)}{' '}
                            {st.region || getCountryName(st.countryCode, language)}
                          </span>
                        </div>
                        {st.tags[0] && (
                          <span className="ml-2 shrink-0 rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] text-slate-300">
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
                        className="mt-2 w-full rounded-2xl bg-cyan-500/15 py-2 text-center text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
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
                  <div className="border-t border-white/10 pt-2">
                    <div className="mb-1 px-2 text-xs font-medium text-emerald-400">
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
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-[13px] text-slate-200 hover:bg-white/10"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span className="truncate font-medium">{st.name}</span>
                        </div>
                        <span className="ml-2 shrink-0 text-xs text-slate-400">
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
                    <div className="py-6 text-center text-[13px] text-slate-400">
                      {t(language, 'search.noResults')}
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Floating Spatial Controls Capsule */}
      <div className="glass-pill pointer-events-auto order-2 md:order-3 flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-full p-1 sm:p-1.5">
        {/* Planetary Musical Aura Theme Cycler */}
        <button
          type="button"
          onClick={cycleAuraTheme}
          title={language === 'zh' ? '切换地球外围光影律动主题' : 'Cycle Planetary Sonic Aura'}
          className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-white/6 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-slate-100 transition hover:bg-white/12"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: currentAura.dotColor }} />
          <span className="sm:hidden">
            {language === 'zh' ? currentAura.zhShort : currentAura.enShort}
          </span>
          <span className="hidden sm:inline">
            {language === 'zh' ? currentAura.zh : currentAura.en}
          </span>
        </button>

        {/* Globe Surface Toggle (Satellite / Minimal) */}
        <button
          type="button"
          onClick={() => setGlobeView(globeView === 'realistic' ? 'minimal' : 'realistic')}
          title={
            globeView === 'realistic'
              ? language === 'zh'
                ? '卫星地球'
                : 'Satellite'
              : language === 'zh'
              ? '极简地球'
              : 'Minimal'
          }
          className="flex items-center gap-1.5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <Globe2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
          <span className="hidden lg:inline">
            {globeView === 'realistic'
              ? language === 'zh'
                ? '卫星地球'
                : 'Satellite'
              : language === 'zh'
              ? '极简地球'
              : 'Minimal'}
          </span>
        </button>

        {/* Saved / Favorites Card Toggle */}
        <button
          type="button"
          onClick={() =>
            setInspectorOpen(!(inspectorOpen && inspectorTab === 'library'), 'library')
          }
          title={t(language, 'library.button')}
          className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 text-xs font-medium transition ${
            inspectorOpen && inspectorTab === 'library'
              ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="hidden sm:inline">{t(language, 'library.button')}</span>
          {favorites.length > 0 && (
            <span className="rounded-full bg-amber-400/20 px-1.5 font-mono-tech text-[11px] font-semibold text-amber-300">
              {favorites.length}
            </span>
          )}
        </button>

        {/* Language Toggle (中文 / EN) */}
        <button
          type="button"
          onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
          className="rounded-full bg-white/8 px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 hover:text-white"
        >
          {language === 'zh' ? 'EN' : '中文'}
        </button>
      </div>
    </header>
  );
};

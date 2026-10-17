import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Clock,
  Disc3,
  Heart,
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
import { ArtistEntry, StationSummary } from '../types';

export const HeaderSearch: React.FC = () => {
  const meta = useAppStore((s) => s.meta);
  const allStations = useAppStore((s) => s.allStations);
  const tags = useAppStore((s) => s.tags);
  const artists = useAppStore((s) => s.artists);
  const language = useAppStore((s) => s.language);
  const filterChips = useAppStore((s) => s.filterChips);
  const filteredStationIds = useAppStore((s) => s.filteredStationIds);
  const favorites = useAppStore((s) => s.favorites);
  const recent = useAppStore((s) => s.recent);
  const libraryOpen = useAppStore((s) => s.libraryOpen);
  const libraryTab = useAppStore((s) => s.libraryTab);
  const currentStation = useAppStore((s) => s.currentStation);

  const selectStation = useAppStore((s) => s.selectStation);
  const addFilterChip = useAppStore((s) => s.addFilterChip);
  const removeFilterChip = useAppStore((s) => s.removeFilterChip);
  const clearFilterChips = useAppStore((s) => s.clearFilterChips);
  const setSelectedCountryCode = useAppStore((s) => s.setSelectedCountryCode);
  const setSearchDrawerStations = useAppStore((s) => s.setSearchDrawerStations);
  const setLibraryOpen = useAppStore((s) => s.setLibraryOpen);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const flyToCoords = useAppStore((s) => s.flyToCoords);

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [liveStations, setLiveStations] = useState<StationSummary[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Precompute country counts & centroids
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

  // Search results computation
  const searchResults = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return null;

    const matchedGenres = tags
      .filter(([tagName]) => normalizeText(tagName).includes(q))
      .slice(0, 5);

    const matchedArtists: ArtistEntry[] = artists
      .filter(
        (a) =>
          normalizeText(a.name).includes(q) ||
          (a.aliases && a.aliases.some((al) => normalizeText(al).includes(q)))
      )
      .slice(0, 4);

    const matchedCountries = countryEntries
      .filter((c) => c.norm.includes(q) || c.cc.toLowerCase() === q)
      .slice(0, 4);

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

  // Live Radio-Browser API search fallback when query >= 3 chars
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
    }, 380);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const stationCount = filteredStationIds
    ? filteredStationIds.size
    : meta?.stations ?? allStations.length;
  const countryCount = meta?.countries ?? 205;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed top-4 left-4 z-30 flex w-[calc(100vw-4.5rem)] max-w-sm flex-col gap-2.5 sm:w-96"
    >
      {/* Brand + Library Card */}
      <div className="pointer-events-auto flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/75 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-400/40">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#4ade80]" />
            <span className="absolute inset-1 rounded-full border border-cyan-400/50" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-white">GeoRadios</h1>
              <span className="truncate text-[11px] font-medium text-slate-400">
                {t(language, 'header.count', {
                  stations: stationCount.toLocaleString(),
                  countries: countryCount,
                })}
              </span>
            </div>
            <p className="truncate text-[11px] text-slate-400">{t(language, 'header.tagline')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setLibraryOpen(!libraryOpen)}
          className={`ml-2 flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition ${
            libraryOpen
              ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
              : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5 text-amber-400" />
          <span>{t(language, 'library.button')}</span>
          {favorites.length > 0 && (
            <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
              {favorites.length}
            </span>
          )}
        </button>
      </div>

      {/* Unified Search Input */}
      <div className="pointer-events-auto relative">
        <div className="flex items-center rounded-2xl border border-white/10 bg-slate-950/75 px-3.5 py-2 shadow-xl backdrop-blur-xl focus-within:border-cyan-400/50">
          <Search className="mr-2.5 h-4 w-4 shrink-0 text-slate-400" />
          <input
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
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="ml-1.5 rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Active Filter Chips */}
        {filterChips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {filterChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-950/80 px-2.5 py-1 text-[11px] font-medium text-cyan-200 shadow backdrop-blur-md"
              >
                {chip.type === 'artist' ? (
                  <Sparkles className="h-3 w-3 text-amber-300" />
                ) : (
                  <Music className="h-3 w-3 text-cyan-300" />
                )}
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={() => removeFilterChip(chip.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-white/15"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearFilterChips}
              className="rounded-full bg-slate-900/80 px-2 py-1 text-[11px] text-slate-400 hover:text-white"
            >
              {t(language, 'search.clearFilters')}
            </button>
          </div>
        )}

        {/* Search Dropdown Results */}
        {focused && searchResults && (
          <div className="mt-2 max-h-[65vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-2xl">
            {/* Genres */}
            {searchResults.genres.length > 0 && (
              <div className="mb-2">
                <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  {t(language, 'search.genres')}
                </div>
                <div className="flex flex-wrap gap-1.5 px-2 py-1">
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:border-cyan-400/50 hover:bg-cyan-400/15 hover:text-white"
                    >
                      <Music className="h-3 w-3 text-cyan-400" />
                      <span>{tagName}</span>
                      <span className="text-[10px] text-slate-400">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Artists */}
            {searchResults.artists.length > 0 && (
              <div className="mb-2">
                <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
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
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Disc3 className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate font-medium">{artist.name}</span>
                    </div>
                    <span className="ml-2 truncate text-[10px] text-slate-400">
                      {artist.tags.slice(0, 3).join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Countries */}
            {searchResults.countries.length > 0 && (
              <div className="mb-2">
                <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
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
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span>{countryCodeToFlag(c.cc)}</span>
                      <span className="font-medium">{c.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {c.count.toLocaleString()} stations
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Stations */}
            {searchResults.stations.length > 0 && (
              <div className="mb-1">
                <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
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
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Radio className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">{st.name}</div>
                        <div className="truncate text-[10px] text-slate-400">
                          {countryCodeToFlag(st.countryCode)}{' '}
                          {st.region ? `${st.region}, ` : ''}
                          {getCountryName(st.countryCode, language)}
                        </div>
                      </div>
                    </div>
                    {st.tags[0] && (
                      <span className="ml-2 shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
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
                    className="mt-1 w-full rounded-xl bg-cyan-500/15 py-1.5 text-center text-xs font-medium text-cyan-300 hover:bg-cyan-500/25"
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
              <div className="mt-2 border-t border-white/10 pt-2">
                <div className="px-2.5 py-1 text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
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
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs text-slate-200 hover:bg-white/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
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
                <div className="py-6 text-center text-xs text-slate-400">
                  {t(language, 'search.noResults')}
                </div>
              )}
          </div>
        )}
      </div>

      {/* Your Stations Library Popover */}
      {libraryOpen && (
        <div className="pointer-events-auto max-h-[60vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-2xl flex flex-col">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setLibraryOpen(true, 'favorites')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  libraryTab === 'favorites'
                    ? 'bg-amber-400/20 text-amber-200'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Heart className="h-3.5 w-3.5" />
                <span>{t(language, 'library.favorites')}</span>
                <span className="text-[10px] opacity-75">({favorites.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setLibraryOpen(true, 'recent')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  libraryTab === 'recent'
                    ? 'bg-cyan-400/20 text-cyan-200'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{t(language, 'library.recent')}</span>
                <span className="text-[10px] opacity-75">({recent.length})</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLibraryOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto p-2 space-y-1">
            {(libraryTab === 'favorites' ? favorites : recent).length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-slate-400">
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
                    className={`flex items-center justify-between rounded-xl px-2.5 py-2 transition ${
                      isPlaying ? 'bg-emerald-500/15 ring-1 ring-emerald-400/40' : 'hover:bg-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        selectStation(st, { pushHistory: true, flyTo: true });
                        setLibraryOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className="text-base">{countryCodeToFlag(st.countryCode)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">{st.name}</div>
                        <div className="truncate text-[10px] text-slate-400">
                          {st.region ? `${st.region}, ` : ''}
                          {getCountryName(st.countryCode, language)}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(st)}
                      className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-amber-400"
                    >
                      <Heart
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
    </div>
  );
};

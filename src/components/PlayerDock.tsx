import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Dices,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Radio,
  Share2,
  SkipBack,
  SkipForward,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  countryCodeToFlag,
  formatCoords,
  formatStationLocalTime,
  getCountryName,
  t,
} from '../lib/i18n';
import { audioEngine } from '../lib/audio';

export const PlayerDock: React.FC = () => {
  const currentStation = useAppStore((s) => s.currentStation);
  const playbackStatus = useAppStore((s) => s.playbackStatus);
  const historyBackStack = useAppStore((s) => s.historyBackStack);
  const volume = useAppStore((s) => s.volume);
  const muted = useAppStore((s) => s.muted);
  const playerMinimized = useAppStore((s) => s.playerMinimized);
  const language = useAppStore((s) => s.language);
  const favorites = useAppStore((s) => s.favorites);

  const togglePlayPause = useAppStore((s) => s.togglePlayPause);
  const playPrevious = useAppStore((s) => s.playPrevious);
  const playNextNearest = useAppStore((s) => s.playNextNearest);
  const playSurpriseMe = useAppStore((s) => s.playSurpriseMe);
  const locateCurrentStation = useAppStore((s) => s.locateCurrentStation);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addFilterChip = useAppStore((s) => s.addFilterChip);
  const setVolume = useAppStore((s) => s.setVolume);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const setPlayerMinimized = useAppStore((s) => s.setPlayerMinimized);
  const setInspectorOpen = useAppStore((s) => s.setInspectorOpen);

  const [copied, setCopied] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [bars, setBars] = useState<number[]>([0.2, 0.35, 0.25, 0.4, 0.3]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (playbackStatus !== 'playing') {
      setBars([0.15, 0.15, 0.15, 0.15, 0.15]);
      return;
    }
    const id = window.setInterval(() => {
      const tSec = performance.now() / 1000;
      const b = audioEngine.getAudioBands(tSec);
      setBars([
        Math.min(1, Math.max(0.15, b.bass * 1.1)),
        Math.min(1, Math.max(0.15, (b.bass + b.mid) * 0.6)),
        Math.min(1, Math.max(0.15, b.mid * 1.15)),
        Math.min(1, Math.max(0.15, (b.mid + b.high) * 0.65)),
        Math.min(1, Math.max(0.15, b.high * 1.25 + b.pulse * 0.3)),
      ]);
    }, 90);
    return () => window.clearInterval(id);
  }, [playbackStatus]);

  const handleSurprise = () => {
    setDiceRolling(true);
    playSurpriseMe();
    window.setTimeout(() => setDiceRolling(false), 650);
  };

  const handleShare = () => {
    if (!currentStation) return;
    const url = new URL(window.location.href);
    url.searchParams.set('station', currentStation.id);
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const isFav = currentStation ? favorites.some((f) => f.id === currentStation.id) : false;
  const localTime = currentStation?.timezone
    ? formatStationLocalTime(currentStation.timezone, now)
    : null;

  if (!currentStation) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-3">
        <div className="glass-panel pointer-events-auto flex items-center gap-3 rounded-xl py-2 pr-2.5 pl-3.5">
          <Radio className="h-4 w-4 shrink-0 text-cyan-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-200">
            {t(language, 'player.idleHint')}
          </span>
          <button
            type="button"
            onClick={handleSurprise}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 shadow transition hover:bg-cyan-300"
          >
            <Dices className={`h-3.5 w-3.5 ${diceRolling ? 'animate-spin' : ''}`} />
            <span>{t(language, 'player.SurpriseMe')}</span>
          </button>
        </div>
      </div>
    );
  }

  if (playerMinimized) {
    return (
      <div className="pointer-events-none fixed left-3 bottom-3 z-30">
        <div className="glass-panel pointer-events-auto flex items-center gap-2 rounded-xl py-1.5 pr-2 pl-2.5">
          <button
            type="button"
            onClick={togglePlayPause}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400 text-slate-950"
          >
            {playbackStatus === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : playbackStatus === 'playing' ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>
          <div className="max-w-[180px] truncate text-xs font-bold text-white">
            {currentStation.name}
          </div>
          <button
            type="button"
            onClick={() => setPlayerMinimized(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
            title={t(language, 'player.expand')}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <footer className="pointer-events-none fixed inset-x-3 bottom-3 z-30 flex justify-center">
      <div className="glass-panel pointer-events-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-xl px-3.5 py-2.5">
        {/* Left: Station Identity & High-Density Telemetry */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => setInspectorOpen(true, 'place')}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-900"
          >
            {currentStation.favicon ? (
              <img
                src={currentStation.favicon}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Radio className="h-4 w-4 text-cyan-400" />
            )}
            <div className="pointer-events-none absolute inset-x-1 bottom-0.5 flex h-2.5 items-end justify-center gap-0.5">
              {bars.map((h, idx) => (
                <span
                  key={idx}
                  style={{ height: `${Math.round(h * 100)}%` }}
                  className="w-0.5 rounded-full bg-cyan-400 transition-all duration-75"
                />
              ))}
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  playbackStatus === 'playing'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#4ade80]'
                    : playbackStatus === 'loading'
                    ? 'bg-cyan-400 animate-ping'
                    : playbackStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-slate-500'
                }`}
              />
              <h2 className="truncate font-condensed text-sm font-bold tracking-tight text-white">
                {currentStation.name}
              </h2>
              {currentStation.homepage && (
                <a
                  href={currentStation.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-slate-400 hover:text-cyan-300"
                  title="Station homepage"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300">
              <span className="font-medium">
                {countryCodeToFlag(currentStation.countryCode)}{' '}
                {currentStation.region ? `${currentStation.region}, ` : ''}
                {getCountryName(currentStation.countryCode, language)}
              </span>
              <span className="font-mono-tech text-[10px] text-slate-400">
                {formatCoords(currentStation.lat, currentStation.lng)}
              </span>
              {localTime && (
                <span className="font-mono-tech text-[10px] text-cyan-300">
                  {localTime.isNight ? '🌙' : '☀️'} {localTime.formatted}
                </span>
              )}
              {currentStation.codec && (
                <span className="hidden md:inline rounded bg-white/5 px-1.5 py-0.2 font-mono-tech text-[10px] text-slate-400">
                  {currentStation.codec}
                  {currentStation.bitrate ? ` ${currentStation.bitrate}k` : ''}
                </span>
              )}
            </div>

            {playbackStatus === 'loading' ? (
              <div className="mt-0.5 font-mono-tech text-[10px] font-semibold text-cyan-300">
                {t(language, 'player.loading')}
              </div>
            ) : playbackStatus === 'error' ? (
              <div className="mt-0.5 font-mono-tech text-[10px] font-semibold text-rose-400">
                {t(language, 'player.error')}
              </div>
            ) : (
              currentStation.tags.length > 0 && (
                <div className="mt-1 hidden sm:flex flex-wrap gap-1">
                  {currentStation.tags.slice(0, 4).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        addFilterChip({
                          id: `genre:${tag}`,
                          type: 'genre',
                          label: tag,
                          tag,
                        })
                      }
                      className="rounded bg-white/5 px-1.5 py-0.2 font-mono-tech text-[10px] text-slate-300 transition hover:bg-cyan-400/20 hover:text-cyan-200"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* Center: Precision Studio Transport Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={historyBackStack.length === 0}
            onClick={playPrevious}
            title={t(language, 'player.previous')}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            title={
              playbackStatus === 'playing'
                ? t(language, 'player.pause')
                : t(language, 'player.play')
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.4)] transition hover:bg-cyan-300"
          >
            {playbackStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : playbackStatus === 'playing' ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={playNextNearest}
            title={t(language, 'player.next')}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleSurprise}
            title={t(language, 'player.SurpriseMe')}
            className="ml-1 flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/15 px-2.5 py-1.5 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/25"
          >
            <Dices className={`h-3.5 w-3.5 ${diceRolling ? 'animate-spin' : ''}`} />
            <span>{t(language, 'player.SurpriseMe')}</span>
          </button>
        </div>

        {/* Right: Utility Deck (Locate, Star, Share, Volume, Collapse) */}
        <div className="flex items-center gap-1">
          <div className="hidden md:flex items-center gap-1.5 mr-1">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Toggle mute"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-3.5 w-3.5 text-rose-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number.parseFloat(e.target.value))}
              aria-label="Volume"
              className="h-1 w-16 cursor-pointer accent-cyan-400"
            />
          </div>

          <button
            type="button"
            onClick={locateCurrentStation}
            title={t(language, 'player.locate')}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-cyan-300"
          >
            <Compass className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => toggleFavorite(currentStation)}
            title={t(language, 'player.favorite')}
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-amber-400"
          >
            <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            title={t(language, 'player.share')}
            className="relative rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Share2 className="h-4 w-4" />
            {copied && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-emerald-400 px-1.5 py-0.5 font-mono-tech text-[10px] font-bold text-slate-950 shadow">
                {t(language, 'player.copied')}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setPlayerMinimized(true)}
            title={t(language, 'player.minimize')}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Dices,
  ExternalLink,
  Globe2,
  Heart,
  Loader2,
  Pause,
  Play,
  Radio,
  Share2,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  countryCodeToFlag,
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
  const visualMode = useAppStore((s) => s.visualMode);
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
  const setVisualMode = useAppStore((s) => s.setVisualMode);
  const setPlayerMinimized = useAppStore((s) => s.setPlayerMinimized);

  const [copied, setCopied] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [bars, setBars] = useState<number[]>([0.2, 0.35, 0.25, 0.4, 0.3]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  // Live mini spectrum animation when playing
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

  // Idle state before any station is selected
  if (!currentStation) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/85 py-2 pr-2.5 pl-4 shadow-2xl backdrop-blur-xl">
          <Radio className="h-4 w-4 shrink-0 text-cyan-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-200">
            {t(language, 'player.idleHint')}
          </span>
          <button
            type="button"
            onClick={handleSurprise}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-lg transition hover:brightness-110"
          >
            <Dices className={`h-3.5 w-3.5 ${diceRolling ? 'animate-spin' : ''}`} />
            <span>{t(language, 'player.SurpriseMe')}</span>
          </button>
        </div>
      </div>
    );
  }

  // Minimized pill view
  if (playerMinimized) {
    return (
      <div className="pointer-events-none fixed right-4 bottom-4 z-30">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-950/90 py-1.5 pr-2 pl-3.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={togglePlayPause}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400 text-slate-950"
          >
            {playbackStatus === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : playbackStatus === 'playing' ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
            )}
          </button>
          <div className="max-w-[160px] truncate text-xs font-semibold text-white">
            {currentStation.name}
          </div>
          <button
            type="button"
            onClick={() => setPlayerMinimized(false)}
            className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            title={t(language, 'player.expand')}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-3 sm:px-6">
      <div className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/85 p-3 shadow-2xl backdrop-blur-2xl">
        {/* Top Row: Station Metadata + Action Icons */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Station Favicon / Status Badge */}
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900">
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
                <Radio className="h-5 w-5 text-cyan-400" />
              )}
              {/* Mini audio spectrum overlay at bottom of avatar */}
              <div className="absolute inset-x-1 bottom-1 flex items-end justify-center gap-0.5 h-3 pointer-events-none">
                {bars.map((h, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${Math.round(h * 100)}%` }}
                    className="w-1 rounded-full bg-emerald-400/90 transition-all duration-75"
                  />
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-bold text-white">{currentStation.name}</h2>
                {currentStation.homepage && (
                  <a
                    href={currentStation.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-slate-400 hover:text-cyan-300"
                    title="Station website"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-300">
                <span>
                  {countryCodeToFlag(currentStation.countryCode)}{' '}
                  {currentStation.region ? `${currentStation.region}, ` : ''}
                  {getCountryName(currentStation.countryCode, language)}
                </span>
                {localTime && (
                  <span className="text-slate-400">
                    · {localTime.isNight ? '🌙' : '☀️'} {localTime.formatted}
                  </span>
                )}
                {currentStation.codec && (
                  <span className="hidden sm:inline rounded bg-white/5 px-1.5 py-0.2 text-[10px] text-slate-400">
                    {currentStation.codec}
                    {currentStation.bitrate ? ` ${currentStation.bitrate}k` : ''}
                  </span>
                )}
              </div>

              {/* Status or Genre Tags */}
              {playbackStatus === 'loading' ? (
                <div className="mt-1 text-[11px] font-medium text-cyan-300">
                  {t(language, 'player.loading')}
                </div>
              ) : playbackStatus === 'error' ? (
                <div className="mt-1 text-[11px] font-medium text-rose-400">
                  {t(language, 'player.error')}
                </div>
              ) : (
                currentStation.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
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
                        className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-cyan-400/20 hover:text-cyan-200"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>

          {/* Utility Icon Buttons */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={locateCurrentStation}
              title={t(language, 'player.locate')}
              className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-cyan-300"
            >
              <Compass className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => toggleFavorite(currentStation)}
              title={t(language, 'player.favorite')}
              className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-amber-400"
            >
              <Heart
                className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`}
              />
            </button>
            <button
              type="button"
              onClick={handleShare}
              title={t(language, 'player.share')}
              className="relative rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <Share2 className="h-4 w-4" />
              {copied && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950 shadow">
                  {t(language, 'player.copied')}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPlayerMinimized(true)}
              title={t(language, 'player.minimize')}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bottom Row: Transport Controls + Volume + Globe/Immersive Switch */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          {/* Transport */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={historyBackStack.length === 0}
              onClick={playPrevious}
              title={t(language, 'player.previous')}
              className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400 text-slate-950 shadow-[0_0_16px_rgba(74,222,128,0.45)] transition hover:scale-105 hover:bg-emerald-300"
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
              className="rounded-xl p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleSurprise}
              title={t(language, 'player.SurpriseMe')}
              className="ml-1 flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-400/60 hover:bg-cyan-400/20"
            >
              <Dices className={`h-3.5 w-3.5 ${diceRolling ? 'animate-spin' : ''}`} />
              <span>{t(language, 'player.SurpriseMe')}</span>
            </button>
          </div>

          {/* Volume + Mode Switcher */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Toggle mute"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4" />
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
                className="h-1.5 w-20 cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Globe | Immersive segmented switch */}
            <div className="flex items-center rounded-xl border border-white/10 bg-slate-900/90 p-0.5">
              <button
                type="button"
                onClick={() => setVisualMode('globe')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  visualMode === 'globe'
                    ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe2 className="h-3.5 w-3.5" />
                <span>{t(language, 'mode.globe')}</span>
              </button>
              <button
                type="button"
                onClick={() => setVisualMode('immersive')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  visualMode === 'immersive'
                    ? 'bg-purple-500/25 text-purple-200 ring-1 ring-purple-400/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t(language, 'mode.immersive')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Compass,
  Dices,
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
  const language = useAppStore((s) => s.language);
  const favorites = useAppStore((s) => s.favorites);
  const inspectorOpen = useAppStore((s) => s.inspectorOpen);

  const togglePlayPause = useAppStore((s) => s.togglePlayPause);
  const playPrevious = useAppStore((s) => s.playPrevious);
  const playNextNearest = useAppStore((s) => s.playNextNearest);
  const playSurpriseMe = useAppStore((s) => s.playSurpriseMe);
  const locateCurrentStation = useAppStore((s) => s.locateCurrentStation);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const setVolume = useAppStore((s) => s.setVolume);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const setInspectorOpen = useAppStore((s) => s.setInspectorOpen);

  const [copied, setCopied] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [bars, setBars] = useState<number[]>([0.2, 0.35, 0.25, 0.4]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (playbackStatus !== 'playing') {
      setBars([0.18, 0.18, 0.18, 0.18]);
      return;
    }
    const id = window.setInterval(() => {
      const tSec = performance.now() / 1000;
      const b = audioEngine.getAudioBands(tSec);
      setBars([
        Math.min(1, Math.max(0.18, b.bass * 1.15)),
        Math.min(1, Math.max(0.18, (b.bass + b.mid) * 0.65)),
        Math.min(1, Math.max(0.18, b.mid * 1.2)),
        Math.min(1, Math.max(0.18, b.high * 1.25 + b.pulse * 0.3)),
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
      <div className="pointer-events-none fixed inset-x-0 bottom-4 sm:bottom-6 z-30 flex justify-center px-3 sm:px-4">
        <div className="glass-pill pointer-events-auto flex max-w-full items-center gap-3 sm:gap-4 rounded-full py-1.5 sm:py-2 pr-2 sm:pr-2.5 pl-4 sm:pl-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <Radio className="h-4 w-4 shrink-0 text-cyan-400 animate-pulse" />
            <span className="truncate text-xs sm:text-[13px] font-medium text-slate-200">
              {t(language, 'player.idleHint')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSurprise}
            className="flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-full bg-white px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-slate-950 shadow-lg transition hover:scale-105 hover:bg-cyan-100"
          >
            <Dices className={`h-3.5 w-3.5 shrink-0 ${diceRolling ? 'animate-spin' : ''}`} />
            <span>{t(language, 'player.SurpriseMe')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <footer className="pointer-events-none fixed inset-x-3 sm:inset-x-4 bottom-4 sm:bottom-6 z-30 flex justify-center">
      <div className="glass-pill pointer-events-auto flex w-full max-w-[680px] items-center justify-between gap-2 sm:gap-4 rounded-full px-3 py-2 sm:px-4 sm:py-2.5">
        {/* Left: Sonic Vinyl Avatar & Clean 2-Line Station Info */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3.5">
          <button
            type="button"
            onClick={locateCurrentStation}
            title={t(language, 'player.locate')}
            className="relative flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-slate-900 shadow-inner transition hover:scale-105"
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
              <Radio className="h-5 w-5 text-cyan-300" />
            )}
            <div className="pointer-events-none absolute inset-x-2 bottom-1 flex h-2.5 items-end justify-center gap-0.5">
              {bars.map((h, idx) => (
                <span
                  key={idx}
                  style={{ height: `${Math.round(h * 100)}%` }}
                  className="w-0.5 rounded-full bg-cyan-300 transition-all duration-75"
                />
              ))}
            </div>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  playbackStatus === 'playing'
                    ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                    : playbackStatus === 'loading'
                    ? 'bg-cyan-400 animate-ping'
                    : playbackStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
              <h2 className="truncate text-[15px] font-semibold text-white">
                {currentStation.name}
              </h2>
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-300/90 truncate">
              <span className="truncate">
                {countryCodeToFlag(currentStation.countryCode)}{' '}
                {currentStation.region ? `${currentStation.region} · ` : ''}
                {getCountryName(currentStation.countryCode, language)}
              </span>
              {localTime && (
                <span className="hidden sm:inline font-mono-tech text-[11px] text-slate-400">
                  · {localTime.isNight ? '🌙' : '☀️'} {localTime.formatted}
                </span>
              )}
              {currentStation.tags[0] && (
                <span className="hidden md:inline rounded-full bg-white/8 px-2 py-0.2 text-[11px] text-cyan-200/90">
                  {currentStation.tags[0]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Sculptural Transport Controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            disabled={historyBackStack.length === 0}
            onClick={playPrevious}
            title={t(language, 'player.previous')}
            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
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
            className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.45)] transition hover:scale-105 hover:bg-cyan-100"
          >
            {playbackStatus === 'loading' ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-900" />
            ) : playbackStatus === 'playing' ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={playNextNearest}
            title={t(language, 'player.next')}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleSurprise}
            title={t(language, 'player.SurpriseMe')}
            className="ml-0.5 sm:ml-1 flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/15 px-2.5 sm:px-3.5 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/25 hover:text-white"
          >
            <Dices className={`h-3.5 w-3.5 ${diceRolling ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t(language, 'player.SurpriseMe')}</span>
          </button>
        </div>

        {/* Right: Minimal Utility Icons */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 border-l border-white/10 pl-2 sm:pl-3">
          <div className="hidden lg:flex items-center gap-1.5 mr-1">
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
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
              className="h-1 w-14 cursor-pointer accent-cyan-400"
            />
          </div>

          <button
            type="button"
            onClick={() => toggleFavorite(currentStation)}
            title={t(language, 'player.favorite')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-amber-400"
          >
            <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            title={t(language, 'player.share')}
            className="relative hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <Share2 className="h-4 w-4" />
            {copied && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-400 px-2.5 py-0.5 text-[11px] font-semibold text-slate-950 shadow">
                {t(language, 'player.copied')}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setInspectorOpen(!inspectorOpen, 'place')}
            title={language === 'zh' ? '展开/收起城市人文卡片' : 'Toggle Story Card'}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
              inspectorOpen
                ? 'bg-cyan-400/20 text-cyan-200 ring-1 ring-cyan-400/40'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Compass className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { GlobeCanvas } from './components/GlobeCanvas';
import { ImmersiveVisualizer } from './components/ImmersiveVisualizer';
import { HeaderSearch } from './components/HeaderSearch';
import { PlayerDock } from './components/PlayerDock';
import { Overlays } from './components/Overlays';

export const App: React.FC = () => {
  const initialize = useAppStore((s) => s.initialize);
  const visualMode = useAppStore((s) => s.visualMode);
  const setVisualMode = useAppStore((s) => s.setVisualMode);
  const togglePlayPause = useAppStore((s) => s.togglePlayPause);
  const screensaver = useAppStore((s) => s.screensaver);
  const playbackStatus = useAppStore((s) => s.playbackStatus);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'Escape') {
        if (useAppStore.getState().placeModalOpen) {
          useAppStore.getState().setPlaceModalOpen(false);
        } else if (useAppStore.getState().visualMode === 'immersive') {
          setVisualMode('globe');
        } else {
          useAppStore.getState().setSelectedCountryCode(null);
          useAppStore.getState().setSpotStations(null);
          useAppStore.getState().setSearchDrawerStations(null);
          useAppStore.getState().setSettingsOpen(false);
          useAppStore.getState().setLibraryOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlayPause, setVisualMode]);

  // Optional auto-immersive screensaver after 60s of inactivity while playing
  useEffect(() => {
    if (!screensaver || playbackStatus !== 'playing' || visualMode === 'immersive') return;
    let timer = window.setTimeout(() => {
      setVisualMode('immersive');
    }, 60000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setVisualMode('immersive');
      }, 60000);
    };
    window.addEventListener('pointermove', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [screensaver, playbackStatus, visualMode, setVisualMode]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {visualMode === 'immersive' ? <ImmersiveVisualizer /> : <GlobeCanvas />}
      <HeaderSearch />
      <Overlays />
      <PlayerDock />
    </main>
  );
};

export default App;

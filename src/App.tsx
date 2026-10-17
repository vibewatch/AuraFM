import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { GlobeCanvas } from './components/GlobeCanvas';
import { HeaderSearch } from './components/HeaderSearch';
import { PlayerDock } from './components/PlayerDock';
import { Overlays } from './components/Overlays';

export const App: React.FC = () => {
  const initialize = useAppStore((s) => s.initialize);
  const togglePlayPause = useAppStore((s) => s.togglePlayPause);

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
        if (useAppStore.getState().inspectorOpen) {
          useAppStore.getState().setInspectorOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlayPause]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <GlobeCanvas />
      <HeaderSearch />
      <Overlays />
      <PlayerDock />
    </main>
  );
};

export default App;

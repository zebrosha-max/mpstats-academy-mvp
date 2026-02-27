'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { VideoPlaceholder } from './VideoPlaceholder';

export interface PlayerHandle {
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number | null;
}

interface KinescopePlayerProps {
  videoId: string | null;
  className?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  initialTime?: number;
}

// Kinescope Iframe API types (from official React component source)
interface KinescopePlayerInstance {
  seekTo(time: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  destroy(): Promise<void>;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  on(event: string, callback: (data: Record<string, unknown>) => void): void;
  off(event: string, callback: (data: Record<string, unknown>) => void): void;
  Events: Record<string, string>;
}

interface KinescopeIframePlayerFactory {
  create(
    elementId: string,
    options: {
      url: string;
      size?: { width?: number | string; height?: number | string };
      behavior?: { autoPlay?: boolean | string };
    }
  ): Promise<KinescopePlayerInstance>;
}

interface KinescopeGlobal {
  readonly IframePlayer?: KinescopeIframePlayerFactory;
}

declare global {
  interface Window {
    Kinescope?: KinescopeGlobal;
    KinescopeIframeApiReadyHandlers?: Array<VoidFunction>;
  }
}

function loadKinescopeApi(): Promise<KinescopeIframePlayerFactory> {
  if (window.Kinescope?.IframePlayer) {
    return Promise.resolve(window.Kinescope.IframePlayer);
  }

  const existing = document.querySelector('script[src*="player.kinescope.io"]');

  const waitForReady = (): Promise<KinescopeIframePlayerFactory> =>
    new Promise((resolve) => {
      const handlers = window.KinescopeIframeApiReadyHandlers ?? [];
      window.KinescopeIframeApiReadyHandlers = handlers;
      handlers.push(() => {
        if (window.Kinescope?.IframePlayer) {
          resolve(window.Kinescope.IframePlayer);
        }
      });
    });

  if (existing) return waitForReady();

  const script = document.createElement('script');
  script.src = 'https://player.kinescope.io/latest/iframe.player.js';
  script.async = true;
  document.head.appendChild(script);

  return waitForReady();
}

/** Click-to-play placeholder shown before video activation */
function PlayPlaceholder({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="aspect-video bg-gradient-to-br from-mp-gray-800 to-mp-gray-900 rounded-xl flex items-center justify-center cursor-pointer group relative overflow-hidden"
      onClick={onClick}
      role="button"
      aria-label="Play video"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      {/* Camera icon background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10">
        <svg className="w-32 h-32 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      {/* Play button */}
      <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:bg-white/30 z-10">
        <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      {/* Label */}
      <span className="absolute bottom-4 text-sm text-mp-gray-400 z-10">
        Нажмите для воспроизведения
      </span>
    </div>
  );
}

let playerCounter = 0;

export const VideoPlayer = forwardRef<PlayerHandle, KinescopePlayerProps>(
  function VideoPlayer({ videoId, className, onTimeUpdate, initialTime }, ref) {
    const playerRef = useRef<KinescopePlayerInstance | null>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const currentTimeRef = useRef<number | null>(null);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const [activated, setActivated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resumeNotice, setResumeNotice] = useState<string | null>(null);
    const stableId = useRef(`__kinescope_player_${++playerCounter}`);

    // Keep callback ref up-to-date without causing re-renders
    onTimeUpdateRef.current = onTimeUpdate;

    const activate = useCallback(() => {
      setActivated(true);
    }, []);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current) {
          playerRef.current.seekTo(seconds).then(() => playerRef.current?.play());
        } else {
          // Store pending seek and activate the player so iframe loads
          pendingSeekRef.current = seconds;
          setActivated(true);
        }
      },
      getCurrentTime: () => currentTimeRef.current,
    }), []);

    useEffect(() => {
      if (!videoId || !activated) return;

      let destroyed = false;
      let player: KinescopePlayerInstance | null = null;

      loadKinescopeApi()
        .then((factory) => {
          if (destroyed) return;
          const el = document.getElementById(stableId.current);
          if (!el) return;
          return factory.create(stableId.current, {
            url: `https://kinescope.io/embed/${videoId}`,
            size: { width: '100%', height: '100%' },
            behavior: { autoPlay: true },
          });
        })
        .then((pl) => {
          if (!pl || destroyed) {
            pl?.destroy();
            return;
          }
          player = pl;
          playerRef.current = pl;

          // Handle pending seek from imperative handle
          if (pendingSeekRef.current !== null) {
            const seconds = pendingSeekRef.current;
            pendingSeekRef.current = null;
            pl.seekTo(seconds).then(() => pl.play());
          }
          // Resume from initialTime if provided
          else if (initialTime && initialTime > 0) {
            pl.seekTo(initialTime).then(() => {
              pl.play();
              const mins = Math.floor(initialTime / 60);
              const secs = Math.floor(initialTime % 60);
              setResumeNotice(`Продолжаем с ${mins}:${secs.toString().padStart(2, '0')}`);
              setTimeout(() => setResumeNotice(null), 3000);
            });
          }

          // Event-based time tracking (Kinescope events via player.on)
          // getCurrentTime()/getDuration() polling returns 0 — use events instead
          let knownDuration = 0;

          const handleDurationChange = (data: Record<string, unknown>) => {
            const dur = data.duration as number;
            if (typeof dur === 'number' && dur > 0) {
              knownDuration = dur;
            }
          };

          const handleTimeUpdate = (data: Record<string, unknown>) => {
            const time = data.currentTime as number;
            if (typeof time === 'number' && knownDuration > 0) {
              currentTimeRef.current = time;
              onTimeUpdateRef.current?.(time, knownDuration);
            }
          };

          pl.on(pl.Events.DurationChange, handleDurationChange);
          pl.on(pl.Events.TimeUpdate, handleTimeUpdate);
        })
        .catch((err) => {
          if (!destroyed) {
            console.error('Kinescope player init error:', err);
            setError('Failed to load video player');
          }
        });

      return () => {
        destroyed = true;
        if (player) {
          player.destroy().catch(() => {});
          playerRef.current = null;
        }
      };
    }, [videoId, activated, initialTime]);

    if (!videoId) {
      return <VideoPlaceholder />;
    }

    if (error) {
      return (
        <div className={`aspect-video flex items-center justify-center bg-mp-gray-100 rounded-xl ${className ?? ''}`}>
          <p className="text-body-sm text-mp-gray-500">{error}</p>
        </div>
      );
    }

    if (!activated) {
      return <PlayPlaceholder onClick={activate} />;
    }

    return (
      <div className={`aspect-video relative ${className ?? ''}`}>
        <div
          id={stableId.current}
          style={{ width: '100%', height: '100%' }}
        />
        {resumeNotice && (
          <div className="absolute top-4 left-4 bg-black/70 text-white text-sm px-3 py-1.5 rounded-lg pointer-events-none animate-fade-in z-10">
            {resumeNotice}
          </div>
        )}
      </div>
    );
  }
);

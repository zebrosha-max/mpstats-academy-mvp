'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
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
  /** Fires when player emits Ended event — caller can mark lesson 100% completed */
  onEnded?: () => void;
  initialTime?: number;
  /** Total video duration in seconds — used as fallback when Kinescope events fail */
  durationSeconds?: number;
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
  Events?: Record<string, string>;
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

let playerCounter = 0;

export const VideoPlayer = forwardRef<PlayerHandle, KinescopePlayerProps>(
  function VideoPlayer({ videoId, className, onTimeUpdate, onEnded, initialTime, durationSeconds }, ref) {
    const playerRef = useRef<KinescopePlayerInstance | null>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const currentTimeRef = useRef<number | null>(null);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onEndedRef = useRef(onEnded);
    const [error, setError] = useState<string | null>(null);
    const [resumeNotice, setResumeNotice] = useState<string | null>(null);
    const stableId = useRef(`__kinescope_player_${++playerCounter}`);

    // Keep callback refs up-to-date without causing re-renders
    onTimeUpdateRef.current = onTimeUpdate;
    onEndedRef.current = onEnded;

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current) {
          playerRef.current.seekTo(seconds).then(() => playerRef.current?.play());
        } else {
          // Store pending seek and activate the player so iframe loads
          pendingSeekRef.current = seconds;
        }
      },
      getCurrentTime: () => currentTimeRef.current,
    }), []);

    useEffect(() => {
      if (!videoId) return;

      let destroyed = false;
      let player: KinescopePlayerInstance | null = null;
      let timerCleanup: (() => void) | null = null;
      const state = { eventsWorking: false };

      // --- Timer-based fallback tracking ---
      // Kinescope postMessage events (TimeUpdate/DurationChange) are unreliable
      // and don't fire in current player builds. Instead of locally incrementing
      // by +1s (which double-counted progress at 1.5x/2x — user got 49% after
      // watching whole video at 2x), we poll player.getCurrentTime() which
      // correctly reflects playback rate, seeking, and pauses.
      //
      // Local increment is kept as last-resort fallback if getCurrentTime()
      // ever rejects/throws (e.g. iframe not ready, network glitch).
      const startTimerTracking = (startFrom: number) => {
        let position = startFrom;
        let lastPolledAt = Date.now();
        let isPageVisible = !document.hidden;
        const knownDuration = durationSeconds || 0;

        const handleVisibility = () => {
          isPageVisible = !document.hidden;
          lastPolledAt = Date.now();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        const tick = async () => {
          if (!isPageVisible || destroyed) {
            lastPolledAt = Date.now();
            return;
          }
          // Anti-double-count: if Kinescope events started firing after the
          // 5s grace window, let them be the source of truth and stop polling.
          if (state.eventsWorking) {
            lastPolledAt = Date.now();
            return;
          }

          let nextPosition = position;
          try {
            const t = await playerRef.current?.getCurrentTime();
            if (typeof t === 'number' && Number.isFinite(t) && t >= 0) {
              nextPosition = t;
            } else {
              // Fallback to local increment scaled by elapsed wall-clock time
              const elapsed = (Date.now() - lastPolledAt) / 1000;
              nextPosition = position + elapsed;
            }
          } catch {
            const elapsed = (Date.now() - lastPolledAt) / 1000;
            nextPosition = position + elapsed;
          }
          lastPolledAt = Date.now();

          if (knownDuration > 0) {
            nextPosition = Math.min(nextPosition, knownDuration);
          }
          position = nextPosition;
          currentTimeRef.current = position;
          // Per D-03: only fire onTimeUpdate when we have a real duration from DB
          if (knownDuration > 0) {
            onTimeUpdateRef.current?.(position, knownDuration);
          }
        };

        const interval = setInterval(() => { void tick(); }, 1000);

        timerCleanup = () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', handleVisibility);
        };

        console.log(`[KP] Timer tracking started (getCurrentTime poll): position=${startFrom}s, knownDuration=${knownDuration}s`);
      };

      loadKinescopeApi()
        .then((factory) => {
          if (destroyed) return;
          const el = document.getElementById(stableId.current);
          if (!el) return;
          return factory.create(stableId.current, {
            url: `https://kinescope.io/embed/${videoId}`,
            size: { width: '100%', height: '100%' },
            behavior: { autoPlay: false },
          });
        })
        .then((pl) => {
          if (!pl || destroyed) {
            pl?.destroy();
            return;
          }
          player = pl;
          playerRef.current = pl;

          const startPosition = pendingSeekRef.current ?? (initialTime && initialTime > 0 ? initialTime : 0);

          // Handle pending seek from imperative handle
          if (pendingSeekRef.current !== null) {
            const seconds = pendingSeekRef.current;
            pendingSeekRef.current = null;
            pl.seekTo(seconds).then(() => pl.play());
          }
          // Resume from initialTime if provided
          else if (initialTime && initialTime > 0) {
            pl.seekTo(initialTime).then(() => {
              const mins = Math.floor(initialTime / 60);
              const secs = Math.floor(initialTime % 60);
              setResumeNotice(`Продолжаем с ${mins}:${secs.toString().padStart(2, '0')}`);
              setTimeout(() => setResumeNotice(null), 3000);
            });
          }

          // --- Try Kinescope events first ---
          let knownDuration = 0;

          const handleDurationChange = (data: Record<string, unknown>) => {
            const dur = data?.duration as number;
            if (typeof dur === 'number' && dur > 0) {
              state.eventsWorking = true;
              knownDuration = dur;
              console.log('[KP] Kinescope event: durationChange', dur);
            }
          };

          const handleTimeUpdate = (data: Record<string, unknown>) => {
            const time = data?.currentTime as number;
            if (typeof time === 'number') {
              state.eventsWorking = true;
              if (knownDuration > 0) {
                currentTimeRef.current = time;
                onTimeUpdateRef.current?.(time, knownDuration);
              }
            }
          };

          const handleEnded = () => {
            console.log('[KP] Kinescope event: ended → mark 100%');
            // Force a final 100% sample so saveWatchProgress sees full duration
            const dur = knownDuration > 0 ? knownDuration : (durationSeconds || 0);
            if (dur > 0) {
              currentTimeRef.current = dur;
              onTimeUpdateRef.current?.(dur, dur);
            }
            onEndedRef.current?.();
          };

          // Try multiple event name formats — Events enum may be undefined in latest version
          const eventNames = pl.Events
            ? {
                timeUpdate: pl.Events.TimeUpdate,
                durationChange: pl.Events.DurationChange,
                ended: pl.Events.Ended,
              }
            : null;

          if (eventNames?.durationChange && eventNames?.timeUpdate) {
            pl.on(eventNames.durationChange, handleDurationChange);
            pl.on(eventNames.timeUpdate, handleTimeUpdate);
            if (eventNames.ended) pl.on(eventNames.ended, handleEnded);
            console.log('[KP] Subscribed via player.Events:', eventNames);
          } else {
            // Fallback: try common string event names
            console.warn('[KP] player.Events is missing, trying string names');
            try { pl.on('DurationChange', handleDurationChange); } catch { /* ignore */ }
            try { pl.on('TimeUpdate', handleTimeUpdate); } catch { /* ignore */ }
            try { pl.on('durationchange', handleDurationChange); } catch { /* ignore */ }
            try { pl.on('timeupdate', handleTimeUpdate); } catch { /* ignore */ }
          }
          // Ended event — try multiple casings unconditionally
          try { pl.on('Ended', handleEnded); } catch { /* ignore */ }
          try { pl.on('ended', handleEnded); } catch { /* ignore */ }

          // --- Fallback: start timer if events don't fire within 5s ---
          setTimeout(() => {
            if (!state.eventsWorking && !destroyed) {
              console.warn('[KP] Kinescope events not firing — activating timer fallback');
              startTimerTracking(startPosition);
            }
          }, 5000);
        })
        .catch((err) => {
          if (!destroyed) {
            console.error('Kinescope player init error:', err);
            setError('Failed to load video player');
          }
        });

      return () => {
        destroyed = true;
        timerCleanup?.();
        if (player) {
          player.destroy().catch(() => {});
          playerRef.current = null;
        }
      };
    }, [videoId, initialTime, durationSeconds]);

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

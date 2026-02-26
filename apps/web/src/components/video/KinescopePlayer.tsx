'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useId,
} from 'react';
import { VideoPlaceholder } from './VideoPlaceholder';

export interface PlayerHandle {
  seekTo: (seconds: number) => void;
}

interface KinescopePlayerProps {
  videoId: string | null;
  className?: string;
}

// Kinescope Iframe API types (from official React component source)
interface KinescopePlayerInstance {
  seekTo(time: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  destroy(): Promise<void>;
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
  function VideoPlayer({ videoId, className }, ref) {
    const playerRef = useRef<KinescopePlayerInstance | null>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const stableId = useRef(`__kinescope_player_${++playerCounter}`);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (playerRef.current) {
          playerRef.current.seekTo(seconds).then(() => playerRef.current?.play());
        } else {
          pendingSeekRef.current = seconds;
        }
      },
    }), []);

    useEffect(() => {
      if (!videoId) return;

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
          });
        })
        .then((pl) => {
          if (!pl || destroyed) {
            pl?.destroy();
            return;
          }
          player = pl;
          playerRef.current = pl;

          if (pendingSeekRef.current !== null) {
            const seconds = pendingSeekRef.current;
            pendingSeekRef.current = null;
            pl.seekTo(seconds).then(() => pl.play());
          }
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
    }, [videoId]);

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
      <div
        id={stableId.current}
        className={`aspect-video ${className ?? ''}`}
      />
    );
  }
);

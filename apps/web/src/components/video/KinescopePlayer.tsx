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
}

interface KinescopePlayerProps {
  videoId: string | null;
  className?: string;
}

/**
 * Loads the Kinescope Iframe Player API script.
 * Returns the IframePlayer factory from window.Kinescope.IframePlayer.
 */
function loadKinescopeApi(): Promise<KinescopeIframePlayerFactory> {
  // Already loaded
  if (window.Kinescope?.IframePlayer) {
    return Promise.resolve(window.Kinescope.IframePlayer);
  }

  // Already loading (script tag exists)
  const existing = document.querySelector(
    'script[src*="player.kinescope.io"]'
  );

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

  // Load script
  const script = document.createElement('script');
  script.src = 'https://player.kinescope.io/latest/iframe.player.js';
  script.async = true;
  document.head.appendChild(script);

  return waitForReady();
}

// Kinescope Iframe API types
interface KinescopeCreateOptions {
  url: string;
  size?: { width?: number | string; height?: number | string };
  behavior?: { autoPlay?: boolean | 'viewable'; preload?: boolean | string };
}

interface KinescopePlayerInstance {
  readonly Events: Record<string, string>;
  on(event: string, handler: (e: unknown) => void): KinescopePlayerInstance;
  once(event: string, handler: (e: unknown) => void): KinescopePlayerInstance;
  off(event: string, handler: (e: unknown) => void): KinescopePlayerInstance;
  seekTo(time: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  getCurrentTime(): Promise<number>;
  destroy(): Promise<void>;
}

interface KinescopeIframePlayerFactory {
  create(
    element: HTMLElement | string,
    options: KinescopeCreateOptions
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

export const VideoPlayer = forwardRef<PlayerHandle, KinescopePlayerProps>(
  function VideoPlayer({ videoId, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<KinescopePlayerInstance | null>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const [error, setError] = useState<string | null>(null);

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
      if (!videoId || !containerRef.current) return;

      let destroyed = false;
      let player: KinescopePlayerInstance | null = null;

      loadKinescopeApi()
        .then((factory) => {
          if (destroyed || !containerRef.current) return;
          return factory.create(containerRef.current, {
            url: `https://kinescope.io/${videoId}`,
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

          // Flush pending seek
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
        ref={containerRef}
        className={`aspect-video ${className ?? ''}`}
      />
    );
  }
);

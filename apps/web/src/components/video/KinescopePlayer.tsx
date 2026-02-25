'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useState,
  type ComponentRef,
} from 'react';
import dynamic from 'next/dynamic';
import type KinescopePlayerType from '@kinescope/react-kinescope-player';
import { VideoPlaceholder } from './VideoPlaceholder';

// Dynamic import to avoid SSR crash (Kinescope player accesses window on import)
const KinescopePlayerRaw = dynamic(
  () => import('@kinescope/react-kinescope-player'),
  { ssr: false }
) as unknown as typeof KinescopePlayerType;

export interface PlayerHandle {
  seekTo: (seconds: number) => void;
}

interface KinescopePlayerProps {
  videoId: string | null;
  className?: string;
}

export const VideoPlayer = forwardRef<PlayerHandle, KinescopePlayerProps>(
  function VideoPlayer({ videoId, className }, ref) {
    const playerRef = useRef<ComponentRef<typeof KinescopePlayerType>>(null);
    const [isReady, setIsReady] = useState(false);
    const pendingSeekRef = useRef<number | null>(null);

    const handleReady = useCallback(() => {
      setIsReady(true);
      // Execute queued seek if any
      if (pendingSeekRef.current !== null) {
        const seconds = pendingSeekRef.current;
        pendingSeekRef.current = null;
        playerRef.current?.seekTo(seconds);
        playerRef.current?.play();
      }
    }, []);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (isReady && playerRef.current) {
          playerRef.current.seekTo(seconds);
          playerRef.current.play();
        } else {
          // Queue seek for when player is ready
          pendingSeekRef.current = seconds;
        }
      },
    }), [isReady]);

    if (!videoId) {
      return <VideoPlaceholder />;
    }

    return (
      <div className={`aspect-video ${className ?? ''}`}>
        <KinescopePlayerRaw
          ref={playerRef}
          videoId={videoId}
          autoPlay={false}
          width="100%"
          height="100%"
          onReady={handleReady}
        />
      </div>
    );
  }
);

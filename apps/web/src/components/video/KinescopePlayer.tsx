'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { VideoPlaceholder } from './VideoPlaceholder';

export interface PlayerHandle {
  seekTo: (seconds: number) => void;
}

interface KinescopePlayerProps {
  videoId: string | null;
  className?: string;
}

export const VideoPlayer = forwardRef<PlayerHandle, KinescopePlayerProps>(
  function VideoPlayer({ videoId, className }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const pendingSeekRef = useRef<number | null>(null);
    const isReadyRef = useRef(false);

    const postMessage = useCallback((method: string, data?: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ method, params: data !== undefined ? [data] : [] }),
        'https://kinescope.io'
      );
    }, []);

    useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
        if (!event.origin.includes('kinescope.io')) return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data?.type === 'ready' || data?.event === 'ready') {
            isReadyRef.current = true;
            if (pendingSeekRef.current !== null) {
              const seconds = pendingSeekRef.current;
              pendingSeekRef.current = null;
              postMessage('seekTo', seconds);
              postMessage('play');
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [postMessage]);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (isReadyRef.current && iframeRef.current) {
          postMessage('seekTo', seconds);
          postMessage('play');
        } else {
          pendingSeekRef.current = seconds;
        }
      },
    }), [postMessage]);

    if (!videoId) {
      return <VideoPlaceholder />;
    }

    return (
      <div className={`aspect-video ${className ?? ''}`}>
        <iframe
          ref={iframeRef}
          src={`https://kinescope.io/embed/${videoId}`}
          width="100%"
          height="100%"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer; clipboard-write; web-share"
          frameBorder="0"
          allowFullScreen
          style={{ border: 0 }}
        />
      </div>
    );
  }
);

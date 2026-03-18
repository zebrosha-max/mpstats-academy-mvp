'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    carrotquest?: {
      auth: (userId: string, hash: string) => void;
      identify: (props: Record<string, string>) => void;
    };
  }
}

interface CarrotQuestIdentifyProps {
  userId: string;
  hash: string;
  email?: string;
  name?: string;
}

/**
 * Identifies the current user in Carrot Quest widget.
 * Calls carrotquest.auth(userId, hash) for secure identification,
 * then sets user properties (email, name).
 *
 * Hash is HMAC-SHA256(userId, CARROTQUEST_USER_AUTH_KEY) generated server-side.
 */
export function CarrotQuestIdentify({ userId, hash, email, name }: CarrotQuestIdentifyProps) {
  const identifiedRef = useRef(false);

  useEffect(() => {
    if (identifiedRef.current) return;

    const identify = () => {
      if (!window.carrotquest) return false;

      window.carrotquest.auth(userId, hash);

      const props: Record<string, string> = {};
      if (email) props['$email'] = email;
      if (name) props['$name'] = name;
      if (Object.keys(props).length > 0) {
        window.carrotquest.identify(props);
      }

      identifiedRef.current = true;
      return true;
    };

    // CQ script may not be loaded yet — retry a few times
    if (identify()) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (identify() || attempts >= 10) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [userId, hash, email, name]);

  return null;
}

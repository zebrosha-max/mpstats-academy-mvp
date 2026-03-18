import type { CQEventName, CQEventData } from './types';

const CQ_API_BASE = 'https://api.carrotquest.io/v1';

/**
 * Carrot Quest API client for server-side event tracking.
 *
 * Uses by_user_id=true so we can pass our Supabase UUIDs directly
 * instead of CQ's internal numeric IDs.
 *
 * Fire-and-forget pattern: errors are logged but never thrown.
 * If API key is missing, all methods are no-ops (safe for dev/staging).
 */
export class CarrotQuestClient {
  private apiKey: string;
  private warned = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private isConfigured(): boolean {
    if (!this.apiKey) {
      if (!this.warned) {
        console.warn(
          '[CarrotQuest] CARROTQUEST_API_KEY not set — all events will be skipped',
        );
        this.warned = true;
      }
      return false;
    }
    return true;
  }

  private async request(
    path: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    try {
      const url = `${CQ_API_BASE}${path}${path.includes('?') ? '&' : '?'}by_user_id=true`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error(
          `[CarrotQuest] API error ${response.status} on ${path}: ${text}`,
        );
      }
    } catch (error) {
      console.error(`[CarrotQuest] Network error on ${path}:`, error);
    }
  }

  /**
   * Track a named event for a user. Used to trigger CQ automation rules.
   */
  async trackEvent(
    userId: string,
    event: CQEventName,
    params?: CQEventData,
  ): Promise<void> {
    if (!this.isConfigured()) return;

    await this.request(`/users/${userId}/events`, {
      event,
      params: params ?? {},
    });
  }

  /**
   * Set user properties (e.g. name, email, plan).
   */
  async setUserProps(
    userId: string,
    props: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isConfigured()) return;

    await this.request(`/users/${userId}/props`, props);
  }
}

/** Singleton CQ client instance */
export const cq = new CarrotQuestClient(
  process.env.CARROTQUEST_API_KEY || '',
);

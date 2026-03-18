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

  /**
   * Send form-encoded POST request to CQ API.
   * CQ API expects application/x-www-form-urlencoded, NOT JSON.
   */
  private async request(
    path: string,
    formFields: Record<string, string>,
  ): Promise<void> {
    try {
      const url = `${CQ_API_BASE}${path}`;
      const body = new URLSearchParams(formFields);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Token ${this.apiKey}`,
        },
        body: body.toString(),
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
   * Uses by_user_id=true so we can pass Supabase UUIDs.
   */
  async trackEvent(
    userId: string,
    event: CQEventName,
    params?: CQEventData,
  ): Promise<void> {
    if (!this.isConfigured()) return;

    const fields: Record<string, string> = {
      event,
      by_user_id: 'true',
    };
    if (params && Object.keys(params).length > 0) {
      fields.params = JSON.stringify(params);
    }

    await this.request(`/users/${userId}/events`, fields);
  }

  /**
   * Set user properties (e.g. $name, $email).
   * CQ expects operations=[{op, key, value}] format.
   * Uses by_user_id=true so we can pass Supabase UUIDs.
   */
  async setUserProps(
    userId: string,
    props: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isConfigured()) return;

    const operations = Object.entries(props).map(([key, value]) => ({
      op: 'update_or_create',
      key,
      value: String(value),
    }));

    await this.request(`/users/${userId}/props`, {
      operations: JSON.stringify(operations),
      by_user_id: 'true',
    });
  }
}

/** Singleton CQ client instance */
export const cq = new CarrotQuestClient(
  process.env.CARROTQUEST_API_KEY || '',
);

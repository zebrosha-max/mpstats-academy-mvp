/**
 * OAuth Provider abstraction for custom OAuth flows.
 * Supabase lacks native support for some providers (e.g. Yandex ID),
 * so we handle the OAuth flow server-side and create Supabase sessions via Admin API.
 *
 * To add a new provider: implement OAuthProvider interface, add callback route.
 */

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string | null;
}

export interface OAuthProvider {
  name: string;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string }>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

export class YandexProvider implements OAuthProvider {
  name = 'yandex';

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.YANDEX_CLIENT_ID!,
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/yandex/callback`,
      scope: 'login:email login:info',
      state,
      prompt: 'login', // R10: force account selection screen
    });
    return `https://oauth.yandex.ru/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string }> {
    const res = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.YANDEX_CLIENT_ID!,
        client_secret: process.env.YANDEX_CLIENT_SECRET!,
      }).toString(),
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(`Yandex token error: ${data.error_description || data.error}`);
    }

    return { accessToken: data.access_token };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const res = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    const data = await res.json();

    return {
      id: data.id,
      email: data.default_email,
      name: data.display_name || [data.first_name, data.last_name].filter(Boolean).join(' ') || null,
    };
  }
}

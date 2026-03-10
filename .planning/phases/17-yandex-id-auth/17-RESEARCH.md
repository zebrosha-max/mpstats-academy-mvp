# Phase 17: Yandex ID Auth - Research

**Researched:** 2026-03-10
**Domain:** OAuth 2.0 (Yandex ID) + Supabase Admin API session management
**Confidence:** HIGH

## Summary

Phase 17 replaces Google OAuth with Yandex ID as the primary OAuth provider. Since Supabase has no native Yandex provider, the implementation requires a server-side OAuth proxy: the app handles the Yandex OAuth flow directly (redirect to Yandex, receive code, exchange for token, fetch user profile), then creates/finds the Supabase user via Admin API and generates a session using the `generateLink` + `verifyOtp` pattern.

The existing codebase has a clean auth architecture (server actions in `actions.ts`, callback route handler, Supabase server client with cookie management) that maps well to this approach. The `UserProfile.yandexId` field already exists from Phase 16. The main complexity is the Supabase session creation via Admin API -- this requires `SUPABASE_SERVICE_ROLE_KEY` and a specific `generateLink(magiclink)` + `verifyOtp` pattern to obtain valid `access_token`/`refresh_token` that can be set as cookies.

**Primary recommendation:** Implement a Next.js Route Handler at `/api/auth/yandex/callback` that orchestrates the full flow (code exchange, user lookup/creation, Supabase session injection via cookies), keeping the existing middleware and tRPC auth context unchanged.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Server-side OAuth proxy (Supabase has no native Yandex provider)
- Flow: button -> redirect oauth.yandex.ru/authorize -> callback /api/auth/yandex/callback -> server exchanges code -> gets Yandex profile -> Supabase Admin API (createUser or find existing by email) -> generate session -> redirect /dashboard
- Session creation via Supabase Admin API (SUPABASE_SERVICE_ROLE_KEY)
- Scopes: login:email, login:info (minimum)
- Credentials in .env / .env.production
- Migration NOT needed -- 1-5 test users will re-register
- Google OAuth removed from Supabase providers and UI completely
- Admin account for Egor Vasilev must be created (email/password or Yandex OAuth, isAdmin=true)
- Replace Google button with "Войти с Яндекс ID" on login + register pages
- Yandex brand style: red Я logo left, text right
- Layout: email/password form top -> divider "или" -> Yandex button bottom

### Claude's Discretion
- OAuth provider abstraction level (minimal interface vs registry vs plugin)
- DB schema for OAuth bindings (separate fields vs OAuthLink table)
- Delete old test users from Supabase or not
- Landing page -- check and remove Google mentions if any
- Error handling for Yandex OAuth failures (what to show user)
- CSRF protection for OAuth state parameter

### Deferred Ideas (OUT OF SCOPE)
- Точка ID OAuth provider (AUTH-05) -- v1.3+, 1-2 months
- Avatar from Yandex profile (login:avatar scope)
- Multi-provider linking (one user binds multiple providers)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in via Yandex ID (server OAuth flow + Supabase Admin API) | Yandex OAuth endpoints verified, Supabase generateLink+verifyOtp pattern documented |
| AUTH-02 | Existing Google account migrated to email/password (link by verified email) | CONTEXT overrides: migration NOT needed, users re-register. Admin account for Egor via email/password |
| AUTH-03 | Google OAuth removed from Supabase and UI (buttons, provider) | Login/register pages identified, signInWithGoogle action to remove |
| AUTH-04 | OAuth architecture extensible for future providers (Точка ID etc.) | OAuthProvider interface pattern recommended |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | existing | Admin API for user creation + session | Already in project, admin client needed |
| Next.js Route Handlers | 14.x | OAuth callback endpoint | Standard Next.js pattern for API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node built-in) | - | Generate OAuth state parameter (CSRF) | On authorize redirect |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom OAuth flow | next-auth / auth.js | Overkill -- Supabase already handles sessions, adding next-auth creates dual auth systems |
| generateLink+verifyOtp | Manual JWT generation | generateLink is official Supabase pattern, manual JWT bypasses Supabase session lifecycle |
| Separate fields (yandexId) | OAuthLink table | OAuthLink table is more extensible but over-engineered for 1-2 providers. Keep yandexId field, add tochkaId later |

**No new packages needed.** Everything uses existing dependencies + Node.js crypto.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── lib/
│   ├── auth/
│   │   ├── actions.ts              # MODIFY: remove signInWithGoogle, add signInWithYandex
│   │   ├── oauth-providers.ts      # NEW: OAuthProvider interface + YandexProvider
│   │   └── supabase-admin.ts       # NEW: Supabase admin client (SERVICE_ROLE_KEY)
│   └── supabase/
│       └── server.ts               # UNCHANGED
├── app/
│   ├── api/auth/yandex/
│   │   └── callback/route.ts       # NEW: Yandex OAuth callback handler
│   ├── auth/
│   │   └── callback/route.ts       # KEEP: for email verification flows
│   └── (auth)/
│       ├── login/page.tsx          # MODIFY: replace Google with Yandex button
│       └── register/page.tsx       # MODIFY: replace Google with Yandex button
```

### Pattern 1: Server-side OAuth Proxy (Yandex ID)

**What:** Next.js handles the full OAuth flow server-side, Supabase only manages sessions.
**When to use:** When Supabase lacks a native provider for the desired OAuth service.

**Flow:**
```
1. User clicks "Войти с Яндекс ID"
2. Server action generates state (CSRF token), stores in cookie
3. Redirect to: https://oauth.yandex.ru/authorize?response_type=code&client_id=X&redirect_uri=Y&scope=login:email+login:info&state=Z
4. User authorizes on Yandex
5. Yandex redirects to /api/auth/yandex/callback?code=ABC&state=Z
6. Callback route:
   a. Verify state matches cookie (CSRF protection)
   b. POST https://oauth.yandex.ru/token (exchange code for access_token)
   c. GET https://login.yandex.ru/info (fetch user profile with access_token)
   d. Find Supabase user by email OR create new user via admin.createUser()
   e. Update UserProfile.yandexId in Prisma
   f. Generate Supabase session via admin.generateLink(magiclink) + verifyOtp
   g. Set session cookies (access_token, refresh_token)
   h. Redirect to /dashboard
```

### Pattern 2: Supabase Admin Session Creation

**What:** Create a valid Supabase session for any user using service role key.
**Critical pattern -- verified from Supabase community.**

```typescript
// 1. Create admin client
import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// 2. Find or create user
const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
let user = users.find(u => u.email === yandexEmail);
if (!user) {
  const { data } = await supabaseAdmin.auth.admin.createUser({
    email: yandexEmail,
    email_confirm: true, // Skip email verification
    user_metadata: { full_name: yandexName, yandex_id: yandexId },
  });
  user = data.user;
}

// 3. Generate session via magiclink trick
const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email: user.email!,
});

// 4. Verify OTP to get session tokens
const { data: otpData } = await supabaseAdmin.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'magiclink',
});

// 5. otpData.session contains { access_token, refresh_token }
// Set these as Supabase cookies for the response
```

### Pattern 3: OAuthProvider Abstraction (AUTH-04)

**What:** Minimal interface for extensibility without over-engineering.
**Recommendation:** Simple interface, NOT a registry/plugin system. Two providers (Yandex now, Точка later) don't justify a plugin architecture.

```typescript
// lib/auth/oauth-providers.ts
export interface OAuthProvider {
  name: string;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string }>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string | null;
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
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`Yandex token error: ${data.error_description}`);
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
      name: data.display_name || `${data.first_name} ${data.last_name}`.trim() || null,
    };
  }
}
```

Adding Точка ID later: create `TochkaProvider implements OAuthProvider`, add callback route, add button. Core session logic stays unchanged.

### Anti-Patterns to Avoid
- **Using next-auth alongside Supabase:** Creates dual session systems, breaks existing middleware and RLS
- **Storing Yandex tokens long-term:** Not needed -- we only need them during the callback to fetch profile, then discard
- **Using admin.listUsers() to find by email:** Use `getUserByEmail()` directly (admin method exists but undocumented in some versions -- fallback to listUsers with filter)
- **Skipping CSRF state parameter:** Opens redirect attacks. Always generate random state, store in httpOnly cookie, verify on callback

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session management | Custom JWT signing | Supabase generateLink+verifyOtp | Maintains Supabase session lifecycle, RLS, middleware compatibility |
| CSRF protection | Custom token store | crypto.randomUUID() + httpOnly cookie | Simple, stateless, secure |
| User lookup by email | Raw SQL query | supabaseAdmin.auth.admin.getUserByEmail() | Admin API handles auth schema properly |
| Cookie management | Manual Set-Cookie headers | @supabase/ssr createServerClient pattern | Consistent with existing middleware cookie handling |

## Common Pitfalls

### Pitfall 1: Supabase Session Cookie Format
**What goes wrong:** Setting access_token/refresh_token as raw cookies that middleware doesn't recognize.
**Why it happens:** Supabase SSR uses a specific cookie format (`sb-<ref>-auth-token`) with chunking for large tokens.
**How to avoid:** After getting session from verifyOtp, use the Supabase server client with `setSession()` to properly set cookies through the standard cookie handler. OR manually construct the cookie in the same format middleware expects.
**Warning signs:** User appears logged in on callback redirect but loses session on next navigation.

### Pitfall 2: Docker/Production redirect_uri Mismatch
**What goes wrong:** Yandex callback fails because redirect_uri in authorize doesn't match callback URL.
**Why it happens:** In Docker, `request.url` returns internal address (0.0.0.0:3000) not public URL.
**How to avoid:** Always use `process.env.NEXT_PUBLIC_SITE_URL` for redirect_uri construction. The project already handles this in `/auth/callback/route.ts`.
**Warning signs:** Yandex returns "redirect_uri mismatch" error.

### Pitfall 3: Race Condition on First Login
**What goes wrong:** createUser succeeds but UserProfile creation fails (trigger timing), OR user found by email but yandexId not yet set.
**Why it happens:** Supabase has a trigger `handle_new_user` that creates UserProfile. Prisma update of yandexId may race with trigger.
**How to avoid:** After createUser, wait for/verify UserProfile exists via Prisma `upsert`, then set yandexId. Use transaction if needed.
**Warning signs:** Intermittent "record not found" errors on first Yandex login.

### Pitfall 4: Yandex Token Exchange Content-Type
**What goes wrong:** Token exchange returns error.
**Why it happens:** Yandex requires `application/x-www-form-urlencoded`, not JSON body.
**How to avoid:** Use URLSearchParams for the POST body, set correct Content-Type header.

### Pitfall 5: Admin Client Leaking to Client Bundle
**What goes wrong:** SUPABASE_SERVICE_ROLE_KEY exposed in browser.
**Why it happens:** Importing admin client in a file that gets bundled for client.
**How to avoid:** Admin client ONLY in Route Handlers and server-only files. Never in 'use client' components or server actions that import from shared modules. Keep in separate `supabase-admin.ts` file.

## Code Examples

### Yandex OAuth Endpoints (verified)

```
Authorize: https://oauth.yandex.ru/authorize
Token:     https://oauth.yandex.ru/token (POST, x-www-form-urlencoded)
User Info: https://login.yandex.ru/info (GET, Authorization: OAuth <token>)
```

**Authorize parameters:**
- `response_type=code`
- `client_id` -- from Yandex OAuth app registration
- `redirect_uri` -- must match registered callback URL exactly
- `scope` -- space-separated: `login:email login:info`
- `state` -- CSRF token

**Token exchange body:**
- `grant_type=authorization_code`
- `code` -- from callback query param
- `client_id`
- `client_secret`

**User info response (key fields):**
```json
{
  "id": "123456789",
  "login": "username",
  "default_email": "user@yandex.ru",
  "first_name": "Ivan",
  "last_name": "Petrov",
  "display_name": "Ivan Petrov"
}
```

### Yandex App Registration Info (for planner)

Register at: https://oauth.yandex.ru/client/new

**Required settings:**
- Platform: Web services
- Callback URL: `https://academyal.duckdns.org/api/auth/yandex/callback` (production) + `http://localhost:3000/api/auth/yandex/callback` (dev)
- Scopes: login:email, login:info
- Outputs: CLIENT_ID, CLIENT_SECRET

### Setting Supabase Session Cookies in Route Handler

```typescript
// In /api/auth/yandex/callback/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// After obtaining session via generateLink+verifyOtp:
const { access_token, refresh_token } = otpData.session;

// Create response with redirect
const response = NextResponse.redirect(new URL('/dashboard', siteUrl));

// Create a Supabase client that writes to this response's cookies
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() { return []; },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  }
);
await supabase.auth.setSession({ access_token, refresh_token });

return response;
```

### signInWithYandex Server Action

```typescript
// Replace signInWithGoogle in actions.ts
export async function signInWithYandex(): Promise<AuthResult> {
  const state = crypto.randomUUID();

  // Store state in cookie for CSRF verification
  const cookieStore = await cookies();
  cookieStore.set('yandex_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const provider = new YandexProvider();
  redirect(provider.authorizeUrl(state));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase native OAuth (Google) | Server-side OAuth proxy | Phase 17 | Full control over provider selection |
| signInWithOAuth() | Custom code exchange + Admin API session | Phase 17 | More code but provider-agnostic |

## Open Questions

1. **getUserByEmail() availability in current @supabase/supabase-js version**
   - What we know: Admin API has `listUsers()` confirmed. Some versions expose `getUserByEmail()` directly.
   - What's unclear: Whether the project's current supabase-js version has this method.
   - Recommendation: Try `admin.getUserByEmail()` first, fallback to `listUsers()` with email filter.

2. **Supabase cookie format for setSession in Route Handler**
   - What we know: The generateLink+verifyOtp pattern produces valid tokens. setSession() should handle cookie writing.
   - What's unclear: Whether `setSession` in a Route Handler context (not middleware) properly sets chunked cookies.
   - Recommendation: Test in dev first. If cookies don't persist, fall back to manually setting `sb-<project-ref>-auth-token` cookies.

3. **handle_new_user trigger timing with yandexId**
   - What we know: Supabase trigger creates UserProfile row on auth.users INSERT. Phase 16 added yandexId column.
   - What's unclear: Whether we can pass yandexId through user_metadata and have the trigger set it, or must update separately.
   - Recommendation: Update yandexId via Prisma after user creation, using upsert to handle race conditions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (unit/integration) |
| Config file | apps/web/vitest.config.ts |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Yandex OAuth flow (authorize redirect, callback handling, session creation) | integration | `pnpm test -- --run tests/auth/yandex-oauth.test.ts` | No - Wave 0 |
| AUTH-02 | Admin account creation for Egor (isAdmin=true) | manual | Manual verification in Supabase dashboard | N/A |
| AUTH-03 | Google OAuth removed (no Google button, no provider) | unit | `pnpm test -- --run tests/auth/no-google.test.ts` | No - Wave 0 |
| AUTH-04 | OAuthProvider interface extensibility | unit | `pnpm test -- --run tests/auth/oauth-provider.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test && pnpm build`
- **Phase gate:** Full suite green + manual Yandex login test before verify

### Wave 0 Gaps
- [ ] `apps/web/tests/auth/yandex-oauth.test.ts` -- covers AUTH-01 (mock Yandex API, test callback handler)
- [ ] `apps/web/tests/auth/oauth-provider.test.ts` -- covers AUTH-04 (YandexProvider interface compliance)
- [ ] `apps/web/tests/auth/no-google.test.ts` -- covers AUTH-03 (verify no Google imports/references)

## Sources

### Primary (HIGH confidence)
- [Yandex ID OAuth docs](https://yandex.com/dev/id/doc/en/) -- endpoints, scopes, flow
- [Yandex user info API](https://yandex.com/dev/id/doc/en/user-information) -- response format, fields
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/admin-api) -- createUser, generateLink
- [Supabase session generation discussion](https://github.com/orgs/supabase/discussions/11854) -- generateLink+verifyOtp pattern
- Existing codebase: `actions.ts`, `server.ts`, `login/page.tsx`, `schema.prisma` -- current auth implementation

### Secondary (MEDIUM confidence)
- [Supabase Admin session pattern](https://medium.com/@razikus/supabase-admin-login-as-user-get-his-session-d35eedb50e75) -- code examples for impersonation pattern

### Tertiary (LOW confidence)
- Cookie chunking behavior of `setSession()` in Route Handler context -- needs dev testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all verified APIs
- Architecture: HIGH -- OAuth proxy pattern is well-established, Supabase admin session pattern confirmed by community
- Pitfalls: HIGH -- based on project history (Docker redirect issue already solved) and known Supabase SSR patterns
- Yandex API specifics: HIGH -- official docs confirm endpoints and response format

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable APIs, no fast-moving dependencies)

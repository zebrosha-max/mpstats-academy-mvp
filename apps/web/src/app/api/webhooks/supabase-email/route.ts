import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { cq } from '@/lib/carrotquest/client';

export const dynamic = 'force-dynamic';

/**
 * Supabase Send Email Hook handler (Standard Webhooks verification).
 *
 * Supabase HTTPS hooks use Standard Webhooks spec:
 * - webhook-id, webhook-timestamp, webhook-signature headers
 * - Secret format: "v1,whsec_BASE64KEY"
 * - Signature: HMAC-SHA256 of "${id}.${timestamp}.${body}"
 *
 * We forward auth email actions to Carrot Quest for branded delivery.
 *
 * IMPORTANT: Always return 200 — returning an error breaks the auth flow.
 */

function verifyWebhookSignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const msgId = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');

  if (!msgId || !timestamp || !signatures) return false;

  // Extract base64 key from "v1,whsec_BASE64KEY" format
  const parts = secret.split(',');
  const keyPart = parts[parts.length - 1]; // "whsec_BASE64KEY"
  const base64Key = keyPart.replace('whsec_', '');
  const key = Buffer.from(base64Key, 'base64');

  // Compute expected signature
  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const computed = createHmac('sha256', key)
    .update(signedContent)
    .digest('base64');
  const expected = `v1,${computed}`;

  // Compare against all signatures in header (space-separated)
  return signatures.split(' ').some((sig) => {
    try {
      return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const hookSecret = process.env.SUPABASE_HOOK_SECRET;

    if (!hookSecret) {
      console.error('[SupabaseEmailHook] SUPABASE_HOOK_SECRET not configured');
      return NextResponse.json({});
    }

    // Read raw body for signature verification
    const rawBody = await request.text();

    // Verify Standard Webhooks signature
    if (!verifyWebhookSignature(rawBody, request.headers, hookSecret)) {
      console.error('[SupabaseEmailHook] Webhook signature verification failed');
      // Return 200 to not break auth flow — log for debugging
      return NextResponse.json({});
    }

    const body = JSON.parse(rawBody);
    const { user, email_data } = body;

    if (!user?.id || !email_data?.email_action_type) {
      console.error('[SupabaseEmailHook] Invalid payload:', rawBody.slice(0, 500));
      return NextResponse.json({});
    }

    const { email_action_type, token_hash, redirect_to, site_url } = email_data;

    // Build confirmation URL that Supabase expects the user to visit
    // site_url from Supabase already ends with /auth/v1, so append only /verify
    const base = site_url || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
    const confirmUrl = `${base}/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to || '')}`;

    switch (email_action_type) {
      case 'signup': {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
        await cq.setUserProps(user.id, {
          '$email': user.email || '',
          '$name': name,
          pa_name: name || user.email || '',
          pa_doi: confirmUrl,
        });
        await cq.trackEvent(user.id, 'pa_doi');
        console.log(`[SupabaseEmailHook] DOI event sent for ${user.email}`);
        break;
      }

      case 'recovery': {
        await cq.setUserProps(user.id, {
          pa_password_link: confirmUrl,
        });
        await cq.trackEvent(user.id, 'pa_password_reset');
        console.log(`[SupabaseEmailHook] Password reset event sent for ${user.email}`);
        break;
      }

      case 'email_change': {
        await cq.setUserProps(user.id, {
          pa_new_email: email_data.new_email || '',
          pa_confirm_url: confirmUrl,
        });
        await cq.trackEvent(user.id, 'pa_email_change');
        console.log(`[SupabaseEmailHook] Email change event sent for ${user.email}`);
        break;
      }

      default: {
        console.warn(`[SupabaseEmailHook] Unknown email_action_type: ${email_action_type}`);
      }
    }

    return NextResponse.json({});
  } catch (error) {
    // Always return 200 to avoid breaking the auth flow
    console.error('[SupabaseEmailHook] Error:', error);
    return NextResponse.json({});
  }
}

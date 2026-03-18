import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cq } from '@/lib/carrotquest/client';

export const dynamic = 'force-dynamic';

/**
 * Supabase Send Email Hook handler.
 *
 * Supabase calls this endpoint instead of sending built-in auth emails.
 * We forward the email action to Carrot Quest for branded email delivery.
 *
 * Supabase sends a JWT (HS256) signed with SUPABASE_HOOK_SECRET in the
 * Authorization: Bearer <jwt> header. We verify the JWT with jose.
 *
 * IMPORTANT: Always return 200 — returning an error breaks the auth flow.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify JWT from Supabase
    const authHeader = request.headers.get('authorization');
    const hookSecret = process.env.SUPABASE_HOOK_SECRET;

    if (!hookSecret) {
      console.error('[SupabaseEmailHook] SUPABASE_HOOK_SECRET not configured');
      return NextResponse.json({});
    }

    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      console.error('[SupabaseEmailHook] Missing authorization header');
      // Return 200 to not break auth flow in case of misconfiguration
      return NextResponse.json({});
    }

    try {
      const secret = new TextEncoder().encode(hookSecret);
      await jwtVerify(token, secret);
    } catch (jwtError) {
      console.error('[SupabaseEmailHook] JWT verification failed:', jwtError);
      // Return 200 to not break auth flow — log for debugging
      return NextResponse.json({});
    }

    const body = await request.json();
    const { user, email_data } = body;

    if (!user?.id || !email_data?.email_action_type) {
      console.error('[SupabaseEmailHook] Invalid payload:', JSON.stringify(body));
      return NextResponse.json({});
    }

    const { email_action_type, token_hash, redirect_to, site_url } = email_data;

    // Build confirmation URL that Supabase expects the user to visit
    const confirmUrl = `${site_url || process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to || '')}`;

    switch (email_action_type) {
      case 'signup': {
        // Email confirmation — "click to confirm your email address"
        await cq.trackEvent(user.id, '$email_confirmation' as any, {
          confirm_url: confirmUrl,
          email: user.email || '',
        });
        console.log(`[SupabaseEmailHook] Email confirmation event sent for ${user.email}`);
        break;
      }

      case 'recovery': {
        // Password reset
        await cq.trackEvent(user.id, '$password_reset' as any, {
          reset_url: confirmUrl,
          email: user.email || '',
        });
        console.log(`[SupabaseEmailHook] Password reset event sent for ${user.email}`);
        break;
      }

      case 'email_change': {
        // Email change confirmation
        await cq.trackEvent(user.id, '$email_change' as any, {
          confirm_url: confirmUrl,
          email: user.email || '',
          new_email: email_data.new_email || '',
        });
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

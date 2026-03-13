import { NextRequest, NextResponse } from 'next/server';
import { cq } from '@/lib/carrotquest/client';

export const dynamic = 'force-dynamic';

/**
 * Supabase Send Email Hook handler.
 *
 * Supabase calls this endpoint instead of sending built-in auth emails.
 * We forward the email action to Carrot Quest for branded email delivery.
 *
 * Hook payload:
 * {
 *   user: { id, email, ... },
 *   email_data: { email_action_type, token_hash, redirect_to, site_url }
 * }
 *
 * IMPORTANT: Always return 200 — returning an error breaks the auth flow.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.SUPABASE_HOOK_SECRET;

    if (!expectedSecret) {
      console.error('[SupabaseEmailHook] SUPABASE_HOOK_SECRET not configured');
      return NextResponse.json({});
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      console.error('[SupabaseEmailHook] Invalid authorization header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

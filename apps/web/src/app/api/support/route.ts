import { NextResponse } from 'next/server';
import { cq } from '@/lib/carrotquest/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { theme, message, email, userId } = body as {
      theme: string;
      message: string;
      email: string;
      userId?: string;
    };

    if (!theme || !message || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: theme, message, email' },
        { status: 400 },
      );
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters' },
        { status: 400 },
      );
    }

    // Track support request event in Carrot Quest
    const cqUserId = userId || `anonymous-${email}`;
    await cq.trackEvent(cqUserId, 'pa_support_request', {
      theme,
      message,
      email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Support API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

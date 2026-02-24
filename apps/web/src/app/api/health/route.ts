import { NextResponse } from 'next/server';
import { prisma } from '@mpstats/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = process.uptime();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      timestamp,
      uptime,
      database: 'connected',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        status: 'degraded',
        timestamp,
        uptime,
        database: 'disconnected',
        error: message,
      },
      { status: 503 }
    );
  }
}

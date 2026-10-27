import { NextResponse } from 'next/server';
import { getPublicSiteVersion } from '@/lib/site-version';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(getPublicSiteVersion(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

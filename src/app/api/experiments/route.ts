import { NextRequest, NextResponse } from 'next/server';
import { experiments } from '@/lib/experiment-config';

export async function GET() {
  return NextResponse.json({ success: true, data: experiments });
}

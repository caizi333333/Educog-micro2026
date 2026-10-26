import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_REGISTRATION_CLOSED_MESSAGE } from '@/lib/auth-registration';

function setNoStore(response: NextResponse): NextResponse {
  response.headers?.set?.('Cache-Control', 'no-store, max-age=0');
  return response;
}

/**
 * Public self-registration is closed. Teachers and admins create accounts
 * from the class roster CSV import or the admin user screen.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  return setNoStore(NextResponse.json(
    { error: PUBLIC_REGISTRATION_CLOSED_MESSAGE },
    { status: 403 },
  ));
}

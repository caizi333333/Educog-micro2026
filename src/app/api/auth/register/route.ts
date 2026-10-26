import { NextResponse } from 'next/server';

export const PUBLIC_REGISTRATION_CLOSED_MESSAGE = '已关闭自助注册，请联系任课教师领取账号';

function setNoStore(response: NextResponse): NextResponse {
  response.headers?.set?.('Cache-Control', 'no-store, max-age=0');
  return response;
}

/**
 * Public self-registration is closed. Teachers and admins create accounts
 * from the class roster CSV import or the admin user screen.
 */
export async function POST(): Promise<NextResponse> {
  return setNoStore(NextResponse.json(
    { error: PUBLIC_REGISTRATION_CLOSED_MESSAGE },
    { status: 403 },
  ));
}

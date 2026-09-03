import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getValidToken(password: string): string {
  return crypto.createHash('sha256').update(password + '_SAIB_AUTH_SALT_2026').digest('hex');
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/saib_session=([^;]+)/);
    const sessionToken = match ? match[1] : null;

    const expectedPassword = (process.env.DASHBOARD_PASSWORD || 'alpaca2026').trim();
    const validToken = getValidToken(expectedPassword);

    if (sessionToken && sessionToken === validToken) {
      return NextResponse.json({ authenticated: true });
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

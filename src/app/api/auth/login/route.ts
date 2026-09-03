import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function getValidToken(password: string): string {
  return crypto.createHash('sha256').update(password + '_SAIB_AUTH_SALT_2026').digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const enteredPassword = typeof body.password === 'string' ? body.password.trim() : '';
    const rememberMe = body.rememberMe !== false;

    const expectedPassword = (process.env.DASHBOARD_PASSWORD || 'alpaca2026').trim();

    if (!enteredPassword || enteredPassword !== expectedPassword) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PASSPHRASE: The entered passphrase is incorrect.' },
        { status: 401 }
      );
    }

    const token = getValidToken(expectedPassword);
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 1 day

    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful. Access granted.'
    });

    response.cookies.set({
      name: 'saib_session',
      value: token,
      httpOnly: false, // accessible to client for fast initial check
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal authentication error' },
      { status: 500 }
    );
  }
}

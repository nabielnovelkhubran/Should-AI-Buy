import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { UserRole } from '@/lib/auth/types';

export const dynamic = 'force-dynamic';

function createToken(role: UserRole, secret: string): string {
  return crypto.createHash('sha256').update(role + '_' + secret + '_SAIB_AUTH_SALT_2026').digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const enteredPassword = typeof body.password === 'string' ? body.password.trim() : '';
    const rememberMe = body.rememberMe !== false;

    const operatorPassword = (process.env.OPERATOR_PASSWORD || process.env.DASHBOARD_PASSWORD || 'operator2026').trim();
    const viewPassword = (process.env.VIEW_PASSWORD || 'alpaca2026').trim();

    let role: UserRole | null = null;
    let matchingSecret = '';

    if (enteredPassword && enteredPassword === operatorPassword) {
      role = 'OPERATOR';
      matchingSecret = operatorPassword;
    } else if (enteredPassword && enteredPassword === viewPassword) {
      role = 'VIEWER';
      matchingSecret = viewPassword;
    }

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PASSPHRASE: Incorrect passphrase. Use alpaca2026 for View Mode or your operator passphrase.' },
        { status: 401 }
      );
    }

    const token = createToken(role, matchingSecret);
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 1 day

    const response = NextResponse.json({
      success: true,
      role,
      token,
      message: 'Access granted as ' + role
    });

    // Set cookies with secure: false so HTTP over Elastic IP preserves cookies across refreshes!
    response.cookies.set({
      name: 'saib_session',
      value: token,
      httpOnly: false,
      secure: false, // Critical for plain HTTP
      sameSite: 'lax',
      path: '/',
      maxAge
    });

    response.cookies.set({
      name: 'saib_role',
      value: role,
      httpOnly: false,
      secure: false,
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

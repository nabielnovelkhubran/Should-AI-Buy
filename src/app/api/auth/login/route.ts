import { NextResponse } from 'next/server';
import { UserRole } from '@/lib/auth/types';
import { createToken, getOperatorSecret, getViewSecret } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const enteredPassword = typeof body.password === 'string' ? body.password.trim() : '';
    const rememberMe = body.rememberMe !== false;

    const operatorPassword = getOperatorSecret();
    const viewPassword = getViewSecret();

    let role: UserRole | null = null;
    let matchingSecret = '';

    if (operatorPassword && enteredPassword === operatorPassword) {
      role = 'OPERATOR';
      matchingSecret = operatorPassword;
    } else if (enteredPassword && enteredPassword === viewPassword) {
      role = 'VIEWER';
      matchingSecret = viewPassword;
    }

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'INVALID_PASSPHRASE: Incorrect passphrase. Use alpaca2026 for View Mode or your private operator passphrase.' },
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

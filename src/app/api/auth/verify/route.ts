import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { UserRole } from '@/lib/auth/types';

export const dynamic = 'force-dynamic';

function createToken(role: UserRole, secret: string): string {
  return crypto.createHash('sha256').update(role + '_' + secret + '_SAIB_AUTH_SALT_2026').digest('hex');
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenMatch = cookieHeader.match(/saib_session=([^;]+)/);
    const roleMatch = cookieHeader.match(/saib_role=([^;]+)/);

    const sessionToken = tokenMatch ? tokenMatch[1] : null;
    const requestedRole = roleMatch ? (roleMatch[1] as UserRole) : null;

    const operatorPassword = (process.env.OPERATOR_PASSWORD || process.env.DASHBOARD_PASSWORD || 'operator2026').trim();
    const viewPassword = (process.env.VIEW_PASSWORD || 'alpaca2026').trim();

    const operatorToken = createToken('OPERATOR', operatorPassword);
    const viewToken = createToken('VIEWER', viewPassword);

    if (sessionToken) {
      if (sessionToken === operatorToken) {
        return NextResponse.json({ authenticated: true, role: 'OPERATOR' });
      }
      if (sessionToken === viewToken) {
        return NextResponse.json({ authenticated: true, role: 'VIEWER' });
      }
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

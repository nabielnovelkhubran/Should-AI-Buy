import { NextResponse } from 'next/server';
import { verifyRequestRole } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = verifyRequestRole(request);
    if (auth.authenticated && auth.role) {
      return NextResponse.json({ authenticated: true, role: auth.role });
    }
    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

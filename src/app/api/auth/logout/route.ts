import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.set({
    name: 'saib_session',
    value: '',
    path: '/',
    maxAge: 0
  });
  return response;
}

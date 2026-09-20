import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  adminCookieMaxAge,
  createAdminSession,
  validAdminCredentials,
} from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    username?: string;
    password?: string;
  } | null;
  if (!body || !validAdminCredentials(body.username ?? '', body.password ?? '')) {
    return NextResponse.json({ success: false, error: 'Invalid credentials.' }, { status: 401 });
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: adminCookieMaxAge(),
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

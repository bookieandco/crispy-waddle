import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ADMIN_COOKIE = 'pupson_admin';
const SESSION_SECONDS = 60 * 60 * 8;

function authSecret(): string | null {
  return process.env.PUPSON_ADMIN_SESSION_SECRET ?? null;
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAdminSession(): string {
  const secret = authSecret();
  if (!secret) throw new Error('PUPSON_ADMIN_SESSION_SECRET is not configured.');
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })
  ).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function isAdminSession(value: string | undefined): boolean {
  const secret = authSecret();
  if (!secret || !value) return false;
  const [payload, supplied] = value.split('.');
  if (!payload || !supplied) return false;
  const expected = signature(payload, secret);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return (
      decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now() / 1000
    );
  } catch {
    return false;
  }
}

export function validAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.PUPSON_ADMIN_USERNAME;
  const expectedPassword = process.env.PUPSON_ADMIN_PASSWORD;
  if (!expectedUser || !expectedPassword) return false;
  const userA = Buffer.from(username);
  const userB = Buffer.from(expectedUser);
  const passA = Buffer.from(password);
  const passB = Buffer.from(expectedPassword);
  return (
    userA.length === userB.length &&
    passA.length === passB.length &&
    timingSafeEqual(userA, userB) &&
    timingSafeEqual(passA, passB)
  );
}

export async function requireAdminPage(): Promise<void> {
  const store = await cookies();
  if (!isAdminSession(store.get(ADMIN_COOKIE)?.value)) redirect('/staff-login');
}

export function adminCookieMaxAge(): number {
  return SESSION_SECONDS;
}

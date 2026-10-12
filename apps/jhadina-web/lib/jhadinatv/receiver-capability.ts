import { createHmac, timingSafeEqual } from 'node:crypto';

interface JtvReceiverClaim {
  v: 1;
  ownerId: string;
  receiverId: string;
  issuedAt: number;
  expiresAt: number;
  audience: 'jhadinatv-receiver-auth';
}

function sign(payload: string, secret: string): Buffer {
  if (Buffer.byteLength(secret) < 32) throw new Error('Receiver signing secret is not commissioned.');
  return createHmac('sha256', secret).update(payload).digest();
}

export function createJtvReceiverToken(ownerId: string, receiverId: string, secret: string, now = Math.floor(Date.now() / 1000)): string {
  if (!ownerId || !/^[A-Za-z0-9._:-]{1,100}$/.test(receiverId)) throw new Error('Invalid receiver identity.');
  const body: JtvReceiverClaim = {
    v: 1, ownerId, receiverId, issuedAt: now, expiresAt: now + 60, audience: 'jhadinatv-receiver-auth',
  };
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${payload}.${sign(payload, secret).toString('base64url')}`;
}

/** Implement the corresponding verification on the trusted TV receiver before it acknowledges pairing. */
export function verifyJtvReceiverToken(token: string, secret: string, receiverId: string, now = Math.floor(Date.now() / 1000)): string | null {
  if (!token || token.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  const [payload, mac] = token.split('.');
  const expected = sign(payload, secret);
  const actual = Buffer.from(mac, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<JtvReceiverClaim>;
    if (claim.v !== 1 || claim.audience !== 'jhadinatv-receiver-auth' ||
        claim.receiverId !== receiverId || !claim.ownerId ||
        !Number.isSafeInteger(claim.issuedAt) || !Number.isSafeInteger(claim.expiresAt) ||
        (claim.issuedAt as number) > now + 30 || (claim.expiresAt as number) <= now ||
        (claim.expiresAt as number) - (claim.issuedAt as number) > 60) return null;
    return claim.ownerId;
  } catch {
    return null;
  }
}

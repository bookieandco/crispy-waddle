import { createHmac, timingSafeEqual } from 'node:crypto';

export type JtvStreamMode = 'live' | 'vod';
export type JtvStreamAudience = 'local' | 'cast';

export interface JtvStreamClaims {
  v: 1;
  ownerId: string;
  assetId: string;
  mode: JtvStreamMode;
  audience: JtvStreamAudience;
  territory: string;
  rightsEvidence: string;
  issuedAt: number;
  expiresAt: number;
}

const MAX_TTL_SECONDS = 4 * 60 * 60;
const DEFAULT_TTL_SECONDS = 60 * 60;

function secretBytes(secret: string): Buffer {
  const key = Buffer.from(secret);
  if (key.length < 32) throw new Error('JhadinaTV stream-signing secret must contain at least 32 bytes.');
  return key;
}

function signature(value: string, key: Buffer): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

export function createJtvStreamCapability(
  input: Pick<JtvStreamClaims, 'ownerId' | 'assetId' | 'mode' | 'audience' | 'territory' | 'rightsEvidence'>,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const key = secretBytes(secret);
  if (!Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new Error('Invalid JhadinaTV stream capability lifetime.');
  }
  if (!input.ownerId || !/^[A-Za-z0-9._:-]{1,160}$/.test(input.assetId) ||
      !['vod', 'live'].includes(input.mode) || !['local', 'cast'].includes(input.audience) ||
      !input.rightsEvidence) throw new Error('Invalid JhadinaTV stream capability scope.');
  const claims: JtvStreamClaims = { v: 1, ...input, issuedAt: nowSeconds, expiresAt: nowSeconds + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${encoded}.${signature(encoded, key).toString('base64url')}`;
}

export function verifyJtvStreamCapability(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): JtvStreamClaims | null {
  const key = secretBytes(secret);
  if (typeof token !== 'string' || token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  const [encoded, mac] = token.split('.');
  const supplied = Buffer.from(mac, 'base64url');
  const expected = signature(encoded, key);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<JtvStreamClaims>;
    if (value.v !== 1 || typeof value.ownerId !== 'string' || !value.ownerId ||
        typeof value.assetId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(value.assetId) ||
        (value.mode !== 'live' && value.mode !== 'vod') ||
        (value.audience !== 'local' && value.audience !== 'cast') ||
        typeof value.territory !== 'string' || typeof value.rightsEvidence !== 'string' || !value.rightsEvidence ||
        !Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)) return null;
    const issuedAt = value.issuedAt as number;
    const expiresAt = value.expiresAt as number;
    if (issuedAt > nowSeconds + 30 || expiresAt <= nowSeconds || expiresAt <= issuedAt ||
        expiresAt - issuedAt > MAX_TTL_SECONDS) return null;
    return value as JtvStreamClaims;
  } catch {
    return null;
  }
}

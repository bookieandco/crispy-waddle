import { canonicalBytes, canonicalize, type CanonicalizeOptions } from './canonical-json.js';

export interface CanonicalHash {
  algorithm: 'SHA-256';
  canonicalizationVersion: typeof import('./canonical-json.js').CANONICALIZATION_VERSION;
  canonicalJson: string;
  hex: string;
}

export async function sha256Canonical(
  value: unknown,
  options: CanonicalizeOptions = {},
): Promise<string> {
  const digest = await sha256Bytes(canonicalBytes(value, options));
  return bytesToHex(digest);
}

export async function hashCanonical(
  value: unknown,
  options: CanonicalizeOptions = {},
): Promise<CanonicalHash> {
  const canonicalJson = canonicalize(value, options);
  const digest = await sha256Bytes(new TextEncoder().encode(canonicalJson));

  return {
    algorithm: 'SHA-256',
    canonicalizationVersion: '1',
    canonicalJson,
    hex: bytesToHex(digest),
  };
}

async function sha256Bytes(bytes: Uint8Array): Promise<ArrayBuffer> {
  return globalThis.crypto.subtle.digest('SHA-256', bytes);
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

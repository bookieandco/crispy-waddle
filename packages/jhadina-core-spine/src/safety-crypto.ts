export interface SafetyIncidentKeyHandle {
  readonly incidentId: string;
  readonly keyId: string;
  readonly algorithm: 'AES-GCM-256';
}

export interface SafetyIncidentKeyProvider {
  create(incidentId: string): Promise<SafetyIncidentKeyHandle>;
  resolve(handle: SafetyIncidentKeyHandle): Promise<CryptoKey>;
  revoke(handle: SafetyIncidentKeyHandle): Promise<void>;
}

export interface SafetyEncryptedPayload {
  readonly keyId: string;
  readonly ivBase64: string;
  readonly ciphertextBase64: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function encryptSafetyPayload(
  plaintext: Uint8Array,
  key: CryptoKey,
  keyId: string,
): Promise<SafetyEncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    keyId,
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

import type { CredentialMaterial, CredentialStore } from '@jhadina/security-core';
import { credentialRefToEnvKey } from './credential-resolver.js';

/** Transitional server-only store. It is intentionally not exported to browser code. */
export class EnvironmentCredentialStore implements CredentialStore {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async resolve(credentialRef: string): Promise<CredentialMaterial | null> {
    let key: string;
    try { key = credentialRefToEnvKey(credentialRef); } catch { return null; }
    const secret = this.env[key];
    return secret ? { secret } : null;
  }
}

export type ResolvedCredential = {
  secret: string;
  expiresAt?: string;
};

export interface CredentialResolver {
  resolve(credentialRef: string): Promise<ResolvedCredential>;
}

/** Development-only resolver. Production must use a dedicated server secret store. */
export class EnvironmentCredentialResolver implements CredentialResolver {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async resolve(credentialRef: string): Promise<ResolvedCredential> {
    const key = credentialRefToEnvKey(credentialRef);
    const secret = this.env[key];
    if (!secret) throw new Error(`CREDENTIAL_NOT_CONFIGURED:${credentialRef}`);
    return { secret };
  }
}

export function credentialRefToEnvKey(credentialRef: string): string {
  if (!/^money\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(credentialRef)) {
    throw new Error(`INVALID_CREDENTIAL_REF:${credentialRef}`);
  }
  return `JHADINA_SECRET_${credentialRef
    .replace(/^money\//i, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .toUpperCase()}`;
}

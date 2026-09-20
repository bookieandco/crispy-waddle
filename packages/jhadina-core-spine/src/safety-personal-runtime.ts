import type { PersonalSafetyConfiguration } from './safety-personal-config.js';

export interface EncryptedPersonalSafetyProfileEnvelope {
  readonly profileId: string;
  readonly ownerUserId: string;
  readonly ciphertextRef: string;
  readonly keyId: string;
  readonly updatedAt: string;
}

export interface PersonalSafetyProfileStore {
  loadEnvelope(ownerUserId: string): Promise<EncryptedPersonalSafetyProfileEnvelope | null>;
  saveEnvelope(envelope: EncryptedPersonalSafetyProfileEnvelope): Promise<void>;
}

export interface PersonalSafetyProfileDecryptor {
  decrypt(envelope: EncryptedPersonalSafetyProfileEnvelope): Promise<PersonalSafetyConfiguration>;
}

/** SAFETY-PERSONAL.2 runtime: secrets remain encrypted outside source control. */
export class PersonalSafetyRuntime {
  constructor(
    private readonly store: PersonalSafetyProfileStore,
    private readonly decryptor: PersonalSafetyProfileDecryptor,
  ) {}

  async load(ownerUserId: string): Promise<PersonalSafetyConfiguration> {
    const envelope = await this.store.loadEnvelope(ownerUserId);
    if (!envelope) throw new Error('Personal safety profile not configured');
    if (envelope.ownerUserId !== ownerUserId) throw new Error('Personal safety profile owner mismatch');
    return this.decryptor.decrypt(envelope);
  }
}

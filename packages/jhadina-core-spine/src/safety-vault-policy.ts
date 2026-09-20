export interface SafetyVaultPolicy {
  readonly privateBucket: true;
  readonly requireEncryptionBeforeUpload: true;
  readonly requireHashVerification: true;
  readonly denyPublicUrls: true;
}

export const defaultSafetyVaultPolicy: SafetyVaultPolicy = {
  privateBucket: true,
  requireEncryptionBeforeUpload: true,
  requireHashVerification: true,
  denyPublicUrls: true,
};

export type CryptoExposureSubtype = 'spot' | 'mining' | 'staking' | 'derivatives' | 'other';

export type CryptoExposureRef = {
  subtype: CryptoExposureSubtype;
  asset: string;
  instrument: string;
  venue?: string;
  metadata?: Record<string, unknown>;
};

/** Preserves how crypto exposure was created while allowing portfolio risk to aggregate it as crypto. */
export function normalizeCryptoExposure(input: CryptoExposureRef): CryptoExposureRef {
  return {
    ...input,
    asset: input.asset.trim().toUpperCase(),
    instrument: input.instrument.trim(),
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };
}

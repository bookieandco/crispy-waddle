export type SfxGenerationInput = {
  prompt: string;
  durationSeconds: number;
  action?: string;
  materials?: string[];
  perspective?: 'close' | 'medium' | 'wide' | 'first-person';
  intensity?: 'subtle' | 'medium' | 'strong';
};

export type SfxCandidate = {
  assetId: string;
  provider: string;
  status: 'pending';
  durationSeconds: number;
  metadata: Record<string, unknown>;
};

export interface SfxProvider {
  generate(input: SfxGenerationInput): Promise<SfxCandidate[]>;
}

/** Development-safe provider. It returns metadata only and never claims audio was generated. */
export class UnconfiguredSfxProvider implements SfxProvider {
  async generate(input: SfxGenerationInput): Promise<SfxCandidate[]> {
    const requestKey = `${input.prompt}|${input.durationSeconds}|${input.action ?? ''}|${(input.materials ?? []).join(',')}`;
    const encoded = Buffer.from(requestKey).toString('base64url').slice(0, 24);
    return [{
      assetId: `sfx-pending-${encoded}`,
      provider: 'unconfigured',
      status: 'pending',
      durationSeconds: input.durationSeconds,
      metadata: {
        providerConfigured: false,
        generated: false,
        reason: 'No SFX provider configured; candidate is metadata-only.',
      },
    }];
  }
}

export function getSfxProvider(): SfxProvider {
  return new UnconfiguredSfxProvider();
}

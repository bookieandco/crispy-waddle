import type { AskVideoCreationIntent, DirectorVideoJobStatus } from './ask-video-production';

export type WholeVideoProviderCostClass = 'free-local' | 'external-free' | 'paid';

export interface WholeVideoProductionBrief {
  jobId: string;
  projectId: string;
  prompt: string;
  intent: AskVideoCreationIntent;
  creativeName: string;
  style?: string;
  scenes?: readonly { text: string; searchTerms: readonly string[] }[];
  character?: {
    characterId: string;
    continuityRef: string;
    appearanceVariantId: string;
    referenceUris: readonly string[];
    referenceSha256s: readonly string[];
  };
  product?: {
    productId: string;
    productBibleId: string;
    canonicalVariantId: string;
    referenceUris: readonly string[];
    referenceSha256s: readonly string[];
    labelAuthorities: readonly { text: string; surface: string }[];
  };
}

export interface WholeVideoProviderResult {
  providerJobId: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  resultUri?: string;
  error?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface WholeVideoProviderDescriptor {
  id: string;
  name: string;
  costClass: WholeVideoProviderCostClass;
  supportedModes: readonly AskVideoCreationIntent['mode'][];
  health: 'unknown' | 'healthy' | 'degraded' | 'offline';
  supportsCharacterReference?: boolean;
  requiresCharacterReference?: boolean;
  supportsProductReference?: boolean;
  requiresProductReference?: boolean;
  supportsExpressionGuidance?: boolean;
}

export interface WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor;
  submit(brief: WholeVideoProductionBrief, idempotencyKey: string): Promise<WholeVideoProviderResult>;
  status(providerJobId: string): Promise<WholeVideoProviderResult>;
  download(providerJobId: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  cancel(providerJobId: string): Promise<void>;
}

export function mapWholeVideoProviderStatus(
  result: WholeVideoProviderResult,
): DirectorVideoJobStatus {
  switch (result.status) {
    case 'queued': return 'submitted';
    case 'processing': return 'generating';
    case 'ready': return 'ingesting';
    case 'failed': return 'failed';
  }
}

export function selectWholeVideoProvider(
  providers: readonly WholeVideoProductionProvider[],
  intent: AskVideoCreationIntent,
  requirements: {
    characterReference?: boolean;
    productReference?: boolean;
    expressionGuidance?: boolean;
    paidProviderAuthorized?: boolean;
  } = {},
): WholeVideoProductionProvider | undefined {
  const compatible = providers.filter((provider) =>
    provider.descriptor.supportedModes.includes(intent.mode) &&
    (!requirements.characterReference || provider.descriptor.supportsCharacterReference === true) &&
    (!requirements.productReference || provider.descriptor.supportsProductReference === true) &&
    (!requirements.expressionGuidance || provider.descriptor.supportsExpressionGuidance === true) &&
    (requirements.characterReference || provider.descriptor.requiresCharacterReference !== true) &&
    (requirements.productReference || provider.descriptor.requiresProductReference !== true),
  );
  const safe = compatible.filter((provider) =>
    provider.descriptor.costClass !== 'paid'
    || intent.providerPolicy.allowPaidWithoutApproval
    || requirements.paidProviderAuthorized === true,
  );
  return [...safe].sort((a, b) => {
    const costRank = (provider: WholeVideoProductionProvider) =>
      provider.descriptor.costClass === 'free-local' ? 0 :
      provider.descriptor.costClass === 'external-free' ? 1 : 2;
    const modeRank = (provider: WholeVideoProductionProvider) => {
      if (intent.mode === 'short' && provider.descriptor.id === 'short-video-maker') return -1;
      if (provider.descriptor.id === 'agnes-video-generator') return 0;
      return 1;
    };
    return costRank(a) - costRank(b) || modeRank(a) - modeRank(b) || a.descriptor.id.localeCompare(b.descriptor.id);
  })[0];
}

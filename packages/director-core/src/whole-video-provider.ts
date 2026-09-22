import type { AskVideoCreationIntent, DirectorVideoJobStatus } from './ask-video-production';

export type WholeVideoProviderCostClass = 'free-local' | 'external-free' | 'paid';

export interface WholeVideoReferenceCharacter {
  characterId: string;
  continuityRef: string;
  appearanceVariantId: string;
  referenceAssetIds: readonly string[];
  targetLanguages?: readonly string[];
}

export interface WholeVideoProductionBrief {
  jobId: string;
  projectId: string;
  prompt: string;
  intent: AskVideoCreationIntent;
  creativeName: string;
  style?: string;
  scenes?: readonly { text: string; searchTerms: readonly string[] }[];
  referenceCharacters?: readonly WholeVideoReferenceCharacter[];
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
  /** Omitted is treated as unsupported so identity is never silently dropped. */
  referenceCharacterSupport?: 'none' | 'single' | 'multiple';
  health: 'unknown' | 'healthy' | 'degraded' | 'offline';
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
  requirements?: { referenceCharacterCount?: number },
): WholeVideoProductionProvider | undefined {
  const requiredReferences = Math.max(0, requirements?.referenceCharacterCount ?? 0);
  const compatible = providers.filter((provider) => {
    if (!provider.descriptor.supportedModes.includes(intent.mode)) return false;
    if (!requiredReferences) return true;
    const support = provider.descriptor.referenceCharacterSupport ?? 'none';
    if (support === 'none') return false;
    if (support === 'single' && requiredReferences > 1) return false;
    return true;
  });
  const safe = compatible.filter((provider) =>
    provider.descriptor.costClass !== 'paid' || intent.providerPolicy.allowPaidWithoutApproval,
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

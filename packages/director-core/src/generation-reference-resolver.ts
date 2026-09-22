import type {
  GenerationProvider,
  GenerationRequest,
  GenerationResult,
  GenerationSubmissionOptions,
} from './generation-provider';
import type { GenerationProviderRecord } from './generation-registry';

export type ResolvedGenerationReference = {
  assetId: string;
  uri: string;
  sha256?: string;
};

export interface GenerationReferenceUriResolver {
  resolve(input: {
    projectId: string;
    assetId: string;
    role: NonNullable<GenerationRequest['references']>[number]['role'];
  }): Promise<ResolvedGenerationReference | undefined>;
}

/**
 * Submission-edge provider wrapper.
 *
 * Durable generation tasks persist stable asset IDs, never expiring signed URLs.
 * Every real provider submission (including recovery) resolves a fresh URI here.
 */
export class ReferenceResolvingGenerationProvider implements GenerationProvider {
  readonly descriptor: GenerationProviderRecord;
  readonly submissionGuarantee: GenerationProvider['submissionGuarantee'];

  constructor(
    private readonly provider: GenerationProvider,
    private readonly resolver: GenerationReferenceUriResolver,
  ) {
    this.descriptor = provider.descriptor;
    this.submissionGuarantee = provider.submissionGuarantee;
    if (provider.submissionGuarantee === 'recoverable' && !provider.findByIdempotencyKey) {
      throw new Error(`Provider ${provider.descriptor.id} declares recoverable submission without recovery lookup`);
    }
  }

  async submit(
    request: GenerationRequest,
    options?: GenerationSubmissionOptions,
  ): Promise<GenerationResult> {
    const references = await Promise.all((request.references ?? []).map(async (reference) => {
      if (reference.uri) return reference;
      const resolved = await this.resolver.resolve({
        projectId: request.projectId,
        assetId: reference.assetId,
        role: reference.role,
      });
      if (!resolved) {
        if (reference.role === 'character') {
          throw new Error(`DIRECTOR_CHARACTER_REFERENCE_URI_UNRESOLVED:${reference.assetId}`);
        }
        return reference;
      }
      return { ...reference, uri: resolved.uri };
    }));

    return this.provider.submit({ ...request, references }, options);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<GenerationResult | undefined> {
    return this.provider.findByIdempotencyKey
      ? this.provider.findByIdempotencyKey(idempotencyKey)
      : undefined;
  }

  status(providerJobId: string): Promise<GenerationResult> {
    return this.provider.status(providerJobId);
  }

  cancel(providerJobId: string): Promise<void> {
    return this.provider.cancel(providerJobId);
  }
}

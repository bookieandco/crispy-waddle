import type {
  GenerationModality,
  GenerationProviderRecord,
  LoRARecord,
  ModelRecord,
} from './generation-registry';
import { resolveComfyUIHistoryOutputs } from './comfyui-output-resolver';

export type GenerationReference = {
  assetId: string;
  role: 'character' | 'location' | 'style' | 'composition' | 'motion' | 'image';
  uri?: string;
};

export type GenerationRequest = {
  requestId: string;
  projectId: string;
  modality: GenerationModality;
  prompt: string;
  negativePrompt?: string;
  model: ModelRecord;
  loras?: Array<{ lora: LoRARecord; weight?: number }>;
  references?: GenerationReference[];
  parameters: Record<string, unknown>;
};

export type GenerationResult = {
  requestId: string;
  providerId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  assetIds: string[];
  providerJobId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Describes what Director can safely assume when a worker loses its lease around submission.
 *
 * strong-idempotent: the provider transport atomically deduplicates the idempotency key.
 * recoverable: Director can discover an already-created job by idempotency key, but lookup
 * + submit is not itself an exactly-once primitive.
 * non-idempotent: submission can create an unrecoverable duplicate and must not be retried
 * automatically after lease loss.
 */
export type GenerationSubmissionGuarantee = 'strong-idempotent' | 'recoverable' | 'non-idempotent';

/** Stable key used by providers to deduplicate submissions across retries. */
export type GenerationSubmissionOptions = {
  idempotencyKey: string;
};

export interface GenerationProvider {
  readonly descriptor: GenerationProviderRecord;
  readonly submissionGuarantee?: GenerationSubmissionGuarantee;
  submit(request: GenerationRequest, options?: GenerationSubmissionOptions): Promise<GenerationResult>;
  /** Optional recovery lookup for providers that can resolve an already-submitted request. */
  findByIdempotencyKey?(idempotencyKey: string): Promise<GenerationResult | undefined>;
  status(providerJobId: string): Promise<GenerationResult>;
  cancel(providerJobId: string): Promise<void>;
}

export type ComfyUIClient = {
  queuePrompt(workflow: Record<string, unknown>, options?: { clientId?: string }): Promise<{ promptId: string }>;
  getHistory(promptId: string): Promise<Record<string, unknown>>;
  findPromptByClientId?(clientId: string): Promise<string | undefined>;
  interrupt(promptId: string): Promise<void>;
};

export type ComfyUIWorkflowBuilder = (request: GenerationRequest) => Record<string, unknown>;

export class ComfyUIProvider implements GenerationProvider {
  readonly descriptor: GenerationProviderRecord;
  readonly submissionGuarantee: GenerationSubmissionGuarantee = 'recoverable';

  constructor(
    descriptor: GenerationProviderRecord,
    private readonly client: ComfyUIClient,
    private readonly buildWorkflow: ComfyUIWorkflowBuilder,
  ) {
    if (descriptor.kind !== 'comfyui') throw new Error('ComfyUIProvider requires a comfyui provider descriptor');
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<GenerationResult | undefined> {
    if (!this.client.findPromptByClientId) return undefined;
    const promptId = await this.client.findPromptByClientId(idempotencyKey);
    if (!promptId) return undefined;
    return this.status(promptId);
  }

  async submit(request: GenerationRequest, options?: GenerationSubmissionOptions): Promise<GenerationResult> {
    if (options?.idempotencyKey && this.client.findPromptByClientId) {
      const existing = await this.findByIdempotencyKey(options.idempotencyKey);
      if (existing) return existing;
    }
    const workflow = this.buildWorkflow(request);
    const { promptId } = await this.client.queuePrompt(workflow, options?.idempotencyKey ? { clientId: options.idempotencyKey } : undefined);
    return {
      requestId: request.requestId,
      providerId: this.descriptor.id,
      status: 'queued',
      assetIds: [],
      providerJobId: promptId,
      metadata: options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined,
    };
  }

  async status(providerJobId: string): Promise<GenerationResult> {
    const history = await this.client.getHistory(providerJobId);
    if (history.error) {
      return {
        requestId: String(history.requestId ?? providerJobId),
        providerId: this.descriptor.id,
        status: 'failed',
        assetIds: [],
        providerJobId,
        error: String(history.error),
        metadata: history,
      };
    }

    const outputs = resolveComfyUIHistoryOutputs(history as Parameters<typeof resolveComfyUIHistoryOutputs>[0], {
      baseUrl: this.descriptor.endpoint ?? 'http://localhost:8188',
    });
    const completed = outputs.length > 0 || Boolean(history.outputs);

    return {
      requestId: String(history.requestId ?? providerJobId),
      providerId: this.descriptor.id,
      status: completed ? 'completed' : 'running',
      assetIds: Array.isArray(history.assetIds) ? history.assetIds.map(String) : [],
      providerJobId,
      metadata: {
        ...history,
        outputs,
      },
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    await this.client.interrupt(providerJobId);
  }
}

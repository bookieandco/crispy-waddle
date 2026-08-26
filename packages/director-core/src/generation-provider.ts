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

export interface GenerationProvider {
  readonly descriptor: GenerationProviderRecord;
  submit(request: GenerationRequest): Promise<GenerationResult>;
  status(providerJobId: string): Promise<GenerationResult>;
  cancel(providerJobId: string): Promise<void>;
}

export type ComfyUIClient = {
  queuePrompt(workflow: Record<string, unknown>): Promise<{ promptId: string }>;
  getHistory(promptId: string): Promise<Record<string, unknown>>;
  interrupt(promptId: string): Promise<void>;
};

export type ComfyUIWorkflowBuilder = (request: GenerationRequest) => Record<string, unknown>;

export class ComfyUIProvider implements GenerationProvider {
  readonly descriptor: GenerationProviderRecord;

  constructor(
    descriptor: GenerationProviderRecord,
    private readonly client: ComfyUIClient,
    private readonly buildWorkflow: ComfyUIWorkflowBuilder,
  ) {
    if (descriptor.kind !== 'comfyui') throw new Error('ComfyUIProvider requires a comfyui provider descriptor');
  }

  async submit(request: GenerationRequest): Promise<GenerationResult> {
    const workflow = this.buildWorkflow(request);
    const { promptId } = await this.client.queuePrompt(workflow);
    return {
      requestId: request.requestId,
      providerId: this.descriptor.id,
      status: 'queued',
      assetIds: [],
      providerJobId: promptId,
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

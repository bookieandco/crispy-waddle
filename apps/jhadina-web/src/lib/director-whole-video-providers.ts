import { createComfyUIHttpClient, resolveComfyUIHistoryOutputs } from '@jhadina/director-core';
import type {
  WholeVideoProductionBrief,
  WholeVideoProductionProvider,
  WholeVideoProviderCostClass,
  WholeVideoProviderDescriptor,
  WholeVideoProviderResult,
} from '@jhadina/director-core/whole-video-provider';

type ProviderHttpConfig = { baseUrl: string; token?: string };

function cleanBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function referenceProviderCostClass(): WholeVideoProviderCostClass {
  const value = process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_COST_CLASS;
  return value === 'paid' || value === 'external-free' || value === 'free-local' ? value : 'free-local';
}

function productProviderCostClass(): WholeVideoProviderCostClass {
  const value = process.env.DIRECTOR_PRODUCT_VIDEO_PROVIDER_COST_CLASS;
  return value === 'paid' || value === 'external-free' || value === 'free-local' ? value : 'free-local';
}

function providerHeaders(token?: string): HeadersInit | undefined {
  return token ? { authorization: `Bearer ${token}` } : undefined;
}

function dimensions(aspectRatio: WholeVideoProductionBrief['intent']['aspectRatio']): { width: number; height: number } {
  if (aspectRatio === '9:16') return { width: 768, height: 1152 };
  if (aspectRatio === '1:1') return { width: 1024, height: 1024 };
  return { width: 1152, height: 768 };
}

function searchTerms(text: string): string[] {
  const stop = new Set(['about','after','again','also','and','are','but','create','for','from','generate','into','make','movie','that','the','this','video','with','you','your']);
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  const unique = [...new Set(words.filter((word) => word.length > 2 && !stop.has(word)))];
  return unique.slice(0, 4).length >= 2 ? unique.slice(0, 4) : ['cinematic', 'story'];
}


type ComfyReferenceVideoConfig = ProviderHttpConfig & {
  workflow: Record<string, unknown>;
};

function deterministicSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) & 0x7fffffff;
}

function referenceExtension(contentType: string): string {
  if (contentType.includes('jpeg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  return 'png';
}

function applyWorkflowTemplate(
  value: unknown,
  replacements: Record<string, unknown>,
): unknown {
  if (typeof value === 'string') {
    if (Object.prototype.hasOwnProperty.call(replacements, value)) return replacements[value];
    let result = value;
    for (const [token,replacement] of Object.entries(replacements)) {
      if (typeof replacement === 'string' || typeof replacement === 'number' || typeof replacement === 'boolean') {
        result = result.split(token).join(String(replacement));
      }
    }
    return result;
  }
  if (Array.isArray(value)) return value.map((item) => applyWorkflowTemplate(item,replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string,unknown>)
        .map(([key,item]) => [key,applyWorkflowTemplate(item,replacements)]),
    );
  }
  return value;
}

function parseReferenceComfyWorkflow(): Record<string, unknown> | undefined {
  const raw = process.env.DIRECTOR_REFERENCE_COMFYUI_WORKFLOW_JSON?.trim();
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('workflow must be a JSON object');
    }
    return value as Record<string,unknown>;
  } catch (error) {
    throw new Error(`DIRECTOR_REFERENCE_COMFYUI_WORKFLOW_INVALID:${error instanceof Error ? error.message : 'invalid JSON'}`);
  }
}

function isVideoOutput(uri: string): boolean {
  return /\.(?:mp4|webm|mov|mkv|gif)(?:\?|$)/i.test(uri);
}

/**
 * Native reference-character whole-video adapter for the existing Director
 * ComfyUI runtime. The workflow is deployment configuration; canonical
 * character identity/reference hashes remain Director-owned.
 *
 * Supported exact placeholders in DIRECTOR_REFERENCE_COMFYUI_WORKFLOW_JSON:
 * {{DIRECTOR_PROMPT}}, {{DIRECTOR_REFERENCE_IMAGE}},
 * {{DIRECTOR_REFERENCE_IMAGES}}, {{DIRECTOR_CHARACTER_ID}},
 * {{DIRECTOR_CONTINUITY_REF}}, {{DIRECTOR_APPEARANCE_VARIANT_ID}},
 * {{DIRECTOR_WIDTH}}, {{DIRECTOR_HEIGHT}}, {{DIRECTOR_DURATION_SECONDS}},
 * {{DIRECTOR_SEED}}, {{DIRECTOR_JOB_ID}}, {{DIRECTOR_PROJECT_ID}}.
 */
export class ComfyUIReferenceVideoProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor = {
    id: process.env.DIRECTOR_REFERENCE_COMFYUI_PROVIDER_ID ?? 'comfyui-reference-video',
    name: process.env.DIRECTOR_REFERENCE_COMFYUI_PROVIDER_NAME ?? 'ComfyUI Reference Video',
    costClass: 'free-local',
    supportedModes: ['standard','short','long-form'],
    health: 'unknown',
    supportsCharacterReference: true,
    requiresCharacterReference: true,
    supportsExpressionGuidance: true,
  };

  private readonly baseUrl: string;
  private readonly client: ReturnType<typeof createComfyUIHttpClient>;

  constructor(private readonly config: ComfyReferenceVideoConfig) {
    this.baseUrl = cleanBaseUrl(config.baseUrl);
    this.client = createComfyUIHttpClient({
      baseUrl: this.baseUrl,
      ...(config.token ? { headers: { authorization: `Bearer ${config.token}` } } : {}),
    });
  }

  private async uploadReference(uri: string, sha256: string): Promise<string> {
    const source = await fetch(uri, { cache: 'no-store' });
    if (!source.ok) throw new Error(`DIRECTOR_COMFYUI_REFERENCE_DOWNLOAD_FAILED:${source.status}`);
    const contentType = source.headers.get('content-type') ?? 'image/png';
    const form = new FormData();
    form.set(
      'image',
      new Blob([await source.arrayBuffer()], { type: contentType }),
      `director-${sha256.slice(0,16)}.${referenceExtension(contentType)}`,
    );
    form.set('type','input');
    form.set('overwrite','true');

    const uploaded = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      headers: this.config.token ? { authorization: `Bearer ${this.config.token}` } : undefined,
      body: form,
    });
    if (!uploaded.ok) throw new Error(`DIRECTOR_COMFYUI_REFERENCE_UPLOAD_FAILED:${uploaded.status}`);
    const body = await uploaded.json() as { name?:string; subfolder?:string };
    if (!body.name) throw new Error('DIRECTOR_COMFYUI_REFERENCE_UPLOAD_NAME_MISSING');
    return body.subfolder ? `${body.subfolder}/${body.name}` : body.name;
  }

  async submit(brief: WholeVideoProductionBrief, idempotencyKey: string): Promise<WholeVideoProviderResult> {
    if (!brief.character?.referenceUris.length) {
      throw new Error('DIRECTOR_REFERENCE_VIDEO_CHARACTER_REQUIRED');
    }
    if (brief.character.referenceUris.length !== brief.character.referenceSha256s.length) {
      throw new Error('DIRECTOR_REFERENCE_VIDEO_REFERENCE_DIGEST_MISMATCH');
    }

    const existing = await this.client.findPromptByClientId?.(idempotencyKey);
    if (existing) return this.status(existing);

    const uploadedReferences: string[] = [];
    for (let index=0; index<brief.character.referenceUris.length; index += 1) {
      uploadedReferences.push(await this.uploadReference(
        brief.character.referenceUris[index]!,
        brief.character.referenceSha256s[index]!,
      ));
    }

    const {width,height}=dimensions(brief.intent.aspectRatio);
    const durationSeconds=Math.max(2,Math.min(300,brief.intent.targetDurationSeconds ?? (brief.intent.mode==='short'?30:45)));
    const replacements: Record<string,unknown> = {
      '{{DIRECTOR_PROMPT}}': brief.prompt,
      '{{DIRECTOR_REFERENCE_IMAGE}}': uploadedReferences[0]!,
      '{{DIRECTOR_REFERENCE_IMAGES}}': uploadedReferences,
      '{{DIRECTOR_CHARACTER_ID}}': brief.character.characterId,
      '{{DIRECTOR_CONTINUITY_REF}}': brief.character.continuityRef,
      '{{DIRECTOR_APPEARANCE_VARIANT_ID}}': brief.character.appearanceVariantId,
      '{{DIRECTOR_WIDTH}}': width,
      '{{DIRECTOR_HEIGHT}}': height,
      '{{DIRECTOR_DURATION_SECONDS}}': durationSeconds,
      '{{DIRECTOR_SEED}}': deterministicSeed(idempotencyKey),
      '{{DIRECTOR_JOB_ID}}': brief.jobId,
      '{{DIRECTOR_PROJECT_ID}}': brief.projectId,
    };
    const workflow = applyWorkflowTemplate(this.config.workflow,replacements) as Record<string,unknown>;
    const {promptId}=await this.client.queuePrompt(workflow,{clientId:idempotencyKey});
    return {
      providerJobId: promptId,
      status: 'queued',
      metadata: {
        characterId: brief.character.characterId,
        continuityRef: brief.character.continuityRef,
        appearanceVariantId: brief.character.appearanceVariantId,
        referenceSha256s: [...brief.character.referenceSha256s],
      },
    };
  }

  async status(providerJobId: string): Promise<WholeVideoProviderResult> {
    const history=await this.client.getHistory(providerJobId);
    if (history.error) {
      return {providerJobId,status:'failed',error:String(history.error)};
    }
    const outputs=resolveComfyUIHistoryOutputs(history,{baseUrl:this.baseUrl});
    const video=outputs.find((output)=>output.mediaType==='video' || isVideoOutput(output.uri));
    if (video) {
      return {
        providerJobId,
        status:'ready',
        resultUri:video.uri,
        metadata:{outputCount:outputs.length},
      };
    }
    return {providerJobId,status:'processing',metadata:{outputCount:outputs.length}};
  }

  async download(providerJobId: string): Promise<{bytes:Uint8Array;contentType:string}> {
    const result=await this.status(providerJobId);
    if (result.status!=='ready' || !result.resultUri) {
      throw new Error('DIRECTOR_COMFYUI_VIDEO_NOT_READY');
    }
    const response=await fetch(result.resultUri,{
      headers:this.config.token?{authorization:`Bearer ${this.config.token}`}:undefined,
      cache:'no-store',
    });
    if(!response.ok) throw new Error(`DIRECTOR_COMFYUI_VIDEO_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes:new Uint8Array(await response.arrayBuffer()),
      contentType:response.headers.get('content-type') ?? 'video/mp4',
    };
  }

  async cancel(providerJobId:string):Promise<void>{
    await this.client.interrupt(providerJobId);
  }
}

export class ReferenceCharacterVideoProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor = {
    id: process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_ID ?? 'reference-video-local',
    name: process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_NAME ?? 'Reference Character Video',
    costClass: referenceProviderCostClass(),
    supportedModes: ['standard', 'short', 'long-form'],
    health: 'unknown',
    supportsCharacterReference: true,
    requiresCharacterReference: true,
    supportsExpressionGuidance: true,
  };

  private readonly baseUrl: string;
  constructor(private readonly config: ProviderHttpConfig) {
    this.baseUrl = cleanBaseUrl(config.baseUrl);
  }

  async submit(brief: WholeVideoProductionBrief, idempotencyKey: string): Promise<WholeVideoProviderResult> {
    if (!brief.character?.referenceUris.length) {
      throw new Error('DIRECTOR_REFERENCE_VIDEO_CHARACTER_REQUIRED');
    }
    const response = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {}),
      },
      body: JSON.stringify({
        jobId: brief.jobId,
        projectId: brief.projectId,
        prompt: brief.prompt,
        intent: brief.intent,
        creativeName: brief.creativeName,
        style: brief.style,
        scenes: brief.scenes,
        character: brief.character,
      }),
    });
    if (!response.ok) throw new Error(`DIRECTOR_REFERENCE_VIDEO_SUBMIT_FAILED:${response.status}`);
    const body = await response.json() as {
      providerJobId?: string;
      status?: WholeVideoProviderResult['status'];
      metadata?: Record<string, unknown>;
    };
    if (!body.providerJobId) throw new Error('DIRECTOR_REFERENCE_VIDEO_PROVIDER_JOB_ID_MISSING');
    return {
      providerJobId: body.providerJobId,
      status: body.status ?? 'queued',
      ...(body.metadata ? { metadata: body.metadata } : {}),
    };
  }

  async status(providerJobId: string): Promise<WholeVideoProviderResult> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(providerJobId)}`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_REFERENCE_VIDEO_STATUS_FAILED:${response.status}`);
    const body = await response.json() as WholeVideoProviderResult;
    return { ...body, providerJobId };
  }

  async download(providerJobId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(providerJobId)}/output`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_REFERENCE_VIDEO_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(providerJobId)}`, {
      method: 'DELETE',
      headers: providerHeaders(this.config.token),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`DIRECTOR_REFERENCE_VIDEO_CANCEL_FAILED:${response.status}`);
    }
  }
}

export class ReferenceProductVideoProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor = {
    id: process.env.DIRECTOR_PRODUCT_VIDEO_PROVIDER_ID ?? 'product-reference-video-local',
    name: process.env.DIRECTOR_PRODUCT_VIDEO_PROVIDER_NAME ?? 'Product Reference Video',
    costClass: productProviderCostClass(),
    supportedModes: ['standard', 'short', 'faceless', 'long-form'],
    health: 'unknown',
    supportsProductReference: true,
    requiresProductReference: true,
    supportsExpressionGuidance: true,
  };

  private readonly baseUrl: string;
  constructor(private readonly config: ProviderHttpConfig) {
    this.baseUrl = cleanBaseUrl(config.baseUrl);
  }

  async submit(brief: WholeVideoProductionBrief, idempotencyKey: string): Promise<WholeVideoProviderResult> {
    if (!brief.product?.referenceUris.length) {
      throw new Error('DIRECTOR_PRODUCT_VIDEO_REFERENCE_REQUIRED');
    }
    const response = await fetch(`${this.baseUrl}/jobs`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {}),
      },
      body: JSON.stringify({
        jobId: brief.jobId,
        projectId: brief.projectId,
        prompt: brief.prompt,
        intent: brief.intent,
        creativeName: brief.creativeName,
        style: brief.style,
        scenes: brief.scenes,
        product: brief.product,
      }),
    });
    if (!response.ok) throw new Error(`DIRECTOR_PRODUCT_VIDEO_SUBMIT_FAILED:${response.status}`);
    const body = await response.json() as {
      providerJobId?: string;
      status?: WholeVideoProviderResult['status'];
      metadata?: Record<string, unknown>;
    };
    if (!body.providerJobId) throw new Error('DIRECTOR_PRODUCT_VIDEO_PROVIDER_JOB_ID_MISSING');
    return {
      providerJobId: body.providerJobId,
      status: body.status ?? 'queued',
      ...(body.metadata ? { metadata: body.metadata } : {}),
    };
  }

  async status(providerJobId: string): Promise<WholeVideoProviderResult> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(providerJobId)}`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_PRODUCT_VIDEO_STATUS_FAILED:${response.status}`);
    const body = await response.json() as WholeVideoProviderResult;
    return { ...body, providerJobId };
  }

  async download(providerJobId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(providerJobId)}/output`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_PRODUCT_VIDEO_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(providerJobId)}`, {
      method: 'DELETE',
      headers: providerHeaders(this.config.token),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`DIRECTOR_PRODUCT_VIDEO_CANCEL_FAILED:${response.status}`);
    }
  }
}

export class ShortVideoMakerProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor = {
    id: 'short-video-maker',
    name: 'Short Video Maker',
    costClass: 'free-local',
    supportedModes: ['short', 'faceless', 'standard'],
    health: 'unknown',
  };

  private readonly baseUrl: string;
  constructor(private readonly config: ProviderHttpConfig) {
    this.baseUrl = cleanBaseUrl(config.baseUrl);
  }

  async submit(brief: WholeVideoProductionBrief, _idempotencyKey: string): Promise<WholeVideoProviderResult> {
    const scenes = brief.scenes?.length
      ? brief.scenes.map((scene) => ({ text: scene.text, searchTerms: [...scene.searchTerms] }))
      : [{ text: brief.prompt, searchTerms: searchTerms(brief.prompt) }];

    const response = await fetch(`${this.baseUrl}/api/short-video`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.token ? { authorization: `Bearer ${this.config.token}` } : {}),
      },
      body: JSON.stringify({
        scenes,
        config: {
          paddingBack: 600,
          captionPosition: 'bottom',
          orientation: brief.intent.aspectRatio === '9:16' ? 'portrait' : 'landscape',
          musicVolume: 'low',
          voice: process.env.DIRECTOR_SHORT_VIDEO_VOICE ?? 'af_heart',
        },
      }),
    });
    if (!response.ok) throw new Error(`DIRECTOR_SHORT_VIDEO_SUBMIT_FAILED:${response.status}`);
    const body = await response.json() as { videoId?: string };
    if (!body.videoId) throw new Error('DIRECTOR_SHORT_VIDEO_PROVIDER_JOB_ID_MISSING');
    return { providerJobId: body.videoId, status: 'queued' };
  }

  async status(providerJobId: string): Promise<WholeVideoProviderResult> {
    const response = await fetch(`${this.baseUrl}/api/short-video/${encodeURIComponent(providerJobId)}/status`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_SHORT_VIDEO_STATUS_FAILED:${response.status}`);
    const body = await response.json() as { status?: 'processing' | 'ready' | 'failed' };
    return {
      providerJobId,
      status: body.status === 'ready' ? 'ready' : body.status === 'failed' ? 'failed' : 'processing',
      ...(body.status === 'ready' ? { resultUri: `${this.baseUrl}/api/short-video/${encodeURIComponent(providerJobId)}` } : {}),
    };
  }

  async download(providerJobId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const response = await fetch(`${this.baseUrl}/api/short-video/${encodeURIComponent(providerJobId)}`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_SHORT_VIDEO_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/short-video/${encodeURIComponent(providerJobId)}`, {
      method: 'DELETE',
      headers: providerHeaders(this.config.token),
    });
    if (!response.ok && response.status !== 404) throw new Error(`DIRECTOR_SHORT_VIDEO_CANCEL_FAILED:${response.status}`);
  }
}

export class AgnesVideoProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor = {
    id: 'agnes-video-generator',
    name: 'Agnes Video Generator',
    costClass: 'external-free',
    supportedModes: ['standard', 'short', 'faceless', 'long-form'],
    health: 'unknown',
    supportsExpressionGuidance: true,
  };

  private readonly baseUrl: string;
  constructor(private readonly config: ProviderHttpConfig) {
    this.baseUrl = cleanBaseUrl(config.baseUrl);
  }

  async submit(brief: WholeVideoProductionBrief, _idempotencyKey: string): Promise<WholeVideoProviderResult> {
    const { width, height } = dimensions(brief.intent.aspectRatio);
    const target = Math.max(5, Math.min(300, brief.intent.targetDurationSeconds ?? (brief.intent.mode === 'short' ? 30 : 45)));
    const sceneCount = Math.max(1, Math.min(30, Math.ceil(target / 6)));
    const duration = Math.max(2, Math.min(30, Math.round(target / sceneCount)));
    const sceneDurations = Array.from({ length: sceneCount }, () => duration);

    const form = new FormData();
    form.set('idea', brief.prompt);
    form.set('creative_name', brief.creativeName);
    form.set('style', brief.style ?? 'cinematic, coherent, visually clear');
    form.set('chaining_mode', 'keyframes');
    form.set('video_width', String(width));
    form.set('video_height', String(height));
    form.set('duration_source', 'manual');
    form.set('scene_count', String(sceneCount));
    form.set('uniform_duration', 'true');
    form.set('scene_durations_json', JSON.stringify(sceneDurations));
    form.set('audio_enabled', String(brief.intent.narration));
    form.set('subtitle_enabled', String(brief.intent.captions));
    form.set('execution_mode', 'auto');

    const response = await fetch(`${this.baseUrl}/api/tasks/creative`, {
      method: 'POST',
      headers: providerHeaders(this.config.token),
      body: form,
    });
    if (!response.ok) throw new Error(`DIRECTOR_AGNES_VIDEO_SUBMIT_FAILED:${response.status}`);
    const body = await response.json() as { ok?: boolean; task_id?: string };
    if (!body.task_id) throw new Error('DIRECTOR_AGNES_VIDEO_PROVIDER_JOB_ID_MISSING');
    return { providerJobId: body.task_id, status: 'queued' };
  }

  async status(providerJobId: string): Promise<WholeVideoProviderResult> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${encodeURIComponent(providerJobId)}`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_AGNES_VIDEO_STATUS_FAILED:${response.status}`);
    const body = await response.json() as {
      status?: string;
      current_status?: string;
      current_step?: string;
      current_progress?: number;
      current_message?: string;
    };
    const state = String(body.status ?? body.current_status ?? '').toLowerCase();
    const status: WholeVideoProviderResult['status'] =
      state === 'completed' ? 'ready' :
      state === 'failed' ? 'failed' :
      state === 'queued' ? 'queued' :
      'processing';
    return {
      providerJobId,
      status,
      ...(status === 'ready' ? { resultUri: `${this.baseUrl}/api/video/${encodeURIComponent(providerJobId)}` } : {}),
      metadata: {
        currentStep: body.current_step,
        currentProgress: body.current_progress,
        currentMessage: body.current_message,
      },
    };
  }

  async download(providerJobId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const response = await fetch(`${this.baseUrl}/api/video/${encodeURIComponent(providerJobId)}`, {
      headers: providerHeaders(this.config.token),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_AGNES_VIDEO_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/tasks/${encodeURIComponent(providerJobId)}/stop`, {
      method: 'POST',
      headers: providerHeaders(this.config.token),
    });
    if (!response.ok && response.status !== 404) throw new Error(`DIRECTOR_AGNES_VIDEO_CANCEL_FAILED:${response.status}`);
  }
}

export function createConfiguredWholeVideoProviders(): WholeVideoProductionProvider[] {
  const providers: WholeVideoProductionProvider[] = [];
  const comfyReferenceWorkflow = parseReferenceComfyWorkflow();
  if (process.env.DIRECTOR_COMFYUI_URL && comfyReferenceWorkflow) {
    providers.push(new ComfyUIReferenceVideoProductionProvider({
      baseUrl: process.env.DIRECTOR_COMFYUI_URL,
      token: process.env.DIRECTOR_COMFYUI_API_KEY,
      workflow: comfyReferenceWorkflow,
    }));
  }
  if (process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_URL) {
    providers.push(new ReferenceCharacterVideoProductionProvider({
      baseUrl: process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_URL,
      token: process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_TOKEN,
    }));
  }
  if (process.env.DIRECTOR_PRODUCT_VIDEO_PROVIDER_URL) {
    providers.push(new ReferenceProductVideoProductionProvider({
      baseUrl: process.env.DIRECTOR_PRODUCT_VIDEO_PROVIDER_URL,
      token: process.env.DIRECTOR_PRODUCT_VIDEO_PROVIDER_TOKEN,
    }));
  }
  if (process.env.DIRECTOR_AGNES_VIDEO_URL) {
    providers.push(new AgnesVideoProductionProvider({
      baseUrl: process.env.DIRECTOR_AGNES_VIDEO_URL,
      token: process.env.DIRECTOR_AGNES_VIDEO_TOKEN,
    }));
  }
  if (process.env.DIRECTOR_SHORT_VIDEO_MAKER_URL) {
    providers.push(new ShortVideoMakerProductionProvider({
      baseUrl: process.env.DIRECTOR_SHORT_VIDEO_MAKER_URL,
      token: process.env.DIRECTOR_SHORT_VIDEO_MAKER_TOKEN,
    }));
  }
  return providers;
}

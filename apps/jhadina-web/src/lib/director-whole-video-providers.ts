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


export class ReferenceCharacterVideoProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor = {
    id: process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_ID ?? 'reference-video-local',
    name: process.env.DIRECTOR_REFERENCE_VIDEO_PROVIDER_NAME ?? 'Reference Character Video',
    costClass: referenceProviderCostClass(),
    supportedModes: ['standard', 'short', 'long-form'],
    health: 'unknown',
    supportsCharacterReference: true,
    requiresCharacterReference: true,
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

type HiggsfieldApiStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw' | 'canceled';
type HiggsfieldApiResponse = {
  status?: HiggsfieldApiStatus;
  request_id?: string;
  status_url?: string;
  cancel_url?: string;
  video?: { url?: string };
  error?: string;
};

function mapHiggsfieldStatus(status: HiggsfieldApiStatus | undefined): WholeVideoProviderResult['status'] {
  if (status === 'completed') return 'ready';
  if (status === 'failed' || status === 'nsfw' || status === 'canceled') return 'failed';
  if (status === 'in_progress') return 'processing';
  return 'queued';
}

export class HiggsfieldReferenceVideoProductionProvider implements WholeVideoProductionProvider {
  readonly descriptor: WholeVideoProviderDescriptor = {
    id: process.env.DIRECTOR_HIGGSFIELD_PROVIDER_ID ?? 'higgsfield-seedance-2-reference',
    name: process.env.DIRECTOR_HIGGSFIELD_PROVIDER_NAME ?? 'Higgsfield Seedance 2.0 Reference',
    costClass: 'paid',
    supportedModes: ['standard', 'short', 'faceless'],
    health: 'unknown',
    supportsCharacterReference: true,
    supportsProductReference: true,
  };

  private readonly baseUrl = 'https://api.higgsfield.ai';
  private readonly credentials: string;
  private readonly resolution: '480p' | '720p' | '1080p' | '4k';

  constructor(input: { keyId: string; keySecret: string; resolution?: '480p' | '720p' | '1080p' | '4k' }) {
    if (!input.keyId.trim() || !input.keySecret.trim()) throw new Error('DIRECTOR_HIGGSFIELD_CREDENTIALS_REQUIRED');
    this.credentials = `${input.keyId.trim()}:${input.keySecret.trim()}`;
    this.resolution = input.resolution ?? '720p';
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Key ${this.credentials}`,
      'content-type': 'application/json',
    };
  }

  async submit(brief: WholeVideoProductionBrief): Promise<WholeVideoProviderResult> {
    const target = Math.ceil(brief.intent.targetDurationSeconds ?? 5);
    if (target > 15) throw new Error('DIRECTOR_HIGGSFIELD_WHOLE_VIDEO_DURATION_EXCEEDS_CLIP_LIMIT');
    const duration = Math.max(4, Math.min(15, target));

    const imageUrls = [
      ...(brief.character?.referenceUris ?? []),
      ...(brief.product?.referenceUris ?? []),
    ].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index).slice(0, 9);

    const endpoint = imageUrls.length
      ? '/bytedance/seedance-2.0/reference-to-video'
      : '/bytedance/seedance-2.0/text-to-video';

    const body: Record<string, unknown> = {
      prompt: brief.prompt,
      duration,
      resolution: this.resolution,
      aspect_ratio: brief.intent.aspectRatio,
      generate_audio: brief.intent.narration || brief.intent.foley,
    };
    if (imageUrls.length) body.image_urls = imageUrls;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const raw = await response.json().catch(() => ({})) as HiggsfieldApiResponse;
    if (!response.ok) {
      throw new Error(`DIRECTOR_HIGGSFIELD_SUBMIT_FAILED:${response.status}:${raw.error ?? 'unknown'}`);
    }
    if (!raw.request_id) throw new Error('DIRECTOR_HIGGSFIELD_REQUEST_ID_MISSING');

    return {
      providerJobId: raw.request_id,
      status: mapHiggsfieldStatus(raw.status),
      ...(raw.video?.url ? { resultUri: raw.video.url } : {}),
      ...(raw.error ? { error: raw.error } : {}),
      metadata: {
        endpoint,
        statusUrl: raw.status_url,
        cancelUrl: raw.cancel_url,
        referenceCount: imageUrls.length,
        modelId: imageUrls.length
          ? 'bytedance/seedance-2.0/reference-to-video'
          : 'bytedance/seedance-2.0/text-to-video',
      },
    };
  }

  async status(providerJobId: string): Promise<WholeVideoProviderResult> {
    const response = await fetch(`${this.baseUrl}/requests/${encodeURIComponent(providerJobId)}/status`, {
      headers: this.headers(),
      cache: 'no-store',
    });
    const raw = await response.json().catch(() => ({})) as HiggsfieldApiResponse;
    if (!response.ok) {
      throw new Error(`DIRECTOR_HIGGSFIELD_STATUS_FAILED:${response.status}:${raw.error ?? 'unknown'}`);
    }
    return {
      providerJobId,
      status: mapHiggsfieldStatus(raw.status),
      ...(raw.video?.url ? { resultUri: raw.video.url } : {}),
      ...(raw.error ? { error: raw.error } : {}),
      metadata: { statusUrl: raw.status_url, cancelUrl: raw.cancel_url },
    };
  }

  async download(providerJobId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const state = await this.status(providerJobId);
    if (state.status !== 'ready' || !state.resultUri) {
      throw new Error('DIRECTOR_HIGGSFIELD_OUTPUT_NOT_READY');
    }
    const response = await fetch(state.resultUri, { cache: 'no-store' });
    if (!response.ok) throw new Error(`DIRECTOR_HIGGSFIELD_DOWNLOAD_FAILED:${response.status}`);
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') ?? 'video/mp4',
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/requests/${encodeURIComponent(providerJobId)}/cancel`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!response.ok && response.status !== 404 && response.status !== 409) {
      throw new Error(`DIRECTOR_HIGGSFIELD_CANCEL_FAILED:${response.status}`);
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
  if (process.env.DIRECTOR_HIGGSFIELD_API_KEY_ID && process.env.DIRECTOR_HIGGSFIELD_API_KEY_SECRET) {
    const configuredResolution = process.env.DIRECTOR_HIGGSFIELD_RESOLUTION;
    const resolution = configuredResolution === '480p' || configuredResolution === '1080p' || configuredResolution === '4k'
      ? configuredResolution
      : '720p';
    providers.push(new HiggsfieldReferenceVideoProductionProvider({
      keyId: process.env.DIRECTOR_HIGGSFIELD_API_KEY_ID,
      keySecret: process.env.DIRECTOR_HIGGSFIELD_API_KEY_SECRET,
      resolution,
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

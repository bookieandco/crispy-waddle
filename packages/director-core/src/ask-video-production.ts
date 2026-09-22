export type AskVideoMode = 'standard' | 'short' | 'faceless' | 'long-form';

export interface AskVideoCreationIntent {
  mode: AskVideoMode;
  prompt: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  targetDurationSeconds?: number;
  narration: boolean;
  captions: boolean;
  foley: boolean;
  commercialSafeOnly: true;
  providerPolicy: {
    localFreeFirst: true;
    allowPaidWithoutApproval: false;
  };
}

const VIDEO_VERB = /\b(make|create|generate|produce|build|render|turn)\b/i;
const VIDEO_NOUN = /\b(video|movie|film|short|reel|tiktok|youtube\s+short|youtube\s+video)\b/i;

export function detectAskVideoCreationIntent(text: string): AskVideoCreationIntent | undefined {
  const prompt = text.trim();
  if (!prompt || !VIDEO_VERB.test(prompt) || !VIDEO_NOUN.test(prompt)) return undefined;

  const duration = parseDurationSeconds(prompt);
  const mode: AskVideoMode =
    /\bfaceless\b/i.test(prompt) ? 'faceless' :
    /\b(short|reel|tiktok|youtube\s+short)\b/i.test(prompt) ? 'short' :
    /\b(long[- ]form|movie|film|documentary|feature)\b/i.test(prompt) || (duration !== undefined && duration > 120)
      ? 'long-form'
      : 'standard';

  const explicitAspect = prompt.match(/\b(9\s*:\s*16|16\s*:\s*9|1\s*:\s*1)\b/);
  const aspectRatio = explicitAspect
    ? explicitAspect[1].replace(/\s/g, '') as AskVideoCreationIntent['aspectRatio']
    : mode === 'short' || mode === 'faceless' ? '9:16' : '16:9';

  return Object.freeze({
    mode,
    prompt,
    aspectRatio,
    ...(duration !== undefined ? { targetDurationSeconds: duration } : {}),
    narration: !/\b(no narration|no voice|silent video)\b/i.test(prompt),
    captions: !/\b(no captions|no subtitles)\b/i.test(prompt),
    foley: !/\b(no foley|no sound effects|no sfx)\b/i.test(prompt),
    commercialSafeOnly: true,
    providerPolicy: Object.freeze({
      localFreeFirst: true,
      allowPaidWithoutApproval: false,
    }),
  });
}

function parseDurationSeconds(text: string): number | undefined {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m)\b/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const unit = match[2].toLowerCase();
  const seconds = unit.startsWith('m') ? value * 60 : value;
  return Math.min(3600, Math.max(1, seconds));
}

export type DirectorVideoJobStatus =
  | 'queued'
  | 'submitted'
  | 'generating'
  | 'ingesting'
  | 'preview_ready'
  | 'blocked'
  | 'failed'
  | 'cancelled';

export interface DirectorVideoJob {
  id: string;
  clientRequestId: string;
  userId: string;
  projectId: string;
  productionRunId: string;
  source: 'ask-jhadina';
  prompt: string;
  mode: AskVideoMode;
  aspectRatio: AskVideoCreationIntent['aspectRatio'];
  targetDurationSeconds?: number;
  status: DirectorVideoJobStatus;
  currentPhase: string;
  providerId?: string;
  providerJobId?: string;
  outputAssetIds: readonly string[];
  previewAssetId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

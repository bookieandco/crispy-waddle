import { toFile } from 'openai';

export interface DogVisionPrediction {
  class: string | null;
  confidence: number | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points_count?: number;
}

export interface DogVisionSummary {
  status: 'ok';
  model_id: string;
  workflow_id: string | null;
  workspace: string | null;
  dog_detected: boolean;
  detection_count: number;
  segmentation_count: number;
  max_confidence: number | null;
  largest_subject_fraction: number | null;
  predictions: DogVisionPrediction[];
  segments: DogVisionPrediction[];
}

export type DogVisionResult =
  | DogVisionSummary
  | { status: 'not_configured' }
  | { status: 'unavailable'; error: string };

function resolveEndpoint(env: Record<string, string | undefined>): string | null {
  const explicit = env.PUPSON_DOG_VISION_URL?.trim();
  if (explicit) return explicit;

  const gateway = env.PUPSON_BACKGROUND_REMOVER_URL?.trim();
  if (!gateway) return null;
  const url = new URL(gateway);
  url.pathname = '/dog-vision';
  url.search = '';
  return url.toString();
}

function resolveToken(env: Record<string, string | undefined>): string | null {
  return (
    env.PUPSON_DOG_VISION_TOKEN?.trim() ||
    env.PUPSON_BACKGROUND_REMOVER_TOKEN?.trim() ||
    null
  );
}

export function dogVisionConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(resolveEndpoint(env) && resolveToken(env));
}

export async function analyzeDogReference(input: {
  bytes: Buffer;
  mimeType: string;
  runWorkflow?: boolean;
  env?: Record<string, string | undefined>;
}): Promise<DogVisionResult> {
  const env = input.env ?? process.env;
  const endpoint = resolveEndpoint(env);
  const token = resolveToken(env);
  if (!endpoint || !token) return { status: 'not_configured' };

  const form = new FormData();
  form.append('file', await toFile(input.bytes, 'pet-reference', { type: input.mimeType }));
  form.append('workflow', input.runWorkflow === false ? '0' : '1');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 180);
      return {
        status: 'unavailable',
        error: `Dog vision failed (${response.status}): ${detail}`,
      };
    }
    const body = (await response.json()) as DogVisionSummary;
    if (body?.status !== 'ok' || typeof body.model_id !== 'string') {
      return { status: 'unavailable', error: 'Dog vision returned an invalid response.' };
    }
    return body;
  } catch (error) {
    return {
      status: 'unavailable',
      error: error instanceof Error ? error.message.slice(0, 180) : 'Dog vision request failed.',
    };
  }
}

export function dogReferenceQuality(result: DogVisionResult): {
  score: number;
  findings: string[];
} {
  if (result.status !== 'ok' || !result.dog_detected) {
    return { score: 100, findings: [] };
  }

  let score = 100;
  const findings: string[] = [];

  if (result.detection_count > 1) {
    score -= 10;
    findings.push('Multiple dogs detected; Pet Identity may be ambiguous.');
  }

  if (result.max_confidence !== null && result.max_confidence < 0.55) {
    score -= 5;
    findings.push('Dog detection confidence is low; a clearer reference may improve identity fidelity.');
  }

  if (
    result.largest_subject_fraction !== null &&
    result.largest_subject_fraction < 0.08
  ) {
    score -= 15;
    findings.push('Dog occupies a small part of the photo; use a closer reference when possible.');
  }

  return { score: Math.max(0, score), findings };
}

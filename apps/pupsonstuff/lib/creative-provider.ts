import { AI_PROMPT_TEMPLATE, generatePetPortrait } from '@/lib/ai';
import { imageToAsciiArt } from '@/lib/ascii';
import { generateWithMuapi } from '@/lib/muapi';
import { generateWithLocalImageWorker } from '@/lib/local-image-worker';
import type { ArtStyle } from '@/types/boutique';

export interface PupsonCreativeReference {
  bytes: Buffer;
  mimeType: string;
  assetId: string;
}

export interface PupsonCreativeIdentity {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
}

export interface PupsonCreativeGenerationRequest {
  style: ArtStyle;
  styleLabel: string;
  productPrompt: string;
  userPrompt?: string;
  identity: PupsonCreativeIdentity;
  references: readonly PupsonCreativeReference[];
}

export interface PupsonCreativeGenerationResult {
  provider: 'local' | 'openai' | 'muapi' | 'unsloth';
  model: string;
  imageBase64: string;
}

export interface PupsonCreativeProvider {
  readonly id: PupsonCreativeGenerationResult['provider'];
  readonly submissionGuarantee: 'deterministic-local' | 'non-idempotent-remote';
  supports(style: ArtStyle): boolean;
  generate(request: PupsonCreativeGenerationRequest): Promise<PupsonCreativeGenerationResult>;
}

class AsciiCreativeProvider implements PupsonCreativeProvider {
  readonly id = 'local' as const;
  readonly submissionGuarantee = 'deterministic-local' as const;

  supports(style: ArtStyle) {
    return style === 'ascii-art';
  }

  async generate(request: PupsonCreativeGenerationRequest): Promise<PupsonCreativeGenerationResult> {
    return {
      provider: this.id,
      model: 'ascii-v1',
      imageBase64: (await imageToAsciiArt(request.identity.bytes)).toString('base64'),
    };
  }
}

class MuapiCreativeProvider implements PupsonCreativeProvider {
  readonly id = 'muapi' as const;
  readonly submissionGuarantee = 'non-idempotent-remote' as const;

  supports(style: ArtStyle) {
    return style === 'studio-ghibli' || style === 'flux-dreamscape';
  }

  async generate(request: PupsonCreativeGenerationRequest): Promise<PupsonCreativeGenerationResult> {
    const model =
      request.style === 'studio-ghibli' ? 'ai-ghibli-style' : 'flux-kontext-pro-i2i';
    const result = await generateWithMuapi({
      imageBuffer: request.identity.bytes,
      imageFilename: request.identity.fileName,
      imageMimeType: request.identity.mimeType,
      model,
      prompt:
        request.style === 'flux-dreamscape'
          ? [
              AI_PROMPT_TEMPLATE,
              request.productPrompt,
              request.userPrompt ? `Shopper direction: ${request.userPrompt}` : undefined,
              `Art style: ${request.styleLabel}.`,
            ]
              .filter(Boolean)
              .join('\n')
          : undefined,
    });
    if (!result.success) throw new Error(result.error);
    return { provider: this.id, model, imageBase64: result.imageBase64 };
  }
}

class UnslothCreativeProvider implements PupsonCreativeProvider {
  readonly id = 'unsloth' as const;
  // An ambiguous timeout cannot be retried without an idempotent worker protocol.
  readonly submissionGuarantee = 'non-idempotent-remote' as const;

  supports(style: ArtStyle) {
    return process.env.PUPSON_OPENAI_STYLE_BACKEND === 'local_worker' &&
      style !== 'ascii-art' && style !== 'studio-ghibli' && style !== 'flux-dreamscape';
  }

  async generate(request: PupsonCreativeGenerationRequest): Promise<PupsonCreativeGenerationResult> {
    const result = await generateWithLocalImageWorker({
      prompt: [
        AI_PROMPT_TEMPLATE,
        request.productPrompt,
        request.userPrompt ? `Shopper direction: ${request.userPrompt}` : undefined,
        `Art style: ${request.styleLabel}.`,
      ].filter(Boolean).join('\\n'),
      references: request.references.map((reference) => ({
        bytes: reference.bytes,
        mimeType: reference.mimeType,
      })),
    });
    return { provider: this.id, model: result.model, imageBase64: result.imageBase64 };
  }
}

class OpenAICreativeProvider implements PupsonCreativeProvider {
  readonly id = 'openai' as const;
  readonly submissionGuarantee = 'non-idempotent-remote' as const;

  supports(style: ArtStyle) {
    return style !== 'ascii-art' && style !== 'studio-ghibli' && style !== 'flux-dreamscape';
  }

  async generate(request: PupsonCreativeGenerationRequest): Promise<PupsonCreativeGenerationResult> {
    const primary = request.references[0];
    if (!primary) throw new Error('Pet Identity has no usable reference image.');
    const result = await generatePetPortrait({
      imageBuffer: primary.bytes,
      imageFilename: 'pet-primary.png',
      imageMimeType: primary.mimeType,
      referenceImages: request.references.slice(1).map((reference, index) => ({
        imageBuffer: reference.bytes,
        imageFilename: `pet-reference-${index + 2}.png`,
        imageMimeType: reference.mimeType,
      })),
      basePrompt: AI_PROMPT_TEMPLATE,
      productPrompt: request.productPrompt,
      userPrompt: request.userPrompt,
      artStyleLabel: request.styleLabel,
    });
    if (!result.success) throw new Error(result.error);
    return {
      provider: this.id,
      model: result.model,
      imageBase64: result.imageBase64,
    };
  }
}

const PROVIDERS: readonly PupsonCreativeProvider[] = [
  new AsciiCreativeProvider(),
  new MuapiCreativeProvider(),
  new UnslothCreativeProvider(),
  new OpenAICreativeProvider(),
];

export function resolvePupsonCreativeProvider(style: ArtStyle): PupsonCreativeProvider {
  const provider = PROVIDERS.find((candidate) => candidate.supports(style));
  if (!provider) throw new Error(`No creative provider supports art style: ${style}`);
  return provider;
}

export async function executePupsonCreativeGeneration(
  request: PupsonCreativeGenerationRequest
): Promise<PupsonCreativeGenerationResult> {
  return resolvePupsonCreativeProvider(request.style).generate(request);
}

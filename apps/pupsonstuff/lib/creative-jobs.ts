import { randomUUID } from 'node:crypto';
import { hotspots } from '@/data/hotspots';
import { ArtStyle, artStyles } from '@/types/boutique';
import type { ArtworkTransform, BackgroundMode } from '@/types/creative';
import { AI_PROMPT_TEMPLATE, generatePetPortrait } from '@/lib/ai';
import { imageToAsciiArt } from '@/lib/ascii';
import { generateWithMuapi } from '@/lib/muapi';
import { removeBackground } from '@/lib/background-removal';
import { buildPetIdentitySheet } from '@/lib/pet-identity-sheet';
import { buildPrintMaster } from '@/lib/print-master';
import {
  createSignedAssetUrl,
  ownerTokenHash,
  rest,
  sha256,
  uploadPrivateAsset,
} from '@/lib/platform';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_PHOTOS = 3;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BACKGROUND_MODES = new Set<BackgroundMode>(['auto', 'transparent', 'keep', 'generate']);

interface RowId {
  id: string;
}

interface JobRow extends RowId {
  owner_token_hash: string;
  pet_identity_id: string;
  product_id: string;
  art_style: ArtStyle;
  status: string;
  attempt_count: number;
  max_attempts: number;
  user_prompt: string | null;
  background_mode: BackgroundMode;
}

interface SourceAsset {
  bucket_id: string;
  object_path: string;
  mime_type: string;
  id: string;
}

interface SourceLink {
  role: 'primary' | 'reference' | 'profile' | 'detail';
  created_at: string;
  media_asset: SourceAsset | null;
}

export interface CreativeJobSnapshot {
  id: string;
  status: string;
  error?: string | null;
  outputId?: string;
  previewUrl?: string;
  approved?: boolean;
}

function assertStyle(value: string): asserts value is ArtStyle {
  if (!artStyles.some((style) => style.id === value)) throw new Error('Unknown art style.');
}

function assertBackgroundMode(value: string): asserts value is BackgroundMode {
  if (!BACKGROUND_MODES.has(value as BackgroundMode)) throw new Error('Unknown background mode.');
}

function providerFor(style: ArtStyle): string {
  return style === 'ascii-art'
    ? 'local'
    : style === 'studio-ghibli' || style === 'flux-dreamscape'
      ? 'muapi'
      : 'openai';
}

async function inspectUpload(bytes: Buffer, mimeType: string) {
  if (!ACCEPTED.has(mimeType)) throw new Error('Upload must be JPEG, PNG, or WebP.');
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES)
    throw new Error('Upload must be between 1 byte and 10MB.');
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < 512 || height < 512) throw new Error('Pet photos must be at least 512×512 pixels.');
  return { width, height };
}

export async function createCreativeJob(input: {
  ownerToken: string;
  petName: string;
  productId: string;
  artStyle: string;
  files: Array<{ fileName: string; mimeType: string; bytes: Buffer }>;
  prompt?: string;
  backgroundMode?: string;
  consent: boolean;
  idempotencyKey: string;
}): Promise<{ jobId: string }> {
  if (!input.consent) throw new Error('Image processing consent is required.');
  assertStyle(input.artStyle);
  const backgroundMode = input.backgroundMode || 'auto';
  assertBackgroundMode(backgroundMode);
  const prompt = input.prompt?.trim().slice(0, 2000) || null;
  if (!hotspots.some((hotspot) => hotspot.id === input.productId && hotspot.fulfillment)) {
    throw new Error('Unknown or unavailable product.');
  }
  if (input.files.length < 1 || input.files.length > MAX_REFERENCE_PHOTOS) {
    throw new Error('Add one pet photo; you can add up to three reference photos.');
  }

  const ownerHash = ownerTokenHash(input.ownerToken);
  const windowStart = encodeURIComponent(new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const recent = await rest<RowId[]>(
    `pupson_usage_events?select=id&owner_token_hash=eq.${ownerHash}&action=eq.creative_job&created_at=gte.${windowStart}&limit=6`
  );
  if (recent.length >= 6) throw new Error('Creative limit reached. Please try again in an hour.');
  await rest('pupson_usage_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ owner_token_hash: ownerHash, action: 'creative_job' }),
  });

  const preparedAssets = [];
  for (const [index, file] of input.files.entries()) {
    const dimensions = await inspectUpload(file.bytes, file.mimeType);
    const id = randomUUID();
    const extension = file.mimeType === 'image/jpeg' ? 'jpg' : file.mimeType.split('/')[1];
    const objectPath = `${ownerHash}/${id}.${extension}`;
    await uploadPrivateAsset({
      bucket: 'pupson-originals',
      path: objectPath,
      bytes: file.bytes,
      contentType: file.mimeType,
    });
    preparedAssets.push({
      id,
      owner_token_hash: ownerHash,
      kind: 'original',
      bucket_id: 'pupson-originals',
      object_path: objectPath,
      mime_type: file.mimeType,
      byte_size: file.bytes.length,
      width: dimensions.width,
      height: dimensions.height,
      sha256: sha256(file.bytes),
      provenance: { originalFileName: file.fileName, referenceIndex: index },
    });
  }

  const assets = await rest<RowId[]>('pupson_media_assets', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(preparedAssets),
  });
  const primaryAsset = assets[0];
  if (!primaryAsset) throw new Error('Original asset was not persisted.');

  const pets = await rest<RowId[]>('pupson_pet_identities', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_token_hash: ownerHash,
      name: input.petName.trim().slice(0, 80) || 'My Pet',
      status: 'ready',
      primary_asset_id: primaryAsset.id,
      consent_at: new Date().toISOString(),
    }),
  });
  const pet = pets[0];
  if (!pet) throw new Error('Pet identity was not persisted.');
  await rest('pupson_pet_identity_assets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(
      assets.map((item, index) => ({
        pet_identity_id: pet.id,
        media_asset_id: item.id,
        role: index === 0 ? 'primary' : 'reference',
        quality_score: 100,
        quality_findings: [],
      }))
    ),
  });

  const jobs = await rest<RowId[]>(
    'pupson_creative_jobs?on_conflict=owner_token_hash,idempotency_key',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        owner_token_hash: ownerHash,
        pet_identity_id: pet.id,
        product_id: input.productId,
        art_style: input.artStyle,
        status: 'queued',
        idempotency_key: input.idempotencyKey,
        user_prompt: prompt,
        background_mode: backgroundMode,
      }),
    }
  );
  if (!jobs[0]) throw new Error('Creative job was not persisted.');
  return { jobId: jobs[0].id };
}

async function generate(
  job: JobRow,
  identity: { bytes: Buffer; mimeType: string; fileName: string },
  references: Array<{ bytes: Buffer; mimeType: string; assetId: string }>
) {
  const hotspot = hotspots.find((item) => item.id === job.product_id);
  if (!hotspot) throw new Error('Creative job product is no longer available.');
  const label = artStyles.find((style) => style.id === job.art_style)?.label ?? job.art_style;
  if (job.art_style === 'ascii-art') {
    return {
      provider: 'local',
      model: 'ascii-v1',
      imageBase64: (await imageToAsciiArt(identity.bytes)).toString('base64'),
    };
  }
  if (job.art_style === 'studio-ghibli' || job.art_style === 'flux-dreamscape') {
    const model = job.art_style === 'studio-ghibli' ? 'ai-ghibli-style' : 'flux-kontext-pro-i2i';
    const result = await generateWithMuapi({
      imageBuffer: identity.bytes,
      imageFilename: identity.fileName,
      imageMimeType: identity.mimeType,
      model,
      prompt:
        job.art_style === 'flux-dreamscape'
          ? [
              AI_PROMPT_TEMPLATE,
              hotspot.aiTemplate,
              job.user_prompt ? `Shopper direction: ${job.user_prompt}` : undefined,
              `Art style: ${label}.`,
            ]
              .filter(Boolean)
              .join('\n')
          : undefined,
    });
    if (!result.success) throw new Error(result.error);
    return { provider: 'muapi', model, imageBase64: result.imageBase64 };
  }

  const primary = references[0];
  if (!primary) throw new Error('Pet Identity has no usable reference image.');
  const result = await generatePetPortrait({
    imageBuffer: primary.bytes,
    imageFilename: 'pet-primary.png',
    imageMimeType: primary.mimeType,
    referenceImages: references.slice(1).map((reference, index) => ({
      imageBuffer: reference.bytes,
      imageFilename: `pet-reference-${index + 2}.png`,
      imageMimeType: reference.mimeType,
    })),
    basePrompt: AI_PROMPT_TEMPLATE,
    productPrompt: hotspot.aiTemplate,
    userPrompt: job.user_prompt ?? undefined,
    artStyleLabel: label,
  });
  if (!result.success) throw new Error(result.error);
  return { provider: 'openai', model: result.model, imageBase64: result.imageBase64 };
}

async function fetchPetReferences(job: JobRow) {
  const links = await rest<SourceLink[]>(
    `pupson_pet_identity_assets?select=role,created_at,media_asset:pupson_media_assets!inner(id,bucket_id,object_path,mime_type)&pet_identity_id=eq.${job.pet_identity_id}&order=created_at.asc&limit=${MAX_REFERENCE_PHOTOS}`
  );
  const usable = links
    .filter((link): link is SourceLink & { media_asset: SourceAsset } => Boolean(link.media_asset))
    .sort((a, b) => (a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0));
  if (!usable.length) throw new Error('Creative job source assets are missing.');

  const processed = [];
  for (const link of usable) {
    const source = link.media_asset;
    const sourceUrl = await createSignedAssetUrl(source.bucket_id, source.object_path, 120);
    const sourceResponse = await fetch(sourceUrl);
    if (!sourceResponse.ok) throw new Error('Could not load creative job source asset.');
    const original = Buffer.from(await sourceResponse.arrayBuffer());
    const removal = await removeBackground(original, source.mime_type, job.background_mode);
    processed.push({
      bytes: removal.bytes,
      mimeType: removal.mimeType,
      role: link.role === 'primary' ? ('primary' as const) : ('reference' as const),
      assetId: source.id,
      removalProvider: removal.provider,
      removalModel: removal.model,
    });
  }
  return processed;
}

async function claimCreativeJob(job: JobRow): Promise<JobRow | null> {
  if (job.status !== 'queued' || job.attempt_count >= job.max_attempts) return null;
  const attempt = job.attempt_count + 1;
  const rows = await rest<JobRow[]>(`pupson_creative_jobs?id=eq.${job.id}&status=eq.queued`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'running',
      attempt_count: attempt,
      started_at: new Date().toISOString(),
      completed_at: null,
      last_error: null,
    }),
  });
  return rows[0] ?? null;
}

async function executeClaimedCreativeJob(job: JobRow): Promise<void> {
  const ownerHash = job.owner_token_hash;
  const attempt = job.attempt_count;
  const attemptProvider = providerFor(job.art_style);
  await rest('pupson_creative_job_attempts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      job_id: job.id,
      attempt,
      provider: attemptProvider,
      status: 'running',
    }),
  });

  try {
    const references = await fetchPetReferences(job);
    const identity = await buildPetIdentitySheet(
      references.map((reference) => ({
        bytes: reference.bytes,
        mimeType: reference.mimeType,
        role: reference.role,
        assetId: reference.assetId,
      }))
    );
    const generated = await generate(job, identity, references);
    const sharp = (await import('sharp')).default;
    const providerBytes = Buffer.from(generated.imageBase64, 'base64');
    const normalizedProviderBytes = await sharp(providerBytes, { failOn: 'error' }).png().toBuffer();
    // The shopper-facing default is a genuinely background-free design, not
    // merely a cleaned reference image. Generators are allowed to synthesize
    // pixels outside the subject, so enforce the chosen background intent on
    // the generated output as a second, explicit preprocessing stage.
    const outputRemoval = await removeBackground(
      normalizedProviderBytes,
      'image/png',
      job.background_mode
    );
    const generatedBytes = await sharp(outputRemoval.bytes, { failOn: 'error' }).png().toBuffer();
    const generatedMeta = await sharp(generatedBytes).metadata();
    const generatedId = randomUUID();
    const generatedPath = `${ownerHash}/${job.id}/${generatedId}.png`;
    await uploadPrivateAsset({
      bucket: 'pupson-creative',
      path: generatedPath,
      bytes: generatedBytes,
      contentType: 'image/png',
    });
    await rest('pupson_media_assets', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: generatedId,
        owner_token_hash: ownerHash,
        kind: 'generated',
        bucket_id: 'pupson-creative',
        object_path: generatedPath,
        mime_type: 'image/png',
        byte_size: generatedBytes.length,
        width: generatedMeta.width,
        height: generatedMeta.height,
        sha256: sha256(generatedBytes),
        source_asset_id: identity.sourceAssetIds[0],
        provenance: {
          provider: generated.provider,
          model: generated.model,
          jobId: job.id,
          sourceAssetIds: identity.sourceAssetIds,
          referenceCount: identity.sourceAssetIds.length,
          backgroundMode: job.background_mode,
          backgroundRemoval: references.map((reference) => ({
            assetId: reference.assetId,
            provider: reference.removalProvider,
            model: reference.removalModel ?? null,
          })),
          outputBackgroundRemoval: {
            provider: outputRemoval.provider,
            model: outputRemoval.model ?? null,
          },
          userPromptSha256: job.user_prompt ? sha256(Buffer.from(job.user_prompt)) : null,
        },
      }),
    });
    await rest('pupson_creative_outputs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        job_id: job.id,
        generated_asset_id: generatedId,
        print_asset_id: null,
        quality_gate: {
          status: 'pending',
          productionReady: false,
          reason: 'print_master_not_composed',
          referenceCount: identity.sourceAssetIds.length,
        },
      }),
    });
    await rest(`pupson_creative_job_attempts?job_id=eq.${job.id}&attempt=eq.${attempt}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'succeeded',
        model: generated.model,
        completed_at: new Date().toISOString(),
      }),
    });
    await rest(`pupson_creative_jobs?id=eq.${job.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'succeeded',
        provider: generated.provider,
        model: generated.model,
        completed_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Creative job failed.';
    await rest(`pupson_creative_job_attempts?job_id=eq.${job.id}&attempt=eq.${attempt}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'failed',
        error: message,
        completed_at: new Date().toISOString(),
      }),
    });
    // Provider image-generation POSTs are not assumed idempotent. A failed
    // attempt is terminal and visible to the shopper rather than silently
    // resubmitting and risking duplicate provider charges.
    await rest(`pupson_creative_jobs?id=eq.${job.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'failed',
        last_error: message,
        completed_at: new Date().toISOString(),
      }),
    });
    throw error;
  }
}

async function claimAndRun(job: JobRow): Promise<boolean> {
  const claimed = await claimCreativeJob(job);
  if (!claimed) return false;
  await executeClaimedCreativeJob(claimed);
  return true;
}

export async function runCreativeJob(jobId: string, ownerToken: string): Promise<void> {
  const ownerHash = ownerTokenHash(ownerToken);
  const jobs = await rest<JobRow[]>(
    `pupson_creative_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&owner_token_hash=eq.${ownerHash}&limit=1`
  );
  const job = jobs[0];
  if (!job || job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') return;
  await claimAndRun(job);
}

export async function failStaleCreativeJobs(
  maxAgeMs = 10 * 60 * 1000,
  limit = 10
): Promise<{ checked: number; failed: number }> {
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  const cutoff = encodeURIComponent(new Date(Date.now() - maxAgeMs).toISOString());
  const jobs = await rest<JobRow[]>(
    `pupson_creative_jobs?select=*&status=eq.running&started_at=lt.${cutoff}&order=started_at.asc&limit=${safeLimit}`
  );
  let failed = 0;
  for (const job of jobs) {
    const message =
      'Creative worker lease expired. The job was not automatically resubmitted because provider submission state is unknown; regenerate to avoid a duplicate provider charge.';
    const rows = await rest<JobRow[]>(`pupson_creative_jobs?id=eq.${job.id}&status=eq.running`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'failed',
        last_error: message,
        completed_at: new Date().toISOString(),
      }),
    });
    if (!rows[0]) continue;
    failed += 1;
    await rest(
      `pupson_creative_job_attempts?job_id=eq.${job.id}&attempt=eq.${job.attempt_count}&status=eq.running`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'failed',
          error: message,
          completed_at: new Date().toISOString(),
        }),
      }
    );
  }
  return { checked: jobs.length, failed };
}

export async function runQueuedCreativeJobs(limit = 2): Promise<{ checked: number; claimed: number; failed: number }> {
  const safeLimit = Math.min(10, Math.max(1, Math.trunc(limit)));
  const jobs = await rest<JobRow[]>(
    `pupson_creative_jobs?select=*&status=eq.queued&order=created_at.asc&limit=${safeLimit}`
  );
  let claimed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      if (await claimAndRun(job)) claimed += 1;
    } catch {
      failed += 1;
    }
  }
  return { checked: jobs.length, claimed, failed };
}

export async function getCreativeJob(
  jobId: string,
  ownerToken: string
): Promise<CreativeJobSnapshot | null> {
  const ownerHash = ownerTokenHash(ownerToken);
  const jobs = await rest<Array<JobRow & { last_error?: string }>>(
    `pupson_creative_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&owner_token_hash=eq.${ownerHash}&limit=1`
  );
  const job = jobs[0];
  if (!job) return null;
  const outputs = await rest<
    Array<{
      id: string;
      approval_status: string;
      generated_asset: { bucket_id: string; object_path: string } | null;
    }>
  >(
    `pupson_creative_outputs?select=id,approval_status,generated_asset:pupson_media_assets!generated_asset_id(bucket_id,object_path)&job_id=eq.${job.id}&order=version.desc&limit=1`
  );
  const output = outputs[0];
  return {
    id: job.id,
    status: job.status,
    error: job.last_error,
    outputId: output?.id,
    approved: output?.approval_status === 'approved',
    previewUrl: output?.generated_asset
      ? await createSignedAssetUrl(output.generated_asset.bucket_id, output.generated_asset.object_path)
      : undefined,
  };
}

export async function approveCreativeOutput(
  outputId: string,
  ownerToken: string,
  input: { variantId: string; transform?: Partial<ArtworkTransform> }
): Promise<{ printAssetId: string; qualityScore: number }> {
  const ownerHash = ownerTokenHash(ownerToken);
  const rows = await rest<
    Array<{
      id: string;
      generated_asset: { bucket_id: string; object_path: string; id: string } | null;
      job: {
        owner_token_hash: string;
        product_id: string;
        background_mode: BackgroundMode;
      } | null;
    }>
  >(
    `pupson_creative_outputs?select=id,generated_asset:pupson_media_assets!generated_asset_id(id,bucket_id,object_path),job:pupson_creative_jobs!inner(owner_token_hash,product_id,background_mode)&id=eq.${encodeURIComponent(outputId)}&job.owner_token_hash=eq.${ownerHash}&limit=1`
  );
  const output = rows[0];
  if (!output?.job || !output.generated_asset) throw new Error('Creative output was not found.');
  const hotspot = hotspots.find((item) => item.id === output.job?.product_id);
  if (!hotspot?.fulfillment) throw new Error('Creative output product is no longer available.');
  if (!hotspot.fulfillment.variants.some((variant) => variant.variantId === input.variantId)) {
    throw new Error('Unknown product variant for this creative output.');
  }

  const generatedUrl = await createSignedAssetUrl(
    output.generated_asset.bucket_id,
    output.generated_asset.object_path,
    120
  );
  const generatedResponse = await fetch(generatedUrl);
  if (!generatedResponse.ok) throw new Error('Could not load generated artwork for print composition.');
  const generatedBytes = Buffer.from(await generatedResponse.arrayBuffer());
  const master = await buildPrintMaster({
    generatedBytes,
    hotspot,
    variantId: input.variantId,
    transform: input.transform,
    backgroundMode: output.job.background_mode,
  });
  if (!master.quality.productionReady || master.quality.score < 90) {
    throw new Error(`Print quality gate failed with score ${master.quality.score}.`);
  }

  const printId = randomUUID();
  const printPath = `${ownerHash}/${output.id}/${printId}.png`;
  await uploadPrivateAsset({
    bucket: 'pupson-print-ready',
    path: printPath,
    bytes: master.bytes,
    contentType: 'image/png',
  });
  await rest('pupson_media_assets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: printId,
      owner_token_hash: ownerHash,
      kind: 'print_ready',
      bucket_id: 'pupson-print-ready',
      object_path: printPath,
      mime_type: 'image/png',
      byte_size: master.bytes.length,
      width: master.width,
      height: master.height,
      sha256: sha256(master.bytes),
      source_asset_id: output.generated_asset.id,
      provenance: {
        creativeOutputId: output.id,
        targetDpi: master.profile.targetDpi,
        printProfile: master.profile,
        transform: master.transform,
        source: master.source,
      },
    }),
  });
  await rest(`pupson_creative_outputs?id=eq.${output.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      print_asset_id: printId,
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      quality_gate: {
        ...master.quality,
        profile: master.profile,
        transform: master.transform,
        source: master.source,
      },
    }),
  });
  return { printAssetId: printId, qualityScore: master.quality.score };
}

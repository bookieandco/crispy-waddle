import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { hotspots } from '@/data/hotspots';
import { ArtStyle, artStyles } from '@/types/boutique';
import { AI_PROMPT_TEMPLATE, generatePetPortrait } from '@/lib/ai';
import { imageToAsciiArt } from '@/lib/ascii';
import { generateWithMuapi } from '@/lib/muapi';
import {
  createSignedAssetUrl,
  ownerTokenHash,
  rest,
  sha256,
  uploadPrivateAsset,
} from '@/lib/platform';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

async function inspectUpload(bytes: Buffer, mimeType: string) {
  if (!ACCEPTED.has(mimeType)) throw new Error('Upload must be JPEG, PNG, or WebP.');
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES)
    throw new Error('Upload must be between 1 byte and 10MB.');
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
  consent: boolean;
  idempotencyKey: string;
}): Promise<{ jobId: string }> {
  if (!input.consent) throw new Error('Image processing consent is required.');
  assertStyle(input.artStyle);
  if (!hotspots.some((hotspot) => hotspot.id === input.productId && hotspot.fulfillment)) {
    throw new Error('Unknown or unavailable product.');
  }
  if (input.files.length < 1 || input.files.length > 5)
    throw new Error('Add between one and five pet photos.');
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
  const asset = assets[0];
  if (!asset) throw new Error('Original asset was not persisted.');

  const pets = await rest<RowId[]>('pupson_pet_identities', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_token_hash: ownerHash,
      name: input.petName.trim().slice(0, 80) || 'My Pet',
      status: 'ready',
      primary_asset_id: asset.id,
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
      }),
    }
  );
  if (!jobs[0]) throw new Error('Creative job was not persisted.');
  return { jobId: jobs[0].id };
}

async function generate(job: JobRow, bytes: Buffer, mimeType: string, fileName: string) {
  const hotspot = hotspots.find((item) => item.id === job.product_id);
  if (!hotspot) throw new Error('Creative job product is no longer available.');
  const label = artStyles.find((style) => style.id === job.art_style)?.label ?? job.art_style;
  if (job.art_style === 'ascii-art') {
    return {
      provider: 'local',
      model: 'ascii-v1',
      imageBase64: (await imageToAsciiArt(bytes)).toString('base64'),
    };
  }
  if (job.art_style === 'studio-ghibli' || job.art_style === 'flux-dreamscape') {
    const model = job.art_style === 'studio-ghibli' ? 'ai-ghibli-style' : 'flux-kontext-pro-i2i';
    const result = await generateWithMuapi({
      imageBuffer: bytes,
      imageFilename: fileName,
      imageMimeType: mimeType,
      model,
      prompt:
        job.art_style === 'flux-dreamscape'
          ? [AI_PROMPT_TEMPLATE, hotspot.aiTemplate, `Art style: ${label}.`]
              .filter(Boolean)
              .join('\n')
          : undefined,
    });
    if (!result.success) throw new Error(result.error);
    return { provider: 'muapi', model, imageBase64: result.imageBase64 };
  }
  const result = await generatePetPortrait({
    imageBuffer: bytes,
    imageFilename: fileName,
    imageMimeType: mimeType,
    basePrompt: AI_PROMPT_TEMPLATE,
    productPrompt: hotspot.aiTemplate,
    artStyleLabel: label,
  });
  if (!result.success) throw new Error(result.error);
  return { provider: 'openai', model: 'gpt-image-1', imageBase64: result.imageBase64 };
}

export async function runCreativeJob(jobId: string, ownerToken: string): Promise<void> {
  const ownerHash = ownerTokenHash(ownerToken);
  const jobs = await rest<JobRow[]>(
    `pupson_creative_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&owner_token_hash=eq.${ownerHash}&limit=1`
  );
  const job = jobs[0];
  if (!job || job.status === 'succeeded' || job.status === 'cancelled') return;
  const sourceLinks = await rest<
    Array<{
      media_asset: { bucket_id: string; object_path: string; mime_type: string; id: string } | null;
    }>
  >(
    `pupson_pet_identity_assets?select=media_asset:pupson_media_assets!inner(id,bucket_id,object_path,mime_type)&pet_identity_id=eq.${job.pet_identity_id}&role=eq.primary&limit=1`
  );
  const source = sourceLinks[0]?.media_asset;
  if (!source) throw new Error('Creative job source asset is missing.');
  const sourceUrl = await createSignedAssetUrl(source.bucket_id, source.object_path, 120);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) throw new Error('Could not load creative job source asset.');
  const sourceBytes = Buffer.from(await sourceResponse.arrayBuffer());
  const attempt = job.attempt_count + 1;
  await rest(`pupson_creative_jobs?id=eq.${job.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'running',
      attempt_count: attempt,
      started_at: new Date().toISOString(),
      last_error: null,
    }),
  });
  await rest('pupson_creative_job_attempts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      job_id: job.id,
      attempt,
      provider:
        job.art_style === 'ascii-art'
          ? 'local'
          : job.art_style.includes('ghibli') || job.art_style.includes('dreamscape')
            ? 'muapi'
            : 'openai',
      status: 'running',
    }),
  });
  try {
    const generated = await generate(
      job,
      sourceBytes,
      source.mime_type,
      `pet.${source.mime_type.split('/')[1]}`
    );
    const providerBytes = Buffer.from(generated.imageBase64, 'base64');
    const generatedBytes = await sharp(providerBytes, { failOn: 'error' }).png().toBuffer();
    const generatedMeta = await sharp(generatedBytes).metadata();
    const generatedId = randomUUID();
    const generatedPath = `${ownerHash}/${job.id}/${generatedId}.png`;
    await uploadPrivateAsset({
      bucket: 'pupson-creative',
      path: generatedPath,
      bytes: generatedBytes,
      contentType: 'image/png',
    });
    const printBytes = await sharp(generatedBytes)
      .resize(3600, 3600, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const printId = randomUUID();
    const printPath = `${ownerHash}/${job.id}/${printId}.png`;
    await uploadPrivateAsset({
      bucket: 'pupson-print-ready',
      path: printPath,
      bytes: printBytes,
      contentType: 'image/png',
    });
    await rest('pupson_media_assets', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([
        {
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
          source_asset_id: source.id,
          provenance: { provider: generated.provider, model: generated.model, jobId: job.id },
        },
        {
          id: printId,
          owner_token_hash: ownerHash,
          kind: 'print_ready',
          bucket_id: 'pupson-print-ready',
          object_path: printPath,
          mime_type: 'image/png',
          byte_size: printBytes.length,
          width: 3600,
          height: 3600,
          sha256: sha256(printBytes),
          source_asset_id: generatedId,
          provenance: { dpiTarget: 300, jobId: job.id },
        },
      ]),
    });
    await rest('pupson_creative_outputs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        job_id: job.id,
        generated_asset_id: generatedId,
        print_asset_id: printId,
        quality_gate: { passed: true, width: 3600, height: 3600, format: 'png' },
      }),
    });
    await rest(`pupson_creative_job_attempts?job_id=eq.${job.id}&attempt=eq.${attempt}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'succeeded', completed_at: new Date().toISOString() }),
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
    await rest(`pupson_creative_jobs?id=eq.${job.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: attempt >= job.max_attempts ? 'failed' : 'queued',
        last_error: message,
        completed_at: attempt >= job.max_attempts ? new Date().toISOString() : null,
      }),
    });
    throw error;
  }
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
      ? await createSignedAssetUrl(
          output.generated_asset.bucket_id,
          output.generated_asset.object_path
        )
      : undefined,
  };
}

export async function approveCreativeOutput(outputId: string, ownerToken: string): Promise<void> {
  const ownerHash = ownerTokenHash(ownerToken);
  const rows = await rest<RowId[]>(
    `pupson_creative_outputs?select=id,job:pupson_creative_jobs!inner(owner_token_hash)&id=eq.${encodeURIComponent(outputId)}&job.owner_token_hash=eq.${ownerHash}&limit=1`
  );
  if (!rows[0]) throw new Error('Creative output was not found.');
  await rest(`pupson_creative_outputs?id=eq.${rows[0].id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ approval_status: 'approved', approved_at: new Date().toISOString() }),
  });
}

import sharp from 'sharp';
import type { Hotspot } from '@/data/hotspots';
import { evaluateImageQuality, type PrintProfile, type QualityReport } from '@/lib/pod/quality-gate';
import { normalizeArtworkTransform, type ArtworkTransform } from '@/types/creative';
import { ensureSourceResolution } from '@/lib/image-upscale';

export interface ProductPrintProfile extends PrintProfile {
  targetDpi: number;
  productId: string;
  variantId: string;
  variantLabel: string;
}

export interface PrintMasterResult {
  bytes: Buffer;
  width: number;
  height: number;
  transform: ArtworkTransform;
  profile: ProductPrintProfile;
  quality: QualityReport;
  source: {
    width: number;
    height: number;
    effectiveDpi: number;
    resampled: boolean;
    upscaleProvider: string;
    upscaleModel?: string;
    originalWidth: number;
    originalHeight: number;
  };
}

function canvasDimensions(label: string): [number, number] | null {
  const match = label.match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function resolveProductPrintProfile(hotspot: Hotspot, variantId: string): ProductPrintProfile {
  const variant = hotspot.fulfillment?.variants.find((item) => item.variantId === variantId);
  if (!hotspot.fulfillment || !variant) throw new Error('Unknown product variant for print composition.');

  let dimensions: [number, number];
  switch (hotspot.product) {
    case 'canvas':
      dimensions = canvasDimensions(variant.label) ?? [12, 16];
      break;
    case 'pillow':
      dimensions = canvasDimensions(variant.label) ?? [18, 18];
      break;
    case 'mug':
      dimensions = [8.5, 3.5];
      break;
    case 'bottle':
      dimensions = [9, 4];
      break;
    case 'tote':
      dimensions = [12, 14];
      break;
    case 'hoodie':
    case 'shirt':
    case 'shirts':
      dimensions = [12, 16];
      break;
    default:
      dimensions = [12, 12];
  }

  return {
    name: `${hotspot.id}:${variant.variantId}`,
    printWidthInches: dimensions[0],
    printHeightInches: dimensions[1],
    minDpi: 150,
    safeMarginInches: hotspot.product === 'canvas' ? 0.125 : 0.25,
    targetDpi: 300,
    productId: hotspot.id,
    variantId: variant.variantId,
    variantLabel: variant.label,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Builds the exact product/variant print master the customer approved.
 *
 * The editor transform is applied in normalized print-area coordinates and
 * clamped inside the product safe area. The quality report is produced from
 * the final print asset rather than a generic pre-product square.
 */
export async function buildPrintMaster(input: {
  generatedBytes: Buffer;
  hotspot: Hotspot;
  variantId: string;
  transform?: Partial<ArtworkTransform>;
}): Promise<PrintMasterResult> {
  const profile = resolveProductPrintProfile(input.hotspot, input.variantId);
  const transform = normalizeArtworkTransform(input.transform);
  const targetWidth = Math.ceil(profile.printWidthInches * profile.targetDpi);
  const targetHeight = Math.ceil(profile.printHeightInches * profile.targetDpi);
  const margin = Math.ceil(profile.safeMarginInches * profile.targetDpi);
  const safeWidth = Math.max(1, targetWidth - margin * 2);
  const safeHeight = Math.max(1, targetHeight - margin * 2);

  // scale=1 occupies half the safe area; scale=2 can fill it completely.
  // Required source pixels are calculated from the actual approved printed
  // footprint, not from the final canvas dimensions.
  const footprintWidth = safeWidth * 0.5 * transform.scale;
  const footprintHeight = safeHeight * 0.5 * transform.scale;
  const requiredSourceWidth = (footprintWidth / profile.targetDpi) * profile.minDpi;
  const requiredSourceHeight = (footprintHeight / profile.targetDpi) * profile.minDpi;
  const source = await ensureSourceResolution({
    bytes: input.generatedBytes,
    mimeType: 'image/png',
    requiredWidth: requiredSourceWidth,
    requiredHeight: requiredSourceHeight,
  });

  const rotated = await sharp(source.bytes, { failOn: 'error' })
    .rotate(transform.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const rotatedMeta = await sharp(rotated).metadata();
  const rotatedWidth = rotatedMeta.width ?? source.width;
  const rotatedHeight = rotatedMeta.height ?? source.height;

  const fit = Math.min(footprintWidth / rotatedWidth, footprintHeight / rotatedHeight);
  const artworkWidth = Math.max(1, Math.round(rotatedWidth * fit));
  const artworkHeight = Math.max(1, Math.round(rotatedHeight * fit));
  const artwork = await sharp(rotated)
    .resize(artworkWidth, artworkHeight, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  const centerX = margin + transform.x * safeWidth;
  const centerY = margin + transform.y * safeHeight;
  const left = Math.round(
    clamp(centerX - artworkWidth / 2, margin, targetWidth - margin - artworkWidth)
  );
  const top = Math.round(
    clamp(centerY - artworkHeight / 2, margin, targetHeight - margin - artworkHeight)
  );

  const bytes = await sharp({
    create: {
      width: targetWidth,
      height: targetHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: artwork, left, top }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const effectiveDpi = Math.min(
    source.width / Math.max(0.01, (artworkWidth / targetWidth) * profile.printWidthInches),
    source.height / Math.max(0.01, (artworkHeight / targetHeight) * profile.printHeightInches)
  );
  const baseQuality = evaluateImageQuality(
    {
      width: targetWidth,
      height: targetHeight,
      mimeType: 'image/png',
      fileBytes: bytes.length,
      hasPetSubject: true,
      subjectCoverage: 1,
    },
    profile
  );
  const sourceScore = Math.min(100, Math.round((effectiveDpi / profile.minDpi) * 100));
  const sourceCheck = {
    id: 'source-resolution',
    label: 'Source detail',
    score: sourceScore,
    status: sourceScore >= 90 ? ('pass' as const) : sourceScore >= 75 ? ('warn' as const) : ('fail' as const),
    detail: `${Math.round(effectiveDpi)} effective source DPI; target ≥ ${profile.minDpi} DPI for the approved placement.`,
  };
  const checks = [...baseQuality.checks, sourceCheck];
  const score = Math.round(checks.reduce((sum, check) => sum + check.score, 0) / checks.length);
  const quality: QualityReport = {
    checks,
    score,
    status:
      checks.some((check) => check.status === 'fail')
        ? 'fail'
        : checks.some((check) => check.status === 'warn')
          ? 'warn'
          : 'pass',
    productionReady:
      !checks.some((check) => check.status !== 'pass') && effectiveDpi >= profile.minDpi,
  };

  return {
    bytes,
    width: targetWidth,
    height: targetHeight,
    transform,
    profile,
    quality,
    source: {
      width: source.width,
      height: source.height,
      effectiveDpi: Math.round(effectiveDpi * 10) / 10,
      resampled: artworkWidth > rotatedWidth || artworkHeight > rotatedHeight,
      upscaleProvider: source.provider,
      upscaleModel: source.model,
      originalWidth: source.originalWidth,
      originalHeight: source.originalHeight,
    },
  };
}

import type { Hotspot } from '@/data/hotspots';
import type { PrintProfile } from '@/lib/pod/quality-gate';

export interface ProductPrintProfile extends PrintProfile {
  targetDpi: number;
  productId: string;
  variantId: string;
  variantLabel: string;
}

function canvasDimensions(label: string): [number, number] | null {
  const match = label.match(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function resolveProductPrintProfile(
  hotspot: Hotspot,
  variantId: string
): ProductPrintProfile {
  const variant = hotspot.fulfillment?.variants.find((item) => item.variantId === variantId);
  if (!hotspot.fulfillment || !variant)
    throw new Error('Unknown product variant for print composition.');

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

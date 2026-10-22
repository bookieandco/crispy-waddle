/** Printify-only read evidence for blank 3D asset measurements.
 * Catalog placeholder width/height are pixels, NOT physical size.
 * Physical W/H/D must come from a rights-reviewed product spec/sample.
 * This module cannot promote assets, publish products or change a shop.
 */
import type {
  PrintifyBlueprint,
  PrintifyBlueprintSizeGuide,
  PrintifyCatalogVariant,
  PrintifyPrintProviderSimple,
  PrintifyVariantsResponse,
} from '../printify';

export interface ExactPrintifySku {
  product: 'tote' | 'hoodie';
  blueprintId: number;
  printProviderId: number;
  variantId: number;
}

export interface PrintifySkuEvidence {
  authority: 'PRINTIFY_CATALOG_READ_ONLY';
  product: 'tote' | 'hoodie';
  blueprintId: number;
  blueprintTitle: string;
  blueprintBrand: string;
  blueprintModel: string;
  printProviderId: number;
  printProviderName: string;
  variantId: number;
  variantTitle: string;
  variantOptions: Readonly<Record<string, string>>;
  printAreasPx: readonly {position: string; decorationMethod: string; widthPx: number; heightPx: number}[];
  sizeGuide: {
    sizes: readonly string[];
    measures: readonly {name: string; units: string; from: string | null; to: string | null}[];
  };
  physicallyMeasuredWidthHeightDepthMm: null;
  productionGeometryApproved: false;
  storefrontApproved: false;
  blockers: readonly string[];
}

function safePositiveId(v: unknown): v is number {
  return Number.isSafeInteger(v) && typeof v === 'number' && v > 0;
}

export function parseExactPrintifyId(v: unknown): number {
  if (typeof v !== 'string' || !/^[1-9][0-9]{0,10}$/.test(v)) {
    throw new Error('EXACT_NUMERIC_PRINTIFY_ID_REQUIRED');
  }
  const value=Number(v);
  if (!safePositiveId(value)) throw new Error('EXACT_NUMERIC_PRINTIFY_ID_REQUIRED');
  return value;
}

function checkVariant(
  variants: PrintifyVariantsResponse,
  variantId: number,
): PrintifyCatalogVariant {
  if (!variants || !Array.isArray(variants.variants)) {
    throw new Error('PRINTIFY_VARIANTS_NOT_AVAILABLE');
  }
  const matches=variants.variants.filter((v) => v?.id === variantId);
  if (matches.length !== 1) throw new Error('EXACT_PRINTIFY_VARIANT_NOT_FOUND');
  const v=matches[0]!;
  if (typeof v.title !== 'string' || !v.title.trim()) throw new Error('PRINTIFY_VARIANT_TITLE_MISSING');
  if (!v.options || typeof v.options !== 'object' || Array.isArray(v.options)) {
    throw new Error('PRINTIFY_VARIANT_OPTIONS_MISSING');
  }
  return v;
}

export function buildPrintifySkuEvidence(
  ids: ExactPrintifySku,
  blueprint: PrintifyBlueprint,
  providers: PrintifyPrintProviderSimple[],
  variants: PrintifyVariantsResponse,
  sizeGuide: PrintifyBlueprintSizeGuide,
): PrintifySkuEvidence {
  if (!['hoodie','tote'].includes(ids.product) ||
      ![ids.blueprintId,ids.printProviderId,ids.variantId].every(safePositiveId) ||
      !blueprint || blueprint.id !== ids.blueprintId ||
      typeof blueprint.title !== 'string' || typeof blueprint.brand !== 'string' ||
      typeof blueprint.model !== 'string') {
    throw new Error('PRINTIFY_BLUEPRINT_IDENTITY_NOT_VERIFIED');
  }
  if (!Array.isArray(providers)) throw new Error('PRINTIFY_PROVIDER_LIST_MISSING');
  const found = providers.filter(p=>p.id===ids.printProviderId);
  if (found.length !== 1 || typeof found[0]!.title !== 'string') {
    throw new Error('EXACT_PRINTIFY_PROVIDER_NOT_FOUND');
  }
  const variant=checkVariant(variants, ids.variantId);
  if (!Array.isArray(variant.placeholders)) throw new Error('PRINTIFY_PRINT_AREAS_MISSING');
  const areas=variant.placeholders.map(a=>{
    if (!a || typeof a.position !== 'string' ||
        typeof a.decoration_method !== 'string' ||
        !safePositiveId(a.width) || !safePositiveId(a.height)) {
      throw new Error('PRINTIFY_PRINT_AREA_INVALID');
    }
    return {position:a.position,decorationMethod:a.decoration_method,
      widthPx:a.width,heightPx:a.height};
  });
  if (!sizeGuide || !Array.isArray(sizeGuide.sizes) || !Array.isArray(sizeGuide.types)) {
    throw new Error('PRINTIFY_SIZE_GUIDE_NOT_AVAILABLE');
  }
  const size=String(variant.options?.size || '').trim();
  const idx=sizeGuide.sizes.findIndex(x=>x.toLowerCase()===size.toLowerCase());
  const measures=idx < 0 ? [] : sizeGuide.types.map(t=>{
    if (!t || !Array.isArray(t.ranges) || typeof t.name!=='string' ||
        typeof t.units!=='string') throw new Error('PRINTIFY_SIZE_GUIDE_INVALID');
    return {name:t.name,units:t.units,
      from:t.ranges[idx]?.from??null,to:t.ranges[idx]?.to??null};
  });
  // Even a size-guide Width or Length is not a 3D model's full dimensions;
  // garment sizes may be laid flat, body-size recommendations, or ranges.
  const blockers=['PHYSICAL_W_H_D_REQUIRED_FROM_MANUFACTURER_OR_SAMPLE',
    'LICENSED_FRONT_SIDE_BACK_REFERENCE_REQUIRED',
    'PRINT_ZONE_PHYSICAL_COORDINATES_UNVERIFIED',
    'HUMAN_MODEL_REVIEW_REQUIRED'];
  if (!areas.length) blockers.push('PRINTIFY_PRINT_AREA_MISSING');
  if (idx < 0) blockers.push('PRINTIFY_SIZE_GUIDE_FOR_VARIANT_UNAVAILABLE');
  return Object.freeze({
    authority:'PRINTIFY_CATALOG_READ_ONLY' as const,
    product:ids.product,
    blueprintId:ids.blueprintId,blueprintTitle:blueprint.title,
    blueprintBrand:blueprint.brand,blueprintModel:blueprint.model,
    printProviderId:ids.printProviderId, printProviderName:found[0]!.title,
    variantId:ids.variantId,variantTitle:variant.title,
    variantOptions:Object.freeze(Object.fromEntries(Object.entries(variant.options).filter(([,v])=>typeof v==='string')) as Record<string,string>),
    printAreasPx:Object.freeze(areas),
    sizeGuide:{sizes:Object.freeze([...sizeGuide.sizes]),
      measures:Object.freeze(measures)},
    physicallyMeasuredWidthHeightDepthMm:null,
    productionGeometryApproved:false as const,
    storefrontApproved:false as const,
    blockers:Object.freeze(blockers),
  });
}

#!/usr/bin/env -S node --import tsx
/** Exact supplier catalog query: five GETs, zero writes.
 * No IDs inferred from a product nickname. Requires explicit IDs and a key
 * only on a local trusted operator machine; no GitHub Actions secrets.
 * Example:
 *  PRINTIFY_API_KEY=... node --import tsx scripts/printify-3d-sku-evidence.ts \
 *    --product tote --blueprint 123 --provider 456 --variant 789
 */
import {
  getBlueprint,getBlueprintSizeGuide,listPrintProvidersForBlueprint,listVariants,
} from '../lib/printify';
import {
  parseExactPrintifyId,buildPrintifySkuEvidence,type ExactPrintifySku,
} from '../lib/product3d/printify-sku-evidence';

export function parseProofArgs(args: string[]): ExactPrintifySku {
  const opt:Record<string,string>={};
  for(let i=0;i<args.length;i+=2){
    if(!['--product','--blueprint','--provider','--variant'].includes(args[i]??'') ||
        !args[i+1] || Object.hasOwn(opt,args[i]!)) throw Error('EXACT_IDS_AND_PRODUCT_REQUIRED');
    opt[args[i]!]=args[i+1]!;
  }
  if(Object.keys(opt).length!==4 ||
      (opt['--product']!=='tote' && opt['--product']!=='hoodie')) {
    throw Error('EXACT_IDS_AND_PRODUCT_REQUIRED');
  }
  return {
    product:opt['--product'],
    blueprintId:parseExactPrintifyId(opt['--blueprint']),
    printProviderId:parseExactPrintifyId(opt['--provider']),
    variantId:parseExactPrintifyId(opt['--variant']),
  };
}

export async function obtainExactSkuEvidence(ids: ExactPrintifySku) {
  if(!process.env.PRINTIFY_API_KEY?.trim()) {
    throw Error('PRINTIFY_API_KEY_MISSING_NO_LIVE_CATALOG_ASSERTIONS');
  }
  // All calls are the existing typed GET-only Printify client. No write
  // endpoints, files, shop-scoped orders, uploads or product mutations.
  const [blueprint,providers,variants,sizeGuide]=await Promise.all([
    getBlueprint(ids.blueprintId),
    listPrintProvidersForBlueprint(ids.blueprintId),
    listVariants(ids.blueprintId,ids.printProviderId),
    getBlueprintSizeGuide(ids.blueprintId),
  ]);
  return buildPrintifySkuEvidence(ids,blueprint,providers,variants,sizeGuide);
}

// Don't accidentally network-fetch when imported by Vitest.
if(process.argv[1]?.endsWith('printify-3d-sku-evidence.ts')) {
  try {
    const ids=parseProofArgs(process.argv.slice(2));
    const report=await obtainExactSkuEvidence(ids);
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  } catch(error) {
    // Printify errors could include unexpected upstream diagnostics. Print
    // only a controlled category; no token, input, or response body.
    const reason=error instanceof Error && [
      'EXACT_IDS_AND_PRODUCT_REQUIRED','EXACT_NUMERIC_PRINTIFY_ID_REQUIRED',
      'PRINTIFY_API_KEY_MISSING_NO_LIVE_CATALOG_ASSERTIONS',
    ].includes(error.message) ? error.message : 'PRINTIFY_READ_ONLY_CATALOG_UNAVAILABLE_OR_INVALID';
    process.stderr.write(reason+'\n');
    process.exitCode=2;
  }
}

import { hotspots } from '@/data/hotspots';
import { ValidatedCartItem } from '@/lib/catalog';
import { ownerTokenHash, rest } from '@/lib/platform';

interface OutputReadiness {
  id: string;
  approval_status: string;
  print_asset_id: string | null;
  quality_gate: Record<string, unknown> | null;
  job: { owner_token_hash: string } | null;
}

function passedPrintQualityGate(value: Record<string, unknown> | null): boolean {
  if (!value) return false;
  return value.productionReady === true && typeof value.score === 'number' && value.score >= 90;
}

export interface CertifiedCartItem extends ValidatedCartItem {
  printAssetId: string;
  providerProductId: string;
  providerVariantId: string;
}

export async function certifyCartForCheckout(
  items: ValidatedCartItem[],
  ownerToken: string
): Promise<CertifiedCartItem[]> {
  const ownerHash = ownerTokenHash(ownerToken);
  const outputIds = [...new Set(items.map((item) => item.creativeOutputId))];
  const outputs = await rest<OutputReadiness[]>(
    `pupson_creative_outputs?select=id,approval_status,print_asset_id,quality_gate,job:pupson_creative_jobs!inner(owner_token_hash)&id=in.(${outputIds.map(encodeURIComponent).join(',')})`
  );
  const outputMap = new Map(outputs.map((output) => [output.id, output]));
  const certified: CertifiedCartItem[] = [];
  for (const item of items) {
    const output = outputMap.get(item.creativeOutputId);
    if (
      !output ||
      output.job?.owner_token_hash !== ownerHash ||
      output.approval_status !== 'approved' ||
      !output.print_asset_id ||
      !passedPrintQualityGate(output.quality_gate)
    ) {
      throw new Error('Every cart item must reference your approved artwork with a passing print-quality gate.');
    }
    const mapping = item.fulfillment;
    const variant = mapping?.variants.find((candidate) => candidate.variantId === item.variantId);
    if (!mapping || !variant) throw new Error(`${item.productName} is no longer sellable.`);
    const liveRows = await rest<
      Array<{
        provider: string;
        provider_product_id: string;
        provider_variant_id: string;
        active: boolean;
        certification_status: string;
      }>
    >(
      `pupson_catalog_variants?select=provider,provider_product_id,provider_variant_id,active,certification_status&product_id=eq.${encodeURIComponent(item.productId)}&variant_id=eq.${encodeURIComponent(item.variantId)}&limit=1`
    );
    const live = liveRows[0];
    if (
      !live?.active ||
      !['sandbox_verified', 'sample_verified'].includes(live.certification_status)
    ) {
      throw new Error(`${item.productName} has not passed catalog certification.`);
    }
    if (live.provider !== 'printify')
      throw new Error(`${item.productName} is not mapped to the launch fulfillment provider.`);
    certified.push({
      ...item,
      printAssetId: output.print_asset_id,
      providerProductId: live.provider_product_id,
      providerVariantId: live.provider_variant_id,
    });
  }
  return certified;
}

export function catalogHasNoPlaceholders(): boolean {
  return hotspots
    .filter((item) => item.fulfillment)
    .every(
      (item) =>
        !item.fulfillment!.productId.includes('PLACEHOLDER') &&
        item.fulfillment!.variants.every((variant) => !variant.variantId.includes('PLACEHOLDER'))
    );
}

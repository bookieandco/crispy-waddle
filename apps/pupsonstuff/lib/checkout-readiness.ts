import { hotspots } from '@/data/hotspots';
import { ValidatedCartItem } from '@/lib/catalog';
import { ownerTokenHash, rest } from '@/lib/platform';

interface OutputReadiness {
  id: string;
  approval_status: string;
  print_asset_id: string | null;
  quality_gate: Record<string, unknown> | null;
  job: { owner_token_hash: string; product_id: string } | null;
}

export function passedPrintQualityGate(
  value: Record<string, unknown> | null,
  expectedProductId: string,
  expectedVariantId: string
): boolean {
  if (!value) return false;
  const profile =
    value.profile && typeof value.profile === 'object'
      ? (value.profile as Record<string, unknown>)
      : null;
  return (
    value.productionReady === true &&
    typeof value.score === 'number' &&
    value.score >= 90 &&
    profile?.productId === expectedProductId &&
    profile?.variantId === expectedVariantId
  );
}

export interface CertifiedCartItem extends ValidatedCartItem {
  printAssetId: string;
  fulfillmentProvider: 'printify';
  providerProductId: string;
  providerVariantId: string;
  blueprintId: string;
  printProviderId: string;
  printArea: string;
  catalogCertificationStatus: 'sandbox_verified' | 'sample_verified';
}

export async function certifyCartForCheckout(
  items: ValidatedCartItem[],
  ownerToken: string
): Promise<CertifiedCartItem[]> {
  const ownerHash = ownerTokenHash(ownerToken);
  const outputIds = [...new Set(items.map((item) => item.creativeOutputId))];
  const outputs = await rest<OutputReadiness[]>(
    `pupson_creative_outputs?select=id,approval_status,print_asset_id,quality_gate,job:pupson_creative_jobs!inner(owner_token_hash,product_id)&id=in.(${outputIds.map(encodeURIComponent).join(',')})`
  );
  const outputMap = new Map(outputs.map((output) => [output.id, output]));
  const certified: CertifiedCartItem[] = [];
  for (const item of items) {
    const output = outputMap.get(item.creativeOutputId);
    if (
      !output ||
      output.job?.owner_token_hash !== ownerHash ||
      output.job?.product_id !== item.productId ||
      output.approval_status !== 'approved' ||
      !output.print_asset_id ||
      !passedPrintQualityGate(output.quality_gate, item.productId, item.variantId)
    ) {
      throw new Error(
        'Every cart item must reference your approved print master for the exact product and variant being purchased.'
      );
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
        blueprint_id: string | null;
        print_provider_id: string | null;
        print_area: string;
      }>
    >(
      `pupson_catalog_variants?select=provider,provider_product_id,provider_variant_id,active,certification_status,blueprint_id,print_provider_id,print_area&product_id=eq.${encodeURIComponent(item.productId)}&variant_id=eq.${encodeURIComponent(item.variantId)}&limit=1`
    );
    const live = liveRows[0];
    const requiredCertification =
      process.env.PUPSON_FULFILLMENT_MODE === 'live'
        ? 'sample_verified'
        : null;
    if (
      !live?.active ||
      !['sandbox_verified', 'sample_verified'].includes(live.certification_status) ||
      (requiredCertification && live.certification_status !== requiredCertification)
    ) {
      throw new Error(
        requiredCertification
          ? `${item.productName} has not passed physical-sample certification.`
          : `${item.productName} has not passed catalog certification.`
      );
    }
    if (live.provider !== 'printify')
      throw new Error(`${item.productName} is not mapped to the launch fulfillment provider.`);
    if (!live.blueprint_id || !live.print_provider_id || !live.print_area)
      throw new Error(`${item.productName} has an incomplete Printify production mapping.`);
    certified.push({
      ...item,
      printAssetId: output.print_asset_id,
      fulfillmentProvider: 'printify',
      providerProductId: live.provider_product_id,
      providerVariantId: live.provider_variant_id,
      blueprintId: live.blueprint_id,
      printProviderId: live.print_provider_id,
      printArea: live.print_area,
      catalogCertificationStatus: live.certification_status as
        | 'sandbox_verified'
        | 'sample_verified',
    });
  }
  return certified;
}

export function catalogUsesProviderNeutralIds(): boolean {
  return hotspots
    .filter((item) => item.fulfillment)
    .every(
      (item) =>
        !/(printful|printify|placeholder|^ful-)/i.test(item.fulfillment!.productId) &&
        item.fulfillment!.variants.every(
          (variant) => !/(printful|printify|placeholder|^ful-)/i.test(variant.variantId)
        )
    );
}

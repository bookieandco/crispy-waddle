import { createSignedAssetUrl, ownerTokenHash, rest } from '@/lib/platform';

interface OwnedOutputRow {
  id: string;
  generated_asset: { bucket_id: string; object_path: string; mime_type: string } | null;
  job: { owner_token_hash: string } | null;
}

/** Query by BOTH output and owning job. A service-role database client may
 * bypass RLS, so the ownership predicate is mandatory at this boundary. */
export async function resolveOwnedCreativeAsset(
  outputId: string,
  ownerToken: string,
): Promise<{ bucket: 'pupson-creative'; path: string } | null> {
  if (!/^[a-f0-9-]{36}$/i.test(outputId) || !ownerToken || ownerToken.length > 200) return null;
  const ownerHash = ownerTokenHash(ownerToken);
  const rows = await rest<OwnedOutputRow[]>(
    `pupson_creative_outputs?select=id,generated_asset:pupson_media_assets!generated_asset_id(bucket_id,object_path,mime_type),job:pupson_creative_jobs!inner(owner_token_hash)&id=eq.${encodeURIComponent(outputId)}&job.owner_token_hash=eq.${ownerHash}&limit=1`
  );
  const asset = rows[0]?.generated_asset;
  if (!asset || asset.bucket_id !== 'pupson-creative' ||
      asset.mime_type !== 'image/png' ||
      !asset.object_path.startsWith(ownerHash + '/') ||
      !/^[a-f0-9]{64}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.png$/i.test(asset.object_path)) return null;
  return { bucket:'pupson-creative', path:asset.object_path };
}

export async function downloadOwnedCreativeImage(
  outputId: string,
  ownerToken: string,
): Promise<Uint8Array | null> {
  const asset = await resolveOwnedCreativeAsset(outputId, ownerToken);
  if (!asset) return null;
  const signedUrl = await createSignedAssetUrl(asset.bucket, asset.path, 60);
  const response = await fetch(signedUrl, {cache:'no-store',redirect:'error'});
  if (!response.ok || Number(response.headers.get('content-length') || 0) > 20*1024*1024) {
    throw new Error('Private portrait could not be retrieved.');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 8 || bytes.byteLength > 20*1024*1024 ||
      ![137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)) {
    throw new Error('Private portrait was not a valid PNG.');
  }
  return bytes;
}

import sharp from 'sharp';

const MIME = new Set(['image/png','image/jpeg','image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 32_000_000;

/** Never persist the customer's unmodified camera file. Strips EXIF/GPS,
 * EXIF orientation and embedded profiles while bounding both memory and output.
 * The original filename is intentionally NOT included in asset provenance.
 */
export async function sanitizePetReference(input: {
  bytes: Buffer;
  mimeType: string;
}): Promise<{ bytes: Buffer; mimeType: 'image/jpeg'; width: number; height: number }> {
  if (!MIME.has(input.mimeType) || input.bytes.length < 1 || input.bytes.length > MAX_BYTES) {
    throw new Error('Pet photo must be a JPEG, PNG or WebP no larger than 10MB.');
  }
  const source = sharp(input.bytes, { failOn: 'error', limitInputPixels: MAX_PIXELS });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height ||
      metadata.width < 512 || metadata.height < 512 ||
      metadata.width * metadata.height > MAX_PIXELS || (metadata.pages ?? 1) !== 1) {
    throw new Error('Provide one still pet photo of at least 512 × 512 pixels (maximum 32 megapixels).');
  }
  const output = await source
    .rotate()
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .flatten({background:'#ffffff'})
    .toColourspace('srgb')
    .jpeg({quality:84, progressive:true})
    .toBuffer();
  const safe = await sharp(output).metadata();
  if (!safe.width || !safe.height || output.length > MAX_BYTES) {
    throw new Error('Pet photo could not be normalized safely.');
  }
  return {bytes:output,mimeType:'image/jpeg',width:safe.width,height:safe.height};
}

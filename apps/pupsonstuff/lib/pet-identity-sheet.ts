import sharp from 'sharp';

export interface PetIdentityReference {
  bytes: Buffer;
  mimeType: string;
  role: 'primary' | 'reference';
  assetId: string;
}

export interface PetIdentitySheet {
  bytes: Buffer;
  mimeType: 'image/png';
  fileName: 'pet-identity.png';
  sourceAssetIds: string[];
}

const TILE = 768;
const GAP = 24;
const CANVAS = TILE * 2 + GAP * 3;

async function normalizeTile(reference: PetIdentityReference): Promise<Buffer> {
  return sharp(reference.bytes, { failOn: 'error' })
    .rotate()
    .resize(TILE, TILE, {
      fit: 'contain',
      background: { r: 250, g: 248, b: 244, alpha: 1 },
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
}

/**
 * Provider-neutral multi-photo identity input.
 *
 * Generators that only accept one image still receive every admitted pet
 * reference: a 2x2 identity sheet with the primary view first and up to two
 * additional reference views. This prevents the old behavior where extra
 * uploads were persisted but silently ignored by generation.
 */
export async function buildPetIdentitySheet(
  references: PetIdentityReference[]
): Promise<PetIdentitySheet> {
  if (references.length < 1 || references.length > 3) {
    throw new Error('Pet Identity requires between one and three reference photos.');
  }
  const ordered = [...references].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === 'primary' ? -1 : 1;
  });
  if (ordered.length === 1) {
    const bytes = await sharp(ordered[0].bytes, { failOn: 'error' })
      .rotate()
      .resize(1536, 1536, {
        fit: 'contain',
        background: { r: 250, g: 248, b: 244, alpha: 1 },
      })
      .png()
      .toBuffer();
    return {
      bytes,
      mimeType: 'image/png',
      fileName: 'pet-identity.png',
      sourceAssetIds: ordered.map((item) => item.assetId),
    };
  }

  const tiles = await Promise.all(ordered.map(normalizeTile));
  const positions = [
    { left: GAP, top: GAP },
    { left: TILE + GAP * 2, top: GAP },
    { left: GAP, top: TILE + GAP * 2 },
  ];
  const composites = tiles.map((input, index) => ({ input, ...positions[index] }));
  const bytes = await sharp({
    create: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      background: { r: 250, g: 248, b: 244, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return {
    bytes,
    mimeType: 'image/png',
    fileName: 'pet-identity.png',
    sourceAssetIds: ordered.map((item) => item.assetId),
  };
}

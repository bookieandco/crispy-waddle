import type { GrowthId, ISODateTime } from '../domain/types.js';

export type CreativeFormat = 'short_video' | 'image' | 'carousel' | 'ugc' | 'testimonial' | 'talking_head' | 'meme' | 'educational' | 'product_demo';
export type FunnelStage = 'prospecting' | 'retargeting' | 'retention';

export interface CreativeVariant {
  id: GrowthId;
  label: string;
  format: CreativeFormat;
  hook: string;
  primaryText?: string;
  headline?: string;
  callToAction?: string;
  assetId?: GrowthId;
}

export interface CreativeConcept {
  id: GrowthId;
  name: string;
  avatar: string;
  painPoint?: string;
  goal?: string;
  offer?: string;
  audienceSignals: readonly string[];
  variants: readonly CreativeVariant[];
}

export interface CreativePack {
  id: GrowthId;
  brandId: GrowthId;
  name: string;
  objective: string;
  funnelStage: FunnelStage;
  concepts: readonly CreativeConcept[];
  createdAt: ISODateTime;
}

export function createCreativePack(input: Omit<CreativePack, 'id'> & { id?: GrowthId }): CreativePack {
  return { ...input, id: input.id ?? `creative-pack:${input.brandId}:${Date.parse(input.createdAt)}` };
}

export function countCreativeVariants(pack: CreativePack): number {
  return pack.concepts.reduce((total, concept) => total + concept.variants.length, 0);
}

export function conceptIds(pack: CreativePack): GrowthId[] {
  return pack.concepts.map((concept) => concept.id);
}

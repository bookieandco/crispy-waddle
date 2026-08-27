import type { GrowthId } from '../domain/types.js';
import type { BrandAudienceProfile } from './brand-audience.js';

export interface BrandRegistryEntry extends BrandAudienceProfile {
  status: 'active' | 'paused';
}

const BRANDS: readonly BrandRegistryEntry[] = [
  { brandId: 'brand:truckeros' as GrowthId, name: 'Truckeros', mission: 'Connect trucking audiences with useful opportunities, services, and information.', audienceSignals: ['truck', 'trucking', 'truck driver', 'owner operator', 'fleet', 'diesel', 'freight'], preferredSurfaces: ['social:tiktok', 'social:youtube', 'social:facebook', 'social:x', 'search:google', 'community:reddit', 'creator:network'], tone: ['direct', 'useful', 'industry-native'], objectives: ['awareness', 'qualified traffic', 'lead generation'], status: 'active' },
  { brandId: 'brand:pupsonstuff' as GrowthId, name: 'PupsonStuff', mission: 'Help pet owners turn their pets into personalized products and gifts.', audienceSignals: ['pet', 'dog', 'puppy', 'pet owner', 'gift', 'portrait', 'personalized'], preferredSurfaces: ['social:instagram', 'social:tiktok', 'social:facebook', 'search:google', 'creator:network', 'marketplace:discovery'], tone: ['playful', 'warm', 'visual'], objectives: ['discovery', 'product sales', 'creator acquisition'], status: 'active' },
  { brandId: 'brand:atwood-bookie' as GrowthId, name: 'Atwood Bookie', mission: 'Grow a music audience through distinctive culture, sound, and visual identity.', audienceSignals: ['music', 'hip hop', 'rap', 'artist', 'song', 'playlist', 'club', 'culture'], preferredSurfaces: ['social:tiktok', 'social:instagram', 'social:youtube', 'social:x', 'creator:network'], tone: ['bold', 'cultural', 'irreverent'], objectives: ['audience growth', 'streams', 'fan conversion'], status: 'active' },
];

export function listGrowthBrands(): BrandRegistryEntry[] { return BRANDS.map((brand) => ({ ...brand })); }
export function getGrowthBrand(brandId: GrowthId): BrandRegistryEntry | undefined {
  const brand = BRANDS.find((item) => item.brandId === brandId);
  return brand ? { ...brand } : undefined;
}

/**
 * Compatibility exports for the canonical generated-asset contract.
 *
 * Persisted/generated assets are defined in generated-asset-resolver.ts;
 * this module intentionally does not maintain a second record or repository type.
 */
export type {
  GeneratedAssetRecord,
  GeneratedAssetRepository,
  ProviderOutput,
} from './generated-asset-resolver.js';
export { InMemoryGeneratedAssetRepository } from './generated-asset-resolver.js';

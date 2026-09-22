import type { GenerationReference } from './generation-provider';

export type ComfyUIReferenceBindingResult = {
  workflow: Record<string, unknown>;
  boundCharacterAssetIds: readonly string[];
};

function replaceToken(
  value: unknown,
  tokens: ReadonlyMap<string, { value: string; assetId?: string; isCharacterUri?: boolean }>,
  usedCharacterAssetIds: Set<string>,
): unknown {
  if (typeof value === 'string') {
    const replacement = tokens.get(value);
    if (!replacement) return value;
    if (replacement.isCharacterUri && replacement.assetId) usedCharacterAssetIds.add(replacement.assetId);
    return replacement.value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceToken(item, tokens, usedCharacterAssetIds));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, replaceToken(item, tokens, usedCharacterAssetIds)]),
    );
  }
  return value;
}

/**
 * Exact-token binding keeps arbitrary ComfyUI workflow JSON provider-owned while
 * proving Director character references actually reach image-input nodes.
 *
 * Supported tokens:
 *   {{director.reference.0.uri}}
 *   {{director.reference.character.0.uri}}
 *   {{director.reference.character.0.assetId}}
 */
export function bindComfyUIWorkflowReferences(
  workflow: Record<string, unknown>,
  references: readonly GenerationReference[],
): ComfyUIReferenceBindingResult {
  const tokens = new Map<string, { value: string; assetId?: string; isCharacterUri?: boolean }>();
  const roleCounts = new Map<GenerationReference['role'], number>();

  references.forEach((reference, index) => {
    const roleIndex = roleCounts.get(reference.role) ?? 0;
    roleCounts.set(reference.role, roleIndex + 1);

    tokens.set(`{{director.reference.${index}.assetId}}`, { value: reference.assetId });
    tokens.set(`{{director.reference.${reference.role}.${roleIndex}.assetId}}`, { value: reference.assetId });

    if (reference.uri) {
      tokens.set(`{{director.reference.${index}.uri}}`, {
        value: reference.uri,
        assetId: reference.assetId,
        isCharacterUri: reference.role === 'character',
      });
      tokens.set(`{{director.reference.${reference.role}.${roleIndex}.uri}}`, {
        value: reference.uri,
        assetId: reference.assetId,
        isCharacterUri: reference.role === 'character',
      });
    }
  });

  const usedCharacterAssetIds = new Set<string>();
  const bound = replaceToken(structuredClone(workflow), tokens, usedCharacterAssetIds) as Record<string, unknown>;
  const requiredCharacterAssetIds = references
    .filter((reference) => reference.role === 'character')
    .map((reference) => reference.assetId);

  for (const assetId of requiredCharacterAssetIds) {
    const reference = references.find((item) => item.assetId === assetId && item.role === 'character');
    if (!reference?.uri) throw new Error(`DIRECTOR_COMFYUI_CHARACTER_REFERENCE_URI_REQUIRED:${assetId}`);
    if (!usedCharacterAssetIds.has(assetId)) {
      throw new Error(`DIRECTOR_COMFYUI_CHARACTER_REFERENCE_NOT_BOUND:${assetId}`);
    }
  }

  return Object.freeze({
    workflow: bound,
    boundCharacterAssetIds: Object.freeze([...usedCharacterAssetIds]),
  });
}

export type GenerationReferenceRole =
  | 'source-video'
  | 'first-frame'
  | 'last-frame'
  | 'product-identity'
  | 'character-identity'
  | 'location'
  | 'style'
  | 'composition'
  | 'motion'
  | 'depth'
  | 'normal'
  | 'audio'
  | 'custom';

export type GenerationReferenceMedia = 'image' | 'video' | 'audio';

export interface OrderedGenerationReference {
  slot: number;
  assetId: string;
  sha256?: string;
  media: GenerationReferenceMedia;
  role: GenerationReferenceRole;
  semanticLabel: string;
  promptToken?: string;
  required: boolean;
  evidenceIds: readonly string[];
}

export interface GenerationReferenceManifest {
  id: string;
  projectId: string;
  shotId: string;
  references: readonly OrderedGenerationReference[];
  authority: 'DIRECTOR_REFERENCE_MANIFEST';
}

export interface GenerationReferenceManifestIssue {
  code:
    | 'REFERENCE_MANIFEST_IDENTITY_REQUIRED'
    | 'REFERENCE_MANIFEST_EMPTY'
    | 'REFERENCE_SLOT_INVALID'
    | 'REFERENCE_SLOT_DUPLICATE'
    | 'REFERENCE_SLOT_GAP'
    | 'REFERENCE_ASSET_DUPLICATE'
    | 'REFERENCE_SEMANTIC_LABEL_REQUIRED'
    | 'REFERENCE_EVIDENCE_REQUIRED'
    | 'REFERENCE_PROMPT_TOKEN_DUPLICATE';
  path: string;
  message: string;
}

export function validateGenerationReferenceManifest(
  manifest: GenerationReferenceManifest,
): readonly GenerationReferenceManifestIssue[] {
  const issues: GenerationReferenceManifestIssue[] = [];
  if (!manifest.id.trim() || !manifest.projectId.trim() || !manifest.shotId.trim()) {
    issues.push(issue('REFERENCE_MANIFEST_IDENTITY_REQUIRED', 'manifest', 'Reference manifest requires stable identity.'));
  }
  if (!manifest.references.length) {
    issues.push(issue('REFERENCE_MANIFEST_EMPTY', 'references', 'Reference manifest requires at least one intentional reference.'));
    return Object.freeze(issues);
  }

  const slotSet = new Set<number>();
  const assetSet = new Set<string>();
  const tokenSet = new Set<string>();
  const ordered = [...manifest.references].sort((a, b) => a.slot - b.slot);

  ordered.forEach((reference, index) => {
    const path = `references[${index}]`;
    if (!Number.isInteger(reference.slot) || reference.slot <= 0) {
      issues.push(issue('REFERENCE_SLOT_INVALID', `${path}.slot`, 'Reference slots are one-based positive integers.'));
    }
    if (slotSet.has(reference.slot)) {
      issues.push(issue('REFERENCE_SLOT_DUPLICATE', `${path}.slot`, `Duplicate reference slot: ${reference.slot}`));
    }
    slotSet.add(reference.slot);

    if (assetSet.has(reference.assetId)) {
      issues.push(issue('REFERENCE_ASSET_DUPLICATE', `${path}.assetId`, `Duplicate reference asset: ${reference.assetId}`));
    }
    assetSet.add(reference.assetId);

    if (!reference.assetId.trim() || !reference.semanticLabel.trim()) {
      issues.push(issue('REFERENCE_SEMANTIC_LABEL_REQUIRED', path, 'Each reference needs an asset ID and explicit semantic meaning.'));
    }
    if (!reference.evidenceIds.length) {
      issues.push(issue('REFERENCE_EVIDENCE_REQUIRED', `${path}.evidenceIds`, 'Each reference needs provenance/evidence.'));
    }
    if (reference.promptToken) {
      const token = reference.promptToken.trim();
      if (tokenSet.has(token)) {
        issues.push(issue('REFERENCE_PROMPT_TOKEN_DUPLICATE', `${path}.promptToken`, `Duplicate prompt token: ${token}`));
      }
      tokenSet.add(token);
    }
  });

  for (let expected = 1; expected <= ordered.length; expected += 1) {
    if (!slotSet.has(expected)) {
      issues.push(issue('REFERENCE_SLOT_GAP', 'references', `Missing reference slot: ${expected}`));
    }
  }

  return Object.freeze(issues);
}

/**
 * Creates deterministic provider-facing labels without assuming a vendor's
 * positional syntax. Adapters can translate these stable tokens to @Video1,
 * image[0], reference_images[1], etc.
 */
export function compileGenerationReferenceManifest(
  manifest: GenerationReferenceManifest,
): {
  directive: string;
  orderedAssetIds: readonly string[];
  tokenToAssetId: Readonly<Record<string, string>>;
} {
  const issues = validateGenerationReferenceManifest(manifest);
  if (issues.length) {
    throw new Error(`DIRECTOR_REFERENCE_MANIFEST_INVALID: ${issues.map((candidate) => `${candidate.code}@${candidate.path}`).join(', ')}`);
  }

  const ordered = [...manifest.references].sort((a, b) => a.slot - b.slot);
  const tokenToAssetId: Record<string, string> = {};
  const directive = ordered.map((reference) => {
    const token = reference.promptToken?.trim() || `REF_${reference.slot}`;
    tokenToAssetId[token] = reference.assetId;
    return [
      `${token} = slot ${reference.slot}`,
      `asset ${reference.assetId}`,
      `${reference.media}`,
      `role ${reference.role}`,
      `meaning "${reference.semanticLabel}"`,
      reference.required ? 'required' : 'optional',
    ].join('; ');
  }).join('\n');

  return Object.freeze({
    directive,
    orderedAssetIds: Object.freeze(ordered.map((reference) => reference.assetId)),
    tokenToAssetId: Object.freeze(tokenToAssetId),
  });
}

export function selectRelevantGenerationReferences(
  manifest: GenerationReferenceManifest,
  requiredRoles: readonly GenerationReferenceRole[],
): GenerationReferenceManifest {
  const roles = new Set(requiredRoles);
  const selected = manifest.references
    .filter((reference) => reference.required || roles.has(reference.role))
    .sort((a, b) => a.slot - b.slot)
    .map((reference, index) => ({ ...reference, slot: index + 1 }));

  return Object.freeze({
    ...manifest,
    id: `${manifest.id}:selected`,
    references: Object.freeze(selected.map((reference) => Object.freeze({
      ...reference,
      evidenceIds: Object.freeze([...reference.evidenceIds]),
    }))),
  });
}

function issue(
  code: GenerationReferenceManifestIssue['code'],
  path: string,
  message: string,
): GenerationReferenceManifestIssue {
  return { code, path, message };
}

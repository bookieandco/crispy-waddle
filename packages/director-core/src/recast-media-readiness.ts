/**
 * READ-ONLY Recast media admission. IDs supplied by the browser are hints, never
 * evidence, approval receipts or authorization to render.
 */
export type RecastMediaRole = 'footage' | 'reference' | 'audio';

export type RecastBoundMedia = Readonly<{
  id: string;
  role: RecastMediaRole;
  label: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  clean: boolean;
  ownerMatched: boolean;
}>;

export type RecastMediaSelection = Readonly<{
  sourceVideoAssetId: string;
  replacementCharacterAssetId: string;
  sourceAudioAssetId: string;
  durationSeconds: number;
}>;

export type RecastMediaReadiness = Readonly<{
  mediaVerified: boolean;
  blockers: readonly string[];
  verifiedAssetIds: readonly string[];
  readyForRender: false;
  actionAuthority: 'NONE';
  costAuthority: 'NONE';
  publicationAuthority: 'NONE';
}>;

const kind = (role: RecastMediaRole, mime: string): boolean =>
  role === 'footage' ? ['video/mp4', 'video/quicktime', 'video/webm'].includes(mime) :
    role === 'reference' ? ['image/png', 'image/jpeg', 'image/webp'].includes(mime) :
      ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'].includes(mime);

export function evaluateRecastMediaSelection(
  media: readonly RecastBoundMedia[],
  selection: RecastMediaSelection,
): RecastMediaReadiness {
  const blockers: string[] = [];
  const values = [
    ['footage', selection.sourceVideoAssetId],
    ['reference', selection.replacementCharacterAssetId],
    ['audio', selection.sourceAudioAssetId],
  ] as const;
  const uniqueIds = new Set(values.map(([, id]) => id));
  if (values.some(([, id]) => typeof id !== 'string' || !id.trim()) || uniqueIds.size !== 3) {
    blockers.push('DIRECTOR_RECAST_MEDIA_SELECTION_INVALID');
  }
  const verifiedAssetIds: string[] = [];
  for (const [role, id] of values) {
    const matches = media.filter(asset => asset.id === id && asset.role === role);
    if (matches.length !== 1) {
      blockers.push('DIRECTOR_RECAST_' + role.toUpperCase() + '_NOT_BOUND');
      continue;
    }
    const asset = matches[0];
    if (!asset.clean || !asset.ownerMatched || !kind(role, asset.mimeType.toLowerCase()) ||
      !Number.isSafeInteger(asset.sizeBytes) || asset.sizeBytes <= 0 ||
      !/^[a-f0-9]{64}$/i.test(asset.sha256)) {
      blockers.push('DIRECTOR_RECAST_' + role.toUpperCase() + '_MEDIA_UNVERIFIED');
      continue;
    }
    verifiedAssetIds.push(id);
  }
  if (!Number.isFinite(selection.durationSeconds) ||
    selection.durationSeconds <= 0 || selection.durationSeconds > 30) {
    blockers.push('DIRECTOR_RECAST_PREVIEW_DURATION_INVALID');
  }
  // The source duration is user-declared; validate it against decoded media before execution.
  const mediaVerified = blockers.length === 0;
  blockers.push(
    'DIRECTOR_RECAST_DURATION_METADATA_UNVERIFIED',
    'DIRECTOR_RECAST_CHARACTER_TRACK_APPROVAL_UNVERIFIED',
    'DIRECTOR_RECAST_VOICE_SYNC_EVIDENCE_UNVERIFIED',
    'DIRECTOR_RECAST_MEDIA_RIGHTS_UNVERIFIED',
    'DIRECTOR_RECAST_LIKENESS_CONSENT_UNVERIFIED',
    'DIRECTOR_RECAST_PREVIEW_WORKER_NOT_COMMISSIONED',
  );
  return Object.freeze({
    mediaVerified,
    blockers: Object.freeze(blockers),
    verifiedAssetIds: Object.freeze(verifiedAssetIds),
    readyForRender: false,
    actionAuthority: 'NONE',
    costAuthority: 'NONE',
    publicationAuthority: 'NONE',
  });
}

export type ArtifactInspectionVerdict = 'quarantine' | 'accept';

export type ArtifactInspectionInput = {
  declaredMediaType: string;
  detectedMediaType: string;
  filename: string;
  extension: string;
  compressedBytes: number;
  expandedBytes?: number;
  archiveEntries?: number;
  executableDetected?: boolean;
  macroDetected?: boolean;
  parserSucceeded: boolean;
};

export type ArtifactInspectionPolicy = {
  allowedMediaTypes: readonly string[];
  maxExpandedBytes: number;
  maxArchiveEntries: number;
  allowedExtensions: readonly string[];
};

export type ArtifactInspectionResult = {
  verdict: ArtifactInspectionVerdict;
  reasons: readonly string[];
};

export function inspectArtifactContent(
  input: ArtifactInspectionInput,
  policy: ArtifactInspectionPolicy,
): ArtifactInspectionResult {
  const reasons: string[] = [];
  const normalizedExtension = input.extension.toLowerCase();

  if (!policy.allowedMediaTypes.includes(input.declaredMediaType)) reasons.push('declared_media_type_denied');
  if (input.detectedMediaType !== input.declaredMediaType) reasons.push('media_type_mismatch');
  if (!policy.allowedExtensions.includes(normalizedExtension)) reasons.push('extension_denied');
  if (input.expandedBytes !== undefined && input.expandedBytes > policy.maxExpandedBytes) reasons.push('expanded_size_limit_exceeded');
  if (input.archiveEntries !== undefined && input.archiveEntries > policy.maxArchiveEntries) reasons.push('archive_entry_limit_exceeded');
  if (input.executableDetected) reasons.push('executable_content_detected');
  if (input.macroDetected) reasons.push('macro_content_detected');
  if (!input.parserSucceeded) reasons.push('parser_validation_failed');
  if (input.filename.includes('..') || input.filename.includes('/') || input.filename.includes('\\')) reasons.push('unsafe_filename');

  return { verdict: reasons.length ? 'quarantine' : 'accept', reasons };
}

export const DEFAULT_ARTIFACT_INSPECTION_POLICY: ArtifactInspectionPolicy = {
  allowedMediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'audio/wav', 'audio/mpeg', 'video/mp4', 'application/json', 'text/plain'],
  maxExpandedBytes: 4 * 1024 * 1024 * 1024,
  maxArchiveEntries: 10_000,
  allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.wav', '.mp3', '.mp4', '.json', '.txt'],
};

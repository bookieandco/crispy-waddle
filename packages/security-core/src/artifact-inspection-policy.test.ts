import { describe, expect, it } from 'vitest';
import { DEFAULT_ARTIFACT_INSPECTION_POLICY, inspectArtifactContent } from './artifact-inspection-policy.js';

const base = {
  declaredMediaType: 'image/png', detectedMediaType: 'image/png', filename: 'render.png', extension: '.png',
  compressedBytes: 1000, expandedBytes: 2000, archiveEntries: 1, executableDetected: false,
  macroDetected: false, parserSucceeded: true,
};

describe('artifact content inspection', () => {
  it('accepts a matching safe artifact', () => expect(inspectArtifactContent(base, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('accept'));
  it('rejects content-type confusion', () => expect(inspectArtifactContent({ ...base, detectedMediaType: 'application/x-executable' }, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('quarantine'));
  it('rejects executables and macros', () => {
    expect(inspectArtifactContent({ ...base, executableDetected: true }, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('quarantine');
    expect(inspectArtifactContent({ ...base, macroDetected: true }, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('quarantine');
  });
  it('rejects archive bombs by expanded size or entry count', () => {
    expect(inspectArtifactContent({ ...base, expandedBytes: DEFAULT_ARTIFACT_INSPECTION_POLICY.maxExpandedBytes + 1 }, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('quarantine');
    expect(inspectArtifactContent({ ...base, archiveEntries: DEFAULT_ARTIFACT_INSPECTION_POLICY.maxArchiveEntries + 1 }, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('quarantine');
  });
  it('rejects unsafe filenames and parser failures', () => {
    expect(inspectArtifactContent({ ...base, filename: '../render.png' }, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('quarantine');
    expect(inspectArtifactContent({ ...base, parserSucceeded: false }, DEFAULT_ARTIFACT_INSPECTION_POLICY).verdict).toBe('quarantine');
  });
});

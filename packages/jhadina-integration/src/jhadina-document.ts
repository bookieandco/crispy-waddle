import type { CreatorProject, JhadinaDocument, ProjectAsset } from './creator-workstation';

export interface CompleteDocumentFile {
  path: string;
  content: string | Uint8Array;
  mimeType: string;
}

export interface CompleteJhadinaExport {
  filename: string;
  document: JhadinaDocument;
  files: readonly CompleteDocumentFile[];
}

/** Creates the logical contents of a portable .jhadina package. A ZIP writer can consume these files. */
export function createCompleteJhadinaExport(project: CreatorProject): CompleteJhadinaExport {
  const document = {
    format: 'jhadina' as const,
    schemaVersion: 1 as const,
    exportedAt: new Date().toISOString(),
    project: structuredClone(project),
    assets: structuredClone(project.assets),
    manifest: {
      files: [
        { path: 'project.json', mimeType: 'application/json' },
        { path: 'manifest.json', mimeType: 'application/json' },
        ...project.assets.map((asset) => ({ path: `assets/${asset.id}/${asset.name}`, assetId: asset.id, mimeType: asset.mimeType })),
      ],
      instructions: 'Restore project.json and manifest.json first, then resolve asset URIs. Preserve IDs, versions and metadata for continuity and regeneration.',
    },
  } satisfies JhadinaDocument;

  const files: CompleteDocumentFile[] = [
    { path: 'project.json', content: JSON.stringify(document.project, null, 2), mimeType: 'application/json' },
    { path: 'manifest.json', content: JSON.stringify(document, null, 2), mimeType: 'application/json' },
    { path: 'README.md', content: createReadme(project), mimeType: 'text/markdown' },
  ];

  return { filename: `${safeName(project.name)}.jhadina`, document, files };
}

function createReadme(project: CreatorProject): string {
  return `# ${project.name}\n\n- Domain: ${project.domain}\n- Version: ${project.version}\n- Status: ${project.status}\n- Assets: ${project.assets.length}\n- Scenes: ${project.scenes.length}\n\nOpen \\`project.json\\` for the project graph and \\`manifest.json\\` for the complete export manifest.\n`;
}

function safeName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled-project';
}

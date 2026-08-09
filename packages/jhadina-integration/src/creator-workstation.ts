import type { DomainId, JhadinaProject } from './contracts';
import type { ActionAdapter, ExecutionContext } from './action-executor';

export type AssetKind = 'video' | 'audio' | 'image' | 'script' | 'storyboard' | 'document' | 'other';

export interface ProjectAsset {
  id: string;
  projectId: string;
  name: string;
  kind: AssetKind;
  mimeType: string;
  uri: string;
  sha256?: string;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SceneTake {
  id: string;
  sceneId: string;
  takeNumber: number;
  status: 'candidate' | 'selected' | 'rejected';
  continuity?: { priorTakeId?: string; notes?: string };
  recipe?: Record<string, unknown>;
  assetIds: string[];
}

export interface CreatorProject extends JhadinaProject {
  domain: 'creator-workstation' | 'directoros';
  description?: string;
  assets: ProjectAsset[];
  scenes: Array<{ id: string; title: string; order: number; summary?: string; takeIds: string[] }>;
}

export class InMemoryCreatorProjectStore {
  private readonly projects = new Map<string, CreatorProject>();

  create(name: string, domain: 'creator-workstation' | 'directoros' = 'creator-workstation'): CreatorProject {
    const now = new Date().toISOString();
    const project: CreatorProject = {
      id: crypto.randomUUID(), name, domain, version: 1, status: 'draft',
      createdAt: now, updatedAt: now, metadata: {}, assets: [], scenes: [],
    };
    this.projects.set(project.id, project);
    return structuredClone(project);
  }

  get(id: string): CreatorProject | undefined {
    const project = this.projects.get(id);
    return project ? structuredClone(project) : undefined;
  }

  addAsset(projectId: string, asset: Omit<ProjectAsset, 'projectId' | 'version' | 'createdAt' | 'updatedAt'>): ProjectAsset {
    const project = this.require(projectId);
    const now = new Date().toISOString();
    const stored = { ...asset, projectId, version: 1, createdAt: now, updatedAt: now };
    project.assets.push(stored);
    project.version += 1;
    project.updatedAt = now;
    return structuredClone(stored);
  }

  addScene(projectId: string, scene: { id?: string; title: string; summary?: string }): CreatorProject {
    const project = this.require(projectId);
    project.scenes.push({ id: scene.id ?? crypto.randomUUID(), title: scene.title, order: project.scenes.length + 1, summary: scene.summary, takeIds: [] });
    project.version += 1;
    project.updatedAt = new Date().toISOString();
    return structuredClone(project);
  }

  approve(projectId: string): CreatorProject {
    const project = this.require(projectId);
    project.status = 'approved';
    project.version += 1;
    project.updatedAt = new Date().toISOString();
    return structuredClone(project);
  }

  private require(id: string): CreatorProject {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project not found: ${id}`);
    return project;
  }
}

export interface JhadinaDocument {
  format: 'jhadina';
  schemaVersion: 1;
  exportedAt: string;
  project: CreatorProject;
  assets: ProjectAsset[];
  manifest: {
    files: Array<{ path: string; assetId?: string; mimeType?: string }>;
    instructions: string;
  };
}

export function exportJhadinaDocument(project: CreatorProject): JhadinaDocument {
  return {
    format: 'jhadina',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: structuredClone(project),
    assets: structuredClone(project.assets),
    manifest: {
      files: [
        { path: 'project.json', mimeType: 'application/json' },
        ...project.assets.map((asset) => ({ path: `assets/${asset.id}/${asset.name}`, assetId: asset.id, mimeType: asset.mimeType })),
      ],
      instructions: 'Open project.json to restore project structure. Resolve asset URIs from the asset manifest; preserve IDs and versions for regeneration and audit continuity.',
    },
  };
}

export interface CreatorActionInput {
  projectId: string;
  name?: string;
  description?: string;
  asset?: Omit<ProjectAsset, 'projectId' | 'version' | 'createdAt' | 'updatedAt'>;
}

export function createCreatorWorkstationAdapters(store: InMemoryCreatorProjectStore): ActionAdapter[] {
  const adapter = (domain: DomainId, capability: string, execute: (input: CreatorActionInput, context: ExecutionContext) => Promise<unknown>): ActionAdapter => ({ domain, capability, execute });
  return [
    adapter('creator-workstation', 'project.create', async (input) => store.create(input.name ?? 'Untitled Project')),
    adapter('directoros', 'project.create', async (input) => store.create(input.name ?? 'Untitled Director Project', 'directoros')),
    adapter('creator-workstation', 'asset.import', async (input) => {
      if (!input.asset) throw new Error('asset is required');
      return store.addAsset(input.projectId, input.asset);
    }),
    adapter('creator-workstation', 'project.export', async (input) => {
      const project = store.get(input.projectId);
      if (!project) throw new Error(`Project not found: ${input.projectId}`);
      return exportJhadinaDocument(project);
    }),
    adapter('directoros', 'project.export', async (input) => {
      const project = store.get(input.projectId);
      if (!project) throw new Error(`Project not found: ${input.projectId}`);
      return exportJhadinaDocument(project);
    }),
  ];
}

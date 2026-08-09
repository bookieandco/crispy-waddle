import type { CreatorProject, InMemoryCreatorProjectStore, ProjectAsset } from './creator-workstation';

export interface ProjectStore {
  create(name: string, domain?: 'creator-workstation' | 'directoros'): CreatorProject;
  get(id: string): CreatorProject | undefined;
  addAsset(projectId: string, asset: Omit<ProjectAsset, 'projectId' | 'version' | 'createdAt' | 'updatedAt'>): ProjectAsset;
  addScene(projectId: string, scene: { id?: string; title: string; summary?: string }): CreatorProject;
  approve(projectId: string): CreatorProject;
}

export function asProjectStore(store: InMemoryCreatorProjectStore): ProjectStore {
  return store;
}

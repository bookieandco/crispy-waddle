export type ResearchItemKind = "source" | "note" | "citation" | "idea";
export interface ResearchItem { id: string; kind: ResearchItemKind; title: string; excerpt?: string; sourceUrl?: string; tags: string[]; createdAt: string; }
export interface LibraryAsset { id: string; name: string; type: "manuscript" | "cover" | "image" | "reference" | "export"; status: "draft" | "ready" | "archived"; }
export interface PublishingProjectLibrary { projectId: string; research: ResearchItem[]; assets: LibraryAsset[]; }

export function createResearchItem(input: Omit<ResearchItem, "id" | "createdAt">): ResearchItem {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export function createProjectLibrary(projectId: string, initial: Partial<Omit<PublishingProjectLibrary, "projectId">> = {}): PublishingProjectLibrary {
  return { projectId, research: initial.research ?? [], assets: initial.assets ?? [] };
}

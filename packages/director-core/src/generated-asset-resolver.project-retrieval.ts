export type ProjectGeneratedAssetRetrieval = {
  listByProject(projectId: string): Promise<import('./generated-asset-resolver').GeneratedAssetRecord[]>;
};

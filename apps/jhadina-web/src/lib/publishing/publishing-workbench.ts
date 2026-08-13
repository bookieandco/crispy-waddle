export type PublishingTool =
  | "editor"
  | "visual-editor"
  | "research"
  | "library"
  | "reader"
  | "convert"
  | "proof"
  | "metadata"
  | "kdp"
  | "digital-store"
  | "pod"
  | "analytics";

export interface PublishingWorkbench {
  projectId: string;
  tools: PublishingTool[];
  sourceAssets: string[];
  outputFormats: ("epub" | "pdf" | "html" | "mobi" | "docx" | "print")[];
  researchLinks: string[];
  distributionChannels: string[];
}

export const DEFAULT_PUBLISHING_WORKBENCH: Omit<PublishingWorkbench, "projectId"> = {
  tools: ["editor", "visual-editor", "research", "library", "reader", "convert", "proof", "metadata", "kdp", "digital-store", "pod", "analytics"],
  sourceAssets: [],
  outputFormats: ["epub", "pdf", "html", "docx", "print"],
  researchLinks: [],
  distributionChannels: ["kdp", "digital-store", "pod"],
};

export function createPublishingWorkbench(projectId: string, overrides: Partial<Omit<PublishingWorkbench, "projectId">> = {}): PublishingWorkbench {
  return { projectId, ...DEFAULT_PUBLISHING_WORKBENCH, ...overrides };
}

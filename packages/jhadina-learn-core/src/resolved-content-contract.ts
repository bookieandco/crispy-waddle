export type ResolvedContentType = "text" | "document" | "image" | "video" | "webpage" | "mixed";

export interface ContentProvenance {
  sourceType: "text" | "file" | "video" | "url";
  sourceValue: string;
  title?: string;
  mimeType?: string;
  locator?: string;
}

export interface ResolvedLearningContent {
  type: ResolvedContentType;
  title?: string;
  text?: string;
  transcript?: string;
  metadata: Record<string, unknown>;
  provenance: ContentProvenance[];
}

export interface LearningSourceResolver {
  supports(source: {
    type: "text" | "file" | "video" | "url";
    value: string;
    mimeType?: string;
  }): boolean;

  resolve(source: {
    type: "text" | "file" | "video" | "url";
    value: string;
    title?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ResolvedLearningContent>;
}

export interface LearningContentResolver {
  resolveAll(sources: Array<{
    type: "text" | "file" | "video" | "url";
    value: string;
    title?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }>): Promise<ResolvedLearningContent[]>;
}

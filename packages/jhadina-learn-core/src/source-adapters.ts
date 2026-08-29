import type { LearningSourceResolver, ResolvedLearningContent } from "./resolved-content-contract";

type LearningSource = {
  type: "text" | "file" | "video" | "url";
  value: string;
  title?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
};

export interface ExternalContentFetcher {
  fetch(input: { url: string }): Promise<{
    text?: string;
    title?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface FileContentExtractor {
  extract(input: { reference: string; mimeType?: string }): Promise<{
    text?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface VideoContentExtractor {
  extract(input: { reference: string; metadata?: Record<string, unknown> }): Promise<{
    transcript?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export class FileLearningSourceResolver implements LearningSourceResolver {
  constructor(private readonly extractor: FileContentExtractor) {}

  supports(source: LearningSource): boolean {
    return source.type === "file";
  }

  async resolve(source: LearningSource): Promise<ResolvedLearningContent> {
    const extracted = await this.extractor.extract({ reference: source.value, mimeType: source.mimeType });
    return {
      type: "document",
      title: source.title,
      text: extracted.text,
      metadata: { ...source.metadata, ...extracted.metadata },
      provenance: [{ sourceType: "file", sourceValue: source.value, title: source.title, mimeType: source.mimeType }],
    };
  }
}

export class WebLearningSourceResolver implements LearningSourceResolver {
  constructor(private readonly fetcher: ExternalContentFetcher) {}

  supports(source: LearningSource): boolean {
    return source.type === "url";
  }

  async resolve(source: LearningSource): Promise<ResolvedLearningContent> {
    const fetched = await this.fetcher.fetch({ url: source.value });
    return {
      type: "webpage",
      title: fetched.title ?? source.title,
      text: fetched.text,
      metadata: { ...source.metadata, ...fetched.metadata },
      provenance: [{ sourceType: "url", sourceValue: source.value, title: fetched.title ?? source.title, mimeType: fetched.mimeType }],
    };
  }
}

export class VideoLearningSourceResolver implements LearningSourceResolver {
  constructor(private readonly extractor: VideoContentExtractor) {}

  supports(source: LearningSource): boolean {
    return source.type === "video";
  }

  async resolve(source: LearningSource): Promise<ResolvedLearningContent> {
    const extracted = await this.extractor.extract({ reference: source.value, metadata: source.metadata });
    return {
      type: "video",
      title: source.title,
      transcript: extracted.transcript,
      metadata: { ...source.metadata, ...extracted.metadata },
      provenance: [{ sourceType: "video", sourceValue: source.value, title: source.title }],
    };
  }
}

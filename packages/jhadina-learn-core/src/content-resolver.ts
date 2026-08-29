import type { LearningContentResolver, LearningSourceResolver, ResolvedLearningContent } from "./resolved-content-contract";

export class DefaultLearningContentResolver implements LearningContentResolver {
  constructor(private readonly resolvers: LearningSourceResolver[]) {}

  async resolveAll(sources: Parameters<LearningContentResolver["resolveAll"]>[0]): Promise<ResolvedLearningContent[]> {
    return Promise.all(sources.map(async (source) => {
      const resolver = this.resolvers.find((candidate) => candidate.supports(source));
      if (!resolver) {
        throw new Error(`No learning source resolver supports ${source.type}.`);
      }
      return resolver.resolve(source);
    }));
  }
}

export class TextLearningSourceResolver implements LearningSourceResolver {
  supports(source: { type: "text" | "file" | "video" | "url" }): boolean {
    return source.type === "text";
  }

  async resolve(source: { type: "text" | "file" | "video" | "url"; value: string; title?: string }): Promise<ResolvedLearningContent> {
    return {
      type: "text",
      title: source.title,
      text: source.value,
      metadata: {},
      provenance: [{ sourceType: "text", sourceValue: source.value, title: source.title }],
    };
  }
}

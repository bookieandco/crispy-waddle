import type { LearnRequest, LearningRecord } from "./learning-contract";
import type { ExperienceRecord, LearningExperienceFactory } from "./experience-contract";
import type { LearningContentResolver, ResolvedLearningContent } from "./resolved-content-contract";

export class ResolvedContentExperienceFactory implements LearningExperienceFactory {
  constructor(private readonly resolver: LearningContentResolver) {}

  async createExperience(input: {
    learning: LearningRecord;
    request: LearnRequest;
  }): Promise<Pick<ExperienceRecord, "content" | "title">> {
    const resolved = await this.resolver.resolveAll(input.request.sources);
    return {
      title: resolved.find((item) => item.title)?.title ?? input.learning.subject,
      content: mergeResolvedContent(resolved),
    };
  }
}

function mergeResolvedContent(items: ResolvedLearningContent[]): ResolvedLearningContent {
  return {
    type: items.length === 1 ? items[0].type : "mixed",
    title: items.find((item) => item.title)?.title,
    text: items.map((item) => item.text).filter(Boolean).join("\n\n"),
    transcript: items.map((item) => item.transcript).filter(Boolean).join("\n\n"),
    metadata: Object.assign({}, ...items.map((item) => item.metadata)),
    provenance: items.flatMap((item) => item.provenance),
  };
}

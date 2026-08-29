import { LearnRequest, LearningSource, LearningSourceType } from "./learning-contract";

const URL_PATTERN = /^https?:\/\//i;

export function normalizeLearningSource(input: string | LearningSource): LearningSource {
  if (typeof input !== "string") return input;

  const value = input.trim();
  if (!value) throw new Error("Learning source cannot be empty.");

  return {
    type: URL_PATTERN.test(value) ? "url" : "text",
    value,
  };
}

export function normalizeLearnRequest(
  instruction: string | undefined,
  sources: Array<string | LearningSource> = [],
): LearnRequest {
  return {
    instruction: instruction?.trim() || undefined,
    sources: sources.map(normalizeLearningSource),
  };
}

export function assertSupportedSourceType(type: LearningSourceType): void {
  if (!["text", "file", "video", "url"].includes(type)) {
    throw new Error(`Unsupported learning source type: ${type}`);
  }
}

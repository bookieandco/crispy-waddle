import { describe, expect, it } from "vitest";
import { InMemoryLearningRepository } from "./in-memory-learning-repository";
import { LearningBoundary } from "./learning-boundary";
import { LearnRequest, LearningEvent } from "./learning-contract";

const request: LearnRequest = {
  instruction: "Treat this as a Money Action workflow.",
  sources: [
    { type: "file", value: "file://example.pdf", title: "Example PDF" },
    { type: "video", value: "https://example.com/video" },
    { type: "url", value: "https://example.com/reference" },
  ],
};

describe("LearningBoundary", () => {
  it("accepts explicit teaching with files, videos, and hyperlinks", async () => {
    const repository = new InMemoryLearningRepository();
    const events: LearningEvent[] = [];
    const boundary = new LearningBoundary(
      repository,
      {
        async classify() {
          return {
            kind: "rule",
            subject: "Money Action workflow",
            content: request.instruction,
            confidence: 1,
            appliesTo: ["money"] as string[],
          };
        },
      },
      { async emit(event) { events.push(event); } },
    );

    const record = await boundary.learn(request);

    expect(record.authority).toBe("user");
    expect(record.status).toBe("proposed");
    expect(record.sources.map((source) => source.type)).toEqual(["file", "video", "url"]);
    expect(events.map((event) => event.type)).toEqual([
      "LEARNING_REQUESTED",
      "LEARNING_ACCEPTED",
    ]);
  });

  it("rejects an empty teaching request", async () => {
    const boundary = new LearningBoundary(
      new InMemoryLearningRepository(),
      { async classify() { throw new Error("should not classify"); } },
      { async emit() {} },
    );

    await expect(boundary.learn({ sources: [] })).rejects.toThrow(
      "requires an instruction or at least one source",
    );
  });
});

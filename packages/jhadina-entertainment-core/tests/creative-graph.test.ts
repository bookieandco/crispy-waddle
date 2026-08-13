import { test, expect } from "vitest";
import {
  InMemoryCreativeGraphRepository,
  CreativeKnowledgeGraph,
  ReferenceMatchEngine,
  CreativeReviewEngine,
  InMemoryReviewFeedbackRepository,
  ReviewCalibrationEngine,
  createReviewFeedbackEvent,
  type CreativeNode,
} from "../src/index";

function node(overrides: Partial<CreativeNode> = {}): CreativeNode {
  return { id: "song-1", type: "song", label: "Song One", ...overrides };
}

test("CreativeKnowledgeGraph connects nodes and returns neighbors", async () => {
  const repo = new InMemoryCreativeGraphRepository();
  const graph = new CreativeKnowledgeGraph(repo);
  const song = node();
  const artist = node({ id: "artist-1", type: "artist", label: "Artist One" });
  await graph.registerNode(song);
  await graph.registerNode(artist);
  await graph.connect(song, artist, "created_by", ["ev-1"]);

  const neighbors = await graph.neighbors(song.id);
  expect(neighbors).toHaveLength(1);
  expect(neighbors[0].id).toBe(artist.id);

  const explanation = await graph.explain(song.id);
  expect(explanation).toHaveLength(1);
  expect(explanation[0].type).toBe("created_by");
});

test("ReferenceMatchEngine scores and ranks related nodes", async () => {
  const repo = new InMemoryCreativeGraphRepository();
  const graph = new CreativeKnowledgeGraph(repo);
  const song = node();
  const styleA = node({ id: "style-a", type: "visual_style", label: "Style A" });
  const styleB = node({ id: "style-b", type: "technique", label: "Style B" });
  await graph.registerNode(song);
  await graph.registerNode(styleA);
  await graph.registerNode(styleB);
  await graph.connect(song, styleA, "similar_to", [], 3);
  await graph.connect(song, styleB, "uses", [], 1);

  const engine = new ReferenceMatchEngine(repo);
  const matches = await engine.findMatches({ workNodeId: song.id, preferredNodeTypes: ["visual_style"] });

  expect(matches[0].reference.id).toBe(styleA.id);
  expect(matches[0].score).toBeGreaterThan(matches[1].score);
});

test("CreativeReviewEngine builds strengths/opportunities from graph relations", async () => {
  const repo = new InMemoryCreativeGraphRepository();
  const graph = new CreativeKnowledgeGraph(repo);
  const work = node();
  const good = node({ id: "good-1", type: "technique", label: "Good technique" });
  const bad = node({ id: "bad-1", type: "technique", label: "Weak technique" });
  await graph.registerNode(work);
  await graph.registerNode(good);
  await graph.registerNode(bad);
  await graph.connect(work, good, "supports");
  await graph.connect(work, bad, "conflicts_with");

  const reviewEngine = new CreativeReviewEngine(repo, new ReferenceMatchEngine(repo));
  const review = await reviewEngine.review({ workNodeId: work.id });

  expect(review.strengths).toHaveLength(1);
  expect(review.opportunities).toHaveLength(1);
  expect(review.strengths[0].feature).toBe(good.label);
  expect(review.opportunities[0].feature).toBe(bad.label);
});

test("CreativeReviewEngine throws for an unknown work node", async () => {
  const repo = new InMemoryCreativeGraphRepository();
  const reviewEngine = new CreativeReviewEngine(repo, new ReferenceMatchEngine(repo));
  await expect(reviewEngine.review({ workNodeId: "missing" })).rejects.toThrow();
});

test("ReviewCalibrationEngine tallies feedback signals per feature", async () => {
  const repo = new InMemoryReviewFeedbackRepository();
  const engine = new ReviewCalibrationEngine(repo);
  await engine.record({ id: "f1", reviewId: "r1", signal: "positive", targetFeature: "pacing", createdAt: new Date().toISOString(), source: "user" });
  await engine.record({ id: "f2", reviewId: "r1", signal: "negative", targetFeature: "pacing", createdAt: new Date().toISOString(), source: "user" });
  await engine.record({ id: "f3", reviewId: "r1", signal: "positive", targetFeature: "pacing", createdAt: new Date().toISOString(), source: "user" });

  const calibration = await engine.calibrate("r1", "pacing");
  expect(calibration.positive).toBe(2);
  expect(calibration.negative).toBe(1);
  expect(calibration.confidence).toBeCloseTo(2 / 3, 9);
});

test("createReviewFeedbackEvent shapes a governed event", () => {
  const event = createReviewFeedbackEvent("f1", "r1", "positive");
  expect(event.type).toBe("CREATIVE_REVIEW_FEEDBACK_RECORDED");
  expect(event.source).toBe("jei");
  expect(event.payload).toEqual({ feedbackId: "f1", reviewId: "r1", signal: "positive" });
});

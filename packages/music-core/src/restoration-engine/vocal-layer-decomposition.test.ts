import { describe, expect, it } from "vitest";
import type { DeepStemDecomposition, DeepStemNode } from "./deep-stem-decomposition.js";
import { buildVocalLayerDecomposition } from "./vocal-layer-decomposition.js";

const node: DeepStemNode = {
  id: "adlib", sourceArtifactId: "source", kind: "sub-stem", label: "ad-lib",
  region: { startSample: 0, endSample: 48000 }, sampleRate: 48000,
  modelId: "separator", modelVersion: "1", sourceKind: "recursive-separation",
  confidence: 0.8, evidenceIds: ["evidence"], provenanceIds: ["provenance"], canonicalSource: false,
};
const decomposition: DeepStemDecomposition = {
  id: "deep", sourceArtifactId: "source", rootId: "root", nodes: [node],
  maxDepth: 2, confidence: 0.8, evidenceIds: ["evidence"], abstained: false, reasons: [],
};

describe("vocal layer decomposition", () => {
  it("uses the supplied decomposition and excludes other source artifacts", () => {
    const result = buildVocalLayerDecomposition({ id: "vocal", sourceArtifactId: "source",
      decomposition: { ...decomposition, nodes: [node, { ...node, id: "other", sourceArtifactId: "other" }] },
    });
    expect(result.observations).toHaveLength(1);
    expect(result.adLibIds).toEqual(["vocal-layer:adlib"]);
    expect(result.confidence).toBe(0.8);
    expect(result.abstained).toBe(false);
  });

  it("retains parent abstention and abstains when no vocal evidence exists", () => {
    expect(buildVocalLayerDecomposition({ id: "vocal", sourceArtifactId: "source",
      decomposition: { ...decomposition, abstained: true },
    }).abstained).toBe(true);
    const empty = buildVocalLayerDecomposition({ id: "vocal", sourceArtifactId: "source",
      decomposition: { ...decomposition, nodes: [] },
    });
    expect(empty.abstained).toBe(true);
    expect(empty.confidence).toBe(0);
  });
});

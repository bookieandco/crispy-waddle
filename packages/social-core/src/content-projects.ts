import type { JhadinaBrand, SocialPlatform } from "./types.js";

export type ContentOrigin =
  | "human_spoken"
  | "human_written"
  | "interview"
  | "customer_evidence"
  | "operational_evidence"
  | "research_synthesis"
  | "ai_generated";

export type ContentJob = "trust" | "reach" | "useful" | "conversion";

export type ContentAssetKind =
  | "anchor_video"
  | "live"
  | "short_video"
  | "image"
  | "carousel"
  | "text_post"
  | "article"
  | "newsletter"
  | "thread"
  | "ad";

export type ContentTransformation =
  | "original"
  | "condensed"
  | "excerpted"
  | "reframed"
  | "platform_adapted"
  | "translated";

export interface ContentAsset {
  id: string;
  kind: ContentAssetKind;
  platform?: SocialPlatform;
  transformation: ContentTransformation;
  parentAssetId?: string;
  text?: string;
  mediaRefs: readonly string[];
  evidenceRefs: readonly string[];
}

export interface ContentProject {
  id: string;
  brand: JhadinaBrand;
  authorityPositionRef: string;
  pillarRef: string;
  bigIdeaRef: string;
  primaryJob: ContentJob;
  origin: ContentOrigin;
  humanSourceRefs: readonly string[];
  evidenceRefs: readonly string[];
  assets: readonly ContentAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentProjectInput {
  id: string;
  brand: JhadinaBrand;
  authorityPositionRef: string;
  pillarRef: string;
  bigIdeaRef: string;
  primaryJob: ContentJob;
  origin: ContentOrigin;
  humanSourceRefs?: readonly string[];
  evidenceRefs: readonly string[];
  anchor: ContentAsset;
  createdAt: string;
}

export function createContentProject(input: CreateContentProjectInput): ContentProject {
  if (!input.id.trim()) throw new Error("SOCIAL_CONTENT_PROJECT_ID_REQUIRED");
  if (!input.authorityPositionRef.trim()) throw new Error("SOCIAL_AUTHORITY_POSITION_REQUIRED");
  if (!input.pillarRef.trim()) throw new Error("SOCIAL_CONTENT_PILLAR_REQUIRED");
  if (!input.bigIdeaRef.trim()) throw new Error("SOCIAL_BIG_IDEA_REQUIRED");
  if (!input.evidenceRefs.length) throw new Error("SOCIAL_CONTENT_EVIDENCE_REQUIRED");
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error("SOCIAL_CONTENT_CREATED_AT_INVALID");
  if (input.anchor.parentAssetId) throw new Error("SOCIAL_ANCHOR_CANNOT_HAVE_PARENT");
  if (input.anchor.transformation !== "original") throw new Error("SOCIAL_ANCHOR_MUST_BE_ORIGINAL");
  assertAsset(input.anchor);

  const humanRefs = [...(input.humanSourceRefs ?? [])];
  if (input.origin !== "ai_generated" && humanRefs.length === 0 && input.origin !== "operational_evidence" && input.origin !== "research_synthesis") {
    throw new Error("SOCIAL_HUMAN_ORIGIN_REFERENCE_REQUIRED");
  }

  return Object.freeze({
    id: input.id,
    brand: input.brand,
    authorityPositionRef: input.authorityPositionRef,
    pillarRef: input.pillarRef,
    bigIdeaRef: input.bigIdeaRef,
    primaryJob: input.primaryJob,
    origin: input.origin,
    humanSourceRefs: Object.freeze(humanRefs),
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    assets: Object.freeze([freezeAsset(input.anchor)]),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function addContentDerivative(
  project: ContentProject,
  asset: ContentAsset,
  updatedAt: string,
): ContentProject {
  if (!Number.isFinite(Date.parse(updatedAt))) throw new Error("SOCIAL_CONTENT_UPDATED_AT_INVALID");
  if (project.assets.some((candidate) => candidate.id === asset.id)) {
    throw new Error("SOCIAL_CONTENT_ASSET_DUPLICATE");
  }
  if (!asset.parentAssetId || !project.assets.some((candidate) => candidate.id === asset.parentAssetId)) {
    throw new Error("SOCIAL_CONTENT_PARENT_REQUIRED");
  }
  if (asset.transformation === "original") throw new Error("SOCIAL_DERIVATIVE_TRANSFORMATION_REQUIRED");
  assertAsset(asset);
  return Object.freeze({
    ...project,
    assets: Object.freeze([...project.assets, freezeAsset(asset)]),
    updatedAt,
  });
}

export function contentLineage(project: ContentProject, assetId: string): readonly string[] {
  const byId = new Map(project.assets.map((asset) => [asset.id, asset] as const));
  const lineage: string[] = [];
  let current = byId.get(assetId);
  if (!current) throw new Error("SOCIAL_CONTENT_ASSET_NOT_FOUND");
  while (current) {
    if (lineage.includes(current.id)) throw new Error("SOCIAL_CONTENT_LINEAGE_CYCLE");
    lineage.unshift(current.id);
    current = current.parentAssetId ? byId.get(current.parentAssetId) : undefined;
  }
  return Object.freeze(lineage);
}

function assertAsset(asset: ContentAsset): void {
  if (!asset.id.trim()) throw new Error("SOCIAL_CONTENT_ASSET_ID_REQUIRED");
  if (!asset.evidenceRefs.length) throw new Error("SOCIAL_CONTENT_ASSET_EVIDENCE_REQUIRED");
  if (!asset.text?.trim() && !asset.mediaRefs.length) throw new Error("SOCIAL_CONTENT_ASSET_BODY_REQUIRED");
}

function freezeAsset(asset: ContentAsset): ContentAsset {
  return Object.freeze({
    ...asset,
    mediaRefs: Object.freeze([...asset.mediaRefs]),
    evidenceRefs: Object.freeze([...asset.evidenceRefs]),
  });
}

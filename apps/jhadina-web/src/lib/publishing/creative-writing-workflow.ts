export type CreativeMode = "fiction" | "nonfiction" | "screenplay" | "lyrics" | "hybrid";
export type WritingStage = "idea" | "research" | "outline" | "draft" | "revision" | "continuity" | "proof" | "publish";

export interface CreativeWritingProject {
  id: string;
  title: string;
  mode: CreativeMode;
  stage: WritingStage;
  researchBriefIds: string[];
  storyBibleId?: string;
  publishingProductId?: string;
  nextActions: string[];
}

export const CREATIVE_WRITING_MODES: Array<{ id: CreativeMode; label: string; description: string }> = [
  { id: "fiction", label: "Fiction", description: "Invented stories informed by optional verified knowledge." },
  { id: "nonfiction", label: "Nonfiction", description: "Evidence-first writing with explicit source provenance." },
  { id: "screenplay", label: "Screenplay", description: "Scene, dialogue and screenplay-format storytelling." },
  { id: "lyrics", label: "Lyrics", description: "Songwriting with structure, meter and creative direction." },
  { id: "hybrid", label: "Hybrid", description: "Creative work combining factual research and imaginative material." },
];

export function createCreativeWritingProject(input: Omit<CreativeWritingProject, "id" | "nextActions">): CreativeWritingProject {
  return { ...input, id: crypto.randomUUID(), nextActions: ["define premise", "build outline"] };
}

export function advanceWritingStage(project: CreativeWritingProject, stage: WritingStage): CreativeWritingProject {
  const nextActions: Record<WritingStage, string[]> = {
    idea: ["define premise", "choose creative mode"],
    research: ["collect sources", "identify evidence gaps"],
    outline: ["build structure", "review story bible"],
    draft: ["write next section", "track continuity"],
    revision: ["revise prose", "check character and plot consistency"],
    continuity: ["run continuity review", "resolve canon conflicts"],
    proof: ["proof manuscript", "prepare formats"],
    publish: ["review metadata", "approve distribution"],
  };
  return { ...project, stage, nextActions: nextActions[stage] };
}

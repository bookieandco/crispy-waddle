export interface CreativeProvenance {
  projectId: string;
  storyboardBoardIds: string[];
  storyboardVersion: number;
  generationStageId: string;
  generationStageVersion: number;
  generationJobId: string;
}

export function sameCreativeProvenance(a: CreativeProvenance, b: CreativeProvenance): boolean {
  return (
    a.projectId === b.projectId &&
    a.storyboardVersion === b.storyboardVersion &&
    a.generationStageId === b.generationStageId &&
    a.generationStageVersion === b.generationStageVersion &&
    a.generationJobId === b.generationJobId &&
    sameIds(a.storyboardBoardIds, b.storyboardBoardIds)
  );
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.every((id, index) => id === right[index]);
}

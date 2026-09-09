export type CreativeStageStatus = 'planned' | 'ready' | 'running' | 'review' | 'approved' | 'stale' | 'failed';

export type CreativeStageKind =
  | 'vision'
  | 'treatment'
  | 'storyboard'
  | 'shotlist'
  | 'previs'
  | 'generation'
  | 'edit'
  | 'review'
  | 'final';

export interface CreativeStage {
  id: string;
  projectId: string;
  kind: CreativeStageKind;
  dependsOn: string[];
  status: CreativeStageStatus;
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  version: number;
  approvedAt?: string;
  approvedBy?: string;
}

export interface StageArtifactVersion {
  artifactId: string;
  stageId: string;
  version: number;
  sha256?: string;
  createdAt: string;
}

export interface StageInvalidation {
  stageId: string;
  reason: string;
  sourceStageId?: string;
  sourceArtifactId?: string;
  at: string;
}

export interface RerunPlan {
  stageIds: string[];
  invalidations: StageInvalidation[];
}

export class CreativeStageGraph {
  private readonly stages = new Map<string, CreativeStage>();

  add(stage: CreativeStage): void {
    if (this.stages.has(stage.id)) throw new Error(`Creative stage already exists: ${stage.id}`);
    for (const dependency of stage.dependsOn) {
      if (dependency === stage.id) throw new Error(`Creative stage cannot depend on itself: ${stage.id}`);
    }
    this.stages.set(stage.id, structuredClone(stage));
  }

  get(id: string): CreativeStage | undefined {
    const stage = this.stages.get(id);
    return stage ? structuredClone(stage) : undefined;
  }

  list(): CreativeStage[] {
    return [...this.stages.values()].map((stage) => structuredClone(stage));
  }

  invalidate(stageId: string, invalidation: StageInvalidation): void {
    const stage = this.stages.get(stageId);
    if (!stage) throw new Error(`Unknown creative stage: ${stageId}`);
    stage.status = 'stale';
  }

  downstreamOf(stageId: string): CreativeStage[] {
    const result: CreativeStage[] = [];
    const seen = new Set<string>();
    const visit = (id: string) => {
      for (const stage of this.stages.values()) {
        if (!stage.dependsOn.includes(id) || seen.has(stage.id)) continue;
        seen.add(stage.id);
        result.push(structuredClone(stage));
        visit(stage.id);
      }
    };
    visit(stageId);
    return result;
  }

  planRerun(stageId: string, invalidation: StageInvalidation): RerunPlan {
    const stage = this.stages.get(stageId);
    if (!stage) throw new Error(`Unknown creative stage: ${stageId}`);
    const downstream = this.downstreamOf(stageId);
    stage.status = 'stale';
    for (const dependent of downstream) {
      const stored = this.stages.get(dependent.id);
      if (stored && stored.status !== 'failed') stored.status = 'stale';
    }
    return {
      stageIds: [stageId, ...downstream.map((item) => item.id)],
      invalidations: [invalidation],
    };
  }
}

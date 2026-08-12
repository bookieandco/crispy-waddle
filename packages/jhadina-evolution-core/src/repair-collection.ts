import type { EvolutionExecutionPlan } from "./evolution-executor";
import type { RepositoryIntelligenceCollector, RepositoryIntelligenceEvidence } from "./repository-intelligence";

export interface RepairCollectionResult {
  evidence: RepositoryIntelligenceEvidence;
  promptContext: string;
}

/** Deterministically binds repository intelligence to a repair before FIX. */
export class RepairCollectionStage {
  constructor(private readonly collector: RepositoryIntelligenceCollector) {}

  async collect(
    repository: string,
    branch: string,
    plan: EvolutionExecutionPlan,
  ): Promise<RepairCollectionResult> {
    const evidence = await this.collector.collect({
      repository,
      branch,
      query: plan.title,
      allowedPaths: plan.allowedPaths,
    });

    return {
      evidence,
      promptContext: JSON.stringify({
        repository: evidence.snapshot.repository,
        branch: evidence.snapshot.branch,
        commit: evidence.snapshot.commit,
        relevantFiles: evidence.snapshot.relevantFiles,
        recentCommits: evidence.snapshot.recentCommits,
        openIssues: evidence.snapshot.openIssues,
        openPullRequests: evidence.snapshot.openPullRequests,
        ci: evidence.snapshot.ci,
        documentation: evidence.snapshot.documentation,
        scope: evidence.scope,
      }),
    };
  }
}

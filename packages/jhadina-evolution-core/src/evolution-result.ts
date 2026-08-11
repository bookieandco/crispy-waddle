export type EvolutionExecutionStatus = "VERIFIED" | "FAILED" | "BLOCKED";

export interface EvolutionExecutionResult {
  version: "1";
  taskId: string;
  runId: number;
  status: EvolutionExecutionStatus;
  baseBranch: string;
  branch: string;
  changedFiles: string[];
  diffStat: string;
  verification: {
    protectedPaths: "success" | "failure" | "skipped";
    evolutionCoreTests: "success" | "failure" | "skipped";
  };
  draftPr: string | null;
}

export function parseEvolutionExecutionResult(raw: unknown): EvolutionExecutionResult {
  if (!raw || typeof raw !== "object") throw new Error("Invalid Jhadina evolution result");
  const value = raw as Record<string, unknown>;
  if (value.version !== "1") throw new Error("Unsupported Jhadina evolution result version");
  if (typeof value.taskId !== "string" || !value.taskId) throw new Error("Missing taskId");
  if (typeof value.runId !== "number" || !Number.isInteger(value.runId)) throw new Error("Invalid runId");
  if (!["VERIFIED", "FAILED", "BLOCKED"].includes(value.status as string)) throw new Error("Invalid execution status");
  if (typeof value.baseBranch !== "string" || typeof value.branch !== "string") throw new Error("Invalid branch metadata");
  if (!Array.isArray(value.changedFiles) || !value.changedFiles.every((file) => typeof file === "string")) throw new Error("Invalid changedFiles");
  if (typeof value.diffStat !== "string") throw new Error("Invalid diffStat");
  if (!value.verification || typeof value.verification !== "object") throw new Error("Missing verification");
  const verification = value.verification as Record<string, unknown>;
  const validOutcome = (outcome: unknown) => outcome === "success" || outcome === "failure" || outcome === "skipped";
  if (!validOutcome(verification.protectedPaths) || !validOutcome(verification.evolutionCoreTests)) throw new Error("Invalid verification outcomes");
  if (value.draftPr !== null && typeof value.draftPr !== "string") throw new Error("Invalid draftPr");

  return {
    version: "1",
    taskId: value.taskId,
    runId: value.runId,
    status: value.status as EvolutionExecutionStatus,
    baseBranch: value.baseBranch,
    branch: value.branch,
    changedFiles: value.changedFiles,
    diffStat: value.diffStat,
    verification: {
      protectedPaths: verification.protectedPaths as EvolutionExecutionResult["verification"]["protectedPaths"],
      evolutionCoreTests: verification.evolutionCoreTests as EvolutionExecutionResult["verification"]["evolutionCoreTests"],
    },
    draftPr: value.draftPr as string | null,
  };
}

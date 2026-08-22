import { assertGovernedRepairResult } from "./governed-repair-contract.ts";

const verified = {
  workflowResult: {
    version: "1" as const,
    taskId: "repair-1",
    runId: 1,
    status: "VERIFIED" as const,
    baseBranch: "main",
    branch: "evolution/repair-1",
    changedFiles: ["src/example.ts"],
    diffStat: "+1 -0",
    verification: { protectedPaths: "success" as const, evolutionCoreTests: "success" as const },
    draftPr: null,
  },
  verified: true,
  protectedPathsVerified: true,
  evolutionCoreTestsVerified: true,
};

assertGovernedRepairResult(verified);

for (const invalid of [
  { ...verified, verified: false },
  { ...verified, protectedPathsVerified: false },
  { ...verified, evolutionCoreTestsVerified: false },
  { ...verified, workflowResult: { ...verified.workflowResult, status: "FAILED" as const } },
]) {
  let rejected = false;
  try { assertGovernedRepairResult(invalid); } catch { rejected = true; }
  if (!rejected) throw new Error("invalid governed repair result was accepted");
}

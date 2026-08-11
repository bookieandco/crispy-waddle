import { InMemoryEvolutionRunLedger, verifyEvolutionRunLedger } from "./evolution-run-ledger";
import { GovernedEvolutionPromoter } from "./governed-promoter";

const proposal = { id: "proposal-1", reversible: true } as any;
const evaluation = { id: "evaluation-1", proposalId: proposal.id, recommendation: "promote" } as any;
const plan = { id: "plan-1", title: "safe repair", risk: "low", requiresApproval: true, allowedPaths: ["/src"], testCommands: ["pnpm test"], securityChecks: ["protected-paths"] } as any;
const workspace = { path: "/tmp/evolution", branch: "evolution/proposal-1" } as any;
const ledger = new InMemoryEvolutionRunLedger();
let calls = 0;

const promoter = new GovernedEvolutionPromoter({
  runLedger: ledger,
  createExecutionContext: async () => ({
    repairId: "repair-1", plan, workspace,
    repository: { snapshot: { repository: "bookieandco/crispy-waddle", branch: "main", commit: "abc123" } },
  }),
  repairExecutor: {
    execute: async (request) => {
      calls += 1;
      if (request.approvalGranted !== true) throw new Error("approval must be explicit");
      return {
        workflowResult: {
          version: "1" as const, taskId: request.repairId, runId: 1, status: "VERIFIED" as const,
          baseBranch: "main", branch: request.workspace.branch, changedFiles: ["src/example.ts"], diffStat: "+1 -0",
          verification: { protectedPaths: "success" as const, evolutionCoreTests: "success" as const }, draftPr: null,
        },
        verified: true, protectedPathsVerified: true, evolutionCoreTestsVerified: true,
      };
    },
  },
});

await promoter.promote(proposal, evaluation);
if (calls !== 1) throw new Error("promotion must execute exactly once");
const events = await ledger.list(1);
if (events.length !== 2) throw new Error(`expected dispatch and terminal events, got ${events.length}`);
if (events[0].type !== "RUN_DISPATCHED" || events[1].type !== "RUN_VERIFIED") throw new Error("unexpected promotion ledger sequence");
if (!verifyEvolutionRunLedger(events)) throw new Error("promotion ledger must verify");

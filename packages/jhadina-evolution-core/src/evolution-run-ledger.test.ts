import {
  InMemoryEvolutionRunLedger,
  recordEvolutionExecutionResult,
  verifyEvolutionRunLedger,
} from "./evolution-run-ledger.ts";

const result = {
  version: "1" as const,
  runId: 42,
  taskId: "task-42",
  status: "VERIFIED" as const,
  baseBranch: "main",
  branch: "evolution/task-42",
  changedFiles: ["src/example.ts"],
  diffStat: "+1 -0",
  verification: { protectedPaths: "success" as const, evolutionCoreTests: "success" as const },
  draftPr: "https://github.com/bookieandco/crispy-waddle/pull/42",
};

const ledger = new InMemoryEvolutionRunLedger();
const events = await recordEvolutionExecutionResult(ledger, result);

if (events.length !== 3) throw new Error(`expected 3 events, got ${events.length}`);
if (!verifyEvolutionRunLedger(events)) throw new Error("fresh ledger must verify");

const tampered = events.map((event) => ({ ...event, payload: { ...event.payload } }));
tampered[1].payload = { ...tampered[1].payload, changedFiles: ["tampered.ts"] };
if (verifyEvolutionRunLedger(tampered)) throw new Error("tampered ledger must fail verification");

const secondRun = await recordEvolutionExecutionResult(ledger, {
  ...result,
  runId: 43,
  taskId: "task-43",
  draftPr: null,
});

if (secondRun[0].sequence !== 1) throw new Error("each run must have an independent sequence");
if (secondRun[0].previousHash !== null) throw new Error("each run must begin a fresh chain");

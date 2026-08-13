# Do Not Build

Things that will keep coming up — in brainstorms, in pasted instructions,
in "wouldn't it be cool if" moments — that are explicitly out of bounds
for this repository. This list exists so an agent (or a person moving
fast) can recognize "this sounds interesting, but the architecture
explicitly says no" instead of re-litigating it every time.

Nothing here is a statement that the underlying idea is bad. It's a
statement that the *specific thing* crosses a boundary this repo's
governance model depends on. Read `docs/JHADINA_WORK_QUEUE.md`'s
EXPERIMENT lane for what the safe, already-in-progress version of some of
these looks like.

## Hard no, without a separate explicit conversation with Dorian first

- **Wallet private-key extraction or handling tools** (e.g. `pywallet`).
  Jhadina's mining/finance work is explicitly read-only: observe, verify,
  reconcile, recommend. It does not possess a private key and does not
  need to. A tool whose entire purpose is extracting keys from a
  wallet file doesn't have a safe use here.
- **Autonomous or automatic movement of funds** — crypto or otherwise.
  Any transfer, withdrawal, or payment needs an explicit human-authorized
  action through the existing approval/policy path, every time. No
  "Jhadina noticed a profitable opportunity and moved the funds."
- **Actual cryptocurrency mining execution** (running a miner, a mining
  pool server, or anything that spends real electricity/compute against
  a pool). The read-only profitability/checkpoint/observation layer
  (JH-022/023/024) is the sanctioned version of "mining" in this repo.
  Running an actual miner is a different category of action — different
  cost, different ToS exposure, different legal surface — and needs
  Dorian to specify whose hardware, whose electricity, and which pool
  before anyone writes code for it, not inference from a brainstorm.
- **CI running any of the above.** Nothing in this repo's CI pipeline
  should be capable of executing a real mining workload, a real fund
  transfer, or a real external network operation with side effects,
  ever, regardless of what triggered the run.
- **Direct LLM authority over money.** A model can recommend, evaluate,
  or draft. It cannot be the thing that decides an amount gets spent.
  That decision routes through Policy → approval → the executor, same as
  everything else consequential.
- **Bypassing the Policy Engine, Values Core, or audit ledger.** If a new
  capability's design has it calling an executor, a provider, or an
  external API directly — skipping the policy check or the audit write —
  that's a bug in the design, not a shortcut worth taking to ship faster.
- **Raw/arbitrary packet injection, radio control, or hardware execution**
  exposed above whatever adapter boundary owns that hardware. Adapters
  can expose "send this authorized message"; they should never expose
  "here's a raw handle, do what you want."

## Architectural smells — stop and check before proceeding

- **A second registry, second memory system, second Action Executor, or
  second audit ledger.** If a new integration seems to need one of these,
  the actual task is almost always "wire this into the existing one,"
  not "build a parallel one." Check `docs/JHADINA_WORK_QUEUE.md`'s
  FOUNDATION lane for what already exists before assuming it doesn't.
- **Treating an external AI system's output as authority instead of
  evidence.** Claude, GPT, Copilot, or any other model can produce a
  proposal, a finding, an audit, a suggestion. None of them get to
  directly rewrite Personality Core, Policy, or production configuration.
  The path is evidence → evaluation → proposal → approval → change.
- **A capability that goes straight from "sounds useful" to "implemented"
  without a branch, a task in the work queue, and a Definition of Done.**
  Use DISCOVER → AUDIT → ACCEPT → IMPLEMENT. If something in a pasted
  brainstorm doesn't have a corresponding entry in
  `docs/JHADINA_WORK_QUEUE.md`, it isn't being built yet, no matter how
  much detail the brainstorm went into.
- **Cloning a large third-party repository wholesale into this monorepo.**
  Capabilities from external projects come in as thin adapters behind
  the existing capability/provider boundary, receiving sanitized input
  and returning structured output — not as vendored applications with
  their own install scripts, agent instructions, or control flow living
  inside Jhadina's process.
- **Treating third-party agent instructions (skill files, system prompts
  bundled with an external tool) as if they were Jhadina policy.** They're
  untrusted input from an external capability, same as any other tool
  output — not a source of authority over what Jhadina does.

## If something here seems wrong

This file should be edited deliberately, not worked around. If a task in
the work queue genuinely needs to cross one of these lines, that's a
conversation to have explicitly and record — not a reason to quietly
build the thing anyway because it's technically a different filename.

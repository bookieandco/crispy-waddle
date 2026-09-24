# GEV ↔ Ask Jhadina audit and repair — 2026-09-23

## Scope

Audit the existing God’s Eye View (GEV) / Spatial Intelligence attachment to Jhadina and make the Ask Jhadina surface consume it through the canonical governed context path.

## Canonical boundary

`GEV/source -> SpatialObservation -> immutable SpatialEvidence -> claim candidate -> explicit Reality admission -> SpatialContext -> Ask Jhadina`

GEV remains a source/provider. It does not become a policy engine, action executor, approval authority, durable-memory authority, or truth shortcut.

## Audit findings

### Already correct

- The production spatial factory composes `GevProviderBridge`, GEV source adapters, durable evidence persistence, Knowledge Graph projection, and Reality admission.
- `handleJhadinaCommand()` installs that production SpatialContextProvider and passes the resulting spatial domain contribution through the canonical Context Builder.
- Ask Jhadina is already registered as a consumer of the `spatial` intelligence input.
- The spatial contribution is read-only and downstream model evidence is rebound to canonical ContextPacket evidence.
- Spatial authority remains `INTELLIGENCE_ONLY`.

### Gap 1 — shortcut bypass

Ask Jhadina has deterministic Social/Growth shortcut paths that can return before the canonical Context Builder runs. A mixed prompt such as a Social/Growth question that also requires GEV could therefore lose spatial context.

Repair:
- add explicit spatial/GEV contextual-read detection;
- route spatial Social/Growth reads through the full JLLM/Context Builder path;
- keep ordinary non-spatial deterministic reads on their narrow shortcut path.

### Gap 2 — wrong source-use purpose at the Ask boundary

The GEV bridge already enforces per-source reuse policy, including a distinct `model-input` purpose. The production Ask Jhadina SpatialContextProvider did not specify that purpose, so the read provider inherited the bridge default of `private-analysis`.

That is too permissive for an LLM boundary: a source allowed for private read-only analysis is not automatically allowed as model input.

Repair:
- make the GEV spatial read provider accept an explicit use purpose;
- configure the Ask Jhadina production composition with `purpose: 'model-input'`;
- pass that purpose through every live GEV bridge call;
- fail closed source-by-source when model-input permission is restricted or unknown;
- retain `private-analysis` as the default for non-model Spatial workspace reads;
- add a conformance test proving restricted/unknown CCTV, OpenSky and AIS reads are denied at the Ask boundary while model-input-approved FIRMS evidence can proceed.

### Gap 3 — invisible participation

The generic Ask Jhadina result did not expose whether Spatial/GEV actually participated in a turn. The UI therefore could not distinguish “GEV used” from “no spatial context available.”

Repair:
- return a bounded `SpatialContextUsageReceipt`;
- expose observation/evidence/claim/reality/provenance counts, source names, conflicts, uncertainty and limitations;
- mark Spatial as active in WorkSession continuity when used;
- render a visible “GEV / Spatial context” card on Ask Jhadina.

The receipt exposes metadata only. It does not expose provider secrets, raw restricted CCTV frames, arbitrary upstream URLs, or execution authority.

## Regression coverage

- explicit GEV/spatial prompts require the full canonical JLLM context;
- mixed Social/Growth + spatial prompts cannot be swallowed by narrow shortcuts;
- generic words such as “change”, “route” and “investigate” do not by themselves wake spatial context;
- the IntelligenceRouter receives the spatial ContextPacket contribution;
- the returned usage receipt matches the actual governed contribution.

## Production truth

Source wiring is repaired on this branch. Production runtime certification still requires the merged lineage to deploy and a real authenticated spatial turn to prove:

1. `/api/spatial/health` is READY for the deployed lineage;
2. a live GEV source produces durable evidence;
3. Reality admission behaves correctly for that evidence;
4. Ask Jhadina returns a non-empty spatial usage receipt for a real spatial prompt;
5. outage/stale/fallback/malformed cases remain fail-closed.

No source-level test is treated as a substitute for those live receipts.

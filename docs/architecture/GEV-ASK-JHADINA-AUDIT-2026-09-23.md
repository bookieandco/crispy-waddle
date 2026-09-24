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

### Gap 4 — geographic scope handoff and privacy

The command contract already accepted `geographicScope`, but the Ask Jhadina browser surface never supplied it. Device-relative prompts such as “what flights are near me?” could therefore invoke spatial reasoning without a local query boundary.

Repair:
- classify only explicitly device-relative prompts (near me, around here, my area, current location);
- request browser geolocation only for those prompts, using the browser permission boundary and `enableHighAccuracy: false`;
- send a bounded 25 km point scope on that turn;
- do not add the coordinates to WorkSession memory;
- hand a Spatial-workspace point/radius to Ask through ephemeral `sessionStorage`, not URL query parameters, so coordinates do not unnecessarily enter browser history or ordinary URL logging;
- only attach the staged scope when the active Ask prompt is spatial;
- add a Spatial-workspace “Ask Jhadina about this view” handoff that carries the current scope and active layers without putting coordinates in the URL.

Named-place text is not silently geocoded by this repair. If no staged/explicit coordinates or device-relative permission exists, the query remains unscoped rather than inventing a location.

### Gap 5 — evidence summaries were not spatially useful enough for JLLM reasoning

The governed ContextPacket carried evidence IDs and entity IDs, but normalized GEV evidence summaries omitted coordinates. That made the attachment observable without giving Jhadina enough bounded spatial detail to explain where admitted evidence was located.

Repair:
- include normalized latitude/longitude (and altitude when present) in observation/evidence summaries;
- keep raw provider payloads outside the ContextPacket;
- rely on the model-input source-use gate above so restricted/unknown sources are blocked before these summaries can reach Ask Jhadina.

## Regression coverage

- explicit GEV/spatial prompts require the full canonical JLLM context;
- mixed Social/Growth + spatial prompts cannot be swallowed by narrow shortcuts;
- generic words such as “change”, “route” and “investigate” do not by themselves wake spatial context;
- the IntelligenceRouter receives the spatial ContextPacket contribution;
- the returned usage receipt matches the actual governed contribution;
- device-relative prompts request a device scope while named-place prompts do not;
- model-input source policy blocks restricted/unknown GEV sources before upstream fetch and permits explicitly allowed FIRMS evidence.

## Production truth

Live audit on 2026-09-23 / 2026-09-24 UTC:

- current Vercel production deployment is READY at main commit `0b6a8b651ad42b7e86ffe8b571f7abd445244278`;
- `GET /api/spatial/health` on the production alias returns HTTP 503 with `status=DEGRADED`;
- provider reports `configured=false`, so `JHADINA_GEV_BASE_URL` / `GEV_BASE_URL` is not available to the deployed runtime;
- database reports `configured=false`, so the deployed runtime does not have the complete server-side Supabase service-role configuration used by `createServiceRoleClient()`;
- independent Supabase inspection of the connected SWLC/Jhadina project confirms all six Spatial/Knowledge tables exist and have RLS enabled:
  `jhadina_spatial_evidence`, `jhadina_spatial_reality_candidates`, `jhadina_spatial_reality_admissions`, `jhadina_spatial_workspace_revisions`, `jhadina_knowledge_nodes`, and `jhadina_knowledge_relations`.

Therefore the database schema is present; the immediate live blocker is production runtime configuration, not missing Spatial migrations. The deployed Jhadina Web project needs the correct production values for the GEV base URL plus the Supabase URL/service-role key before the health gate can become READY. No secret values belong in Git.

Source wiring is repaired on this branch. Production runtime certification still requires the merged lineage to deploy and a real authenticated spatial turn to prove:

1. `/api/spatial/health` is READY for the deployed lineage;
2. a live GEV source produces durable evidence;
3. Reality admission behaves correctly for that evidence;
4. Ask Jhadina returns a non-empty spatial usage receipt for a real spatial prompt;
5. outage/stale/fallback/malformed cases remain fail-closed.

No source-level test is treated as a substitute for those live receipts.

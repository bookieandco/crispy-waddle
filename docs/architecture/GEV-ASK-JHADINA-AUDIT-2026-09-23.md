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

Named-place handling now has a deterministic public-airport fast path for LAX/KLAX/Los Angeles International Airport using the Public Domain OurAirports record (33.942501, -118.407997). Explicit/staged coordinates still win. "at LAX" uses a 5 km scope, "near/around LAX" uses 25 km, and explicit 0.5–250 km / equivalent-mile distances are honored. Out-of-policy distances and unresolved place names fail closed. General free-text geocoding beyond the seeded airport gazetteer remains a separate expansion; the system does not invent coordinates.

### Gap 5 — evidence summaries were not spatially useful enough for JLLM reasoning

The governed ContextPacket carried evidence IDs and entity IDs, but normalized GEV evidence summaries omitted coordinates. That made the attachment observable without giving Jhadina enough bounded spatial detail to explain where admitted evidence was located.

Repair:
- include normalized latitude/longitude (and altitude when present) in observation/evidence summaries;
- keep raw provider payloads outside the ContextPacket;
- rely on the model-input source-use gate above so restricted/unknown sources are blocked before these summaries can reach Ask Jhadina.

### Gap 6 — CCTV model capability enrichment

CCTV Camera Database is now registered as a separate governed source: `cctv-database-catalog`.

Boundary:
- it is a CC0 camera specification/catalog source, not a live camera-location or stream source;
- model input is allowed for catalog metadata;
- live `gev-cctv` remains separately restricted and is not relaxed by this integration;
- exact brand/model lookups use the fixed-origin static JSON API and never accept arbitrary upstream URLs;
- catalog observations have no geographic position, `observed_at=null`, `liveDeploymentEvidence=false`, and `liveFeedEvidence=false`;
- therefore catalog specs cannot self-promote into spatial Reality or prove that a camera exists at LAX or anywhere else;
- Ask Jhadina may use matched model metadata such as resolution, ONVIF/RTSP support, connectivity, power, night vision and verification provenance;
- protocol/configuration metadata is capability information only and never authorizes camera access or bypasses authentication.

Source: https://www.cctv-database.com/api/ and https://github.com/ch-bas/cctv-camera-database (CC0 1.0).

### Gap 7 — deterministic named-place scope

Ask Jhadina can now resolve the explicit public airport aliases `LAX`, `KLAX`, and `Los Angeles International Airport` before Context Builder assembly when no explicit geographic scope was supplied.

Boundary:
- authoritative explicit/browser/Spatial-workspace scope wins over named-place resolution;
- source record: OurAirports `KLAX`, Public Domain;
- coordinates: `33.942501, -118.407997`;
- default `near/around` radius: 25 km;
- `at/inside` radius: 5 km;
- explicit distances from 0.5–250 km (or mile equivalents) override the default;
- out-of-range distances and unresolved names fail closed;
- resolver metadata is carried in the request scope for provenance but does not become user Memory.

General landmark/city/address geocoding is not claimed by this airport fast path.

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


## Satellite live-certification extension

Satellite is now a first-class governed Spatial source rather than normalization-only support.

### Live providers

- **CelesTrak GP/OMM JSON** — fixed-origin public orbital-element reads with a minimum two-hour in-process cache. The adapter uses OMM-compatible JSON so it is not limited by legacy five-digit TLE catalog identifiers.
- **NASA GIBS / Worldview VIIRS** — fixed-origin public daily true-color imagery tiles. The evidence record preserves layer/date, requested scope, tile coordinates, content type, byte length, URL and SHA-256 checksum.

### Derived orbital context boundary

CelesTrak OMM elements are source observations. Jhadina derives a bounded current subpoint and six-hour closest-approach context with a two-body Kepler model. Those calculations are explicitly labeled `context-only-not-operational` and must not be represented as SGP4-grade navigation, collision-avoidance, antenna-pointing or safety-of-flight data.

Both orbital derived context and NASA imagery assets carry `realityAdmissionEligible=false`. The Reality admission provider fails closed on that marker. Satellite evidence may inform Ask Jhadina, fusion, investigation and change-analysis work, but cannot self-promote into canonical Reality.

### Durable lineage repair

Spatial Knowledge source/entity nodes are stable identities. Per-observation evidence now remains on the `observed` relation rather than mutating node provenance on every new receipt. Satellite observation IDs include receipt time, making repeated live reads append-safe while retaining source epoch/date and asset checksum in the evidence payload.

### Ask Jhadina / UI

- satellite/orbit/overpass/overhead/imagery/Worldview/VIIRS/CelesTrak language routes through canonical Spatial Context;
- device-relative satellite prompts request browser location only when the user explicitly asks relative to their device;
- LAX/KLAX named-place scope continues through the deterministic OurAirports resolver;
- the Spatial workspace exposes a `satellite` layer;
- `/api/spatial/satellite/health` is a public-safe health contract that exposes only provider reachability/count/asset metadata, never raw provider payloads or secrets.

### Certification ladder

Satellite certification is not a single boolean:

1. **SOURCE PASS** — spatial type-check, deterministic provider tests, Reality firewall, routing tests and Jhadina production build pass on the exact head.
2. **PUBLIC-PROVIDER LIVE PASS** — the exact source head performs one real CelesTrak read and one real NASA GIBS tile read through the production Spatial factory and receives non-empty evidence from both.
3. **DURABLE INFRASTRUCTURE PASS** — that same live read is appended through `createSupabaseSpatialEvidenceStore` and read back by evidence ID; Knowledge projection succeeds; Reality remains empty.
4. **DEPLOYED RUNTIME PASS** — an exact-SHA READY Jhadina deployment returns `READY` from `/api/spatial/satellite/health`.
5. **GEV-SATELLITE.LIVE.FINAL** — all four gates above are proven with receipts on the same admitted lineage.

Feature-branch automatic Vercel deployment remains disabled by the repository deployment-rate guard. A controlled preview may be used for gate 4 only when an authorized Vercel deploy credential/action is available; the guard must not be weakened to obtain a certification receipt.


## GitGlobe / Matrix-3D spatial-world extension

New references:

- `yamantaka-singh/GitGlobe`;
- `SkyworkAI/Matrix-3D`.

These are integrated without changing the canonical GEV truth boundary:

`GEV/source -> SpatialObservation -> immutable SpatialEvidence -> explicit Reality admission -> SpatialContext -> Ask Jhadina / Spatial Workspace`

### GitGlobe contribution: ID-only globe control

GitGlobe is a semantic software-discovery globe, not a physical-world data source. Its repository positions are derived from embedding/UMAP layout and must **not** be imported as geographic truth.

The reusable architectural lesson is its agent-camera contract:

- the model chooses stable IDs;
- the renderer owns coordinates/geometry;
- camera fly/focus/highlight operations resolve IDs inside the renderer;
- invalid IDs fail visibly;
- the model never emits plausible-looking coordinates.

Jhadina Spatial now has `SpatialGlobeCommand` and `parseSpatialGlobeCommand()` implementing the same safety property for GEV/Spatial refs.

Supported presentation operations include:

- fly to grounded refs;
- focus one grounded ref;
- highlight refs;
- draw evidence/source/corroboration/conflict/route/semantic relations;
- set presentation filters;
- reset view.

Raw `lat/lon/x/y/z/theta/phi` camera geometry in model-issued commands is rejected.

The renderer profile also records scalable implementation guidance from GitGlobe:

- S2 spatial indexing;
- GPU ID-buffer picking;
- on-demand relation loading;
- renderer-owned geometry.

These remain presentation optimizations. Renderer state never becomes observation/evidence/reality.

### GEV -> synthetic world visualization

Added `createSpatialWorldVisualizationSeed()`.

A seed can carry:

- GEV evidence refs;
- admitted Reality refs;
- geographic scope;
- source health;
- uncertainty;
- limitations;
- provenance.

For real-world recreations, the caller can require explicit Reality admission before a world seed is produced.

Every seed is permanently marked:

- authority = `INTELLIGENCE_ONLY`;
- synthetic output policy = `MUST_NOT_REENTER_SPATIAL_REALITY`.

A Matrix-3D/OpenArt/other generated scene therefore cannot be fed back into the GEV truth chain as if it were a new sensor observation.

### Matrix-3D contribution: actual navigable world backend

Matrix-3D is an omnidirectional explorable 3D-world generator, unlike the object-centric Hunyuan3D/LSRM profiles.

The repository documents:

- text -> panorama image;
- image -> panorama image;
- panorama -> panoramic tour video;
- panoramic video -> 3D scene;
- custom camera trajectories;
- optimization-based 3D Gaussian-splat reconstruction;
- feed-forward panoramic LRM reconstruction;
- 360-degree free exploration.

Director now registers `MATRIX_3D_PROFILE` as a `world-generator` with:

- `text-to-panorama`;
- `image-to-panorama`;
- `panoramic-video-generation`;
- `panoramic-scene-reconstruction`;
- `custom-camera-trajectory`;
- `gaussian-splat-scene`;
- `free-camera-world`;
- `navigable-world`.

The GitHub code license is MIT. The GitHub README does not establish the commercial terms for every released checkpoint/model dependency, so commercial production fails closed until those weight terms are separately verified.

### Combined boundary

The integrated roles are:

- **GEV / public spatial providers** -> grounded real-world observations/evidence;
- **Reality admission** -> determines what can be treated as canonical real-world state;
- **Ask Jhadina / Spatial Workspace** -> reason over and navigate that state;
- **GitGlobe-inspired control** -> ID-only camera/navigation presentation;
- **Matrix-3D** -> optional synthetic navigable visualization/world generation;
- **Director EnvironmentViewPack / WorldCaptureSession** -> creative-world continuity;
- **generated world output** -> synthetic derivative only, never new GEV Reality.

This keeps the powerful visual/world layer downstream of truth rather than allowing rendered geometry to contaminate the evidence chain.

# Director + Social Production Foundry Audit — 2026-09-26

Baseline audited: `bookieandco/crispy-waddle@8b39284e42f6a5737590aece7a7c9ca619f24871`.

## Objective
One governed production system for 30-second ads, 8–13 minute branded shorts, episodic programs and ~60-minute films, with human-editable, reversible output and no silent continuity drift.

## Current main already strong
Main already contains storyboard lineage, Cast/Voice/Audio bibles, character reference expansion, character dataset/LoRA training, product reference bootstrap, camera/performance/realism direction, animation principles, dialogue coverage, world/3D backend profiles, multimodal take selection, Foley/audio, FFmpeg QC, timeline commands, generative extend, final-export inspection, Social→Director handoff and YouTube owned-media intelligence.

Open PR #692 is still required for production auth middleware emission. Open PR #693 is still required for canonical PerformanceMaster, persistent long-form dialogue state and 3D mocap/Blender certification. Neither is treated as merged authority in this audit.

## Reference placement
- DaanKieft/ai-influencer → reference packs, media routing, product creative and virality precheck.
- ArmaghanRazaChaudhary/AI-Influencer → versioned character package/handoff.
- Charisma + Make-AI-Clone-of-Yourself → behavioral adapter/dataset ideas; mutable facts stay outside weights.
- Voicebox → optional voice runtime beneath Director Voice Identity.
- Replicate LoRA, OmniChar, LoRA Pilot, Anima TrainFlow, Hunyuan AMD and LoRA training tutorials → generic adapter foundry, dataset preflight and checkpoint tournament.
- RPGraph → relationship/world continuity concepts.
- svg-aituber-chat + open-character-ai → live session/embodiment references.
- Shimmer Strip, wardrobeAssistant, Fashion-Sense-AI and Cliprise fashion prompts → wardrobe state, segmentation/embeddings, fashion retrieval and garment-shot QA.
- Gibson/iGibson concepts + RPent → spatial/embodied preflight and planner→action separation.
- OVER/OverMaps → real-world digital-twin/VPS provider/research reference; research-only datasets remain outside commercial training.
- AI-influencer monetization videos → niche economics, persistent talent, comment/DM offer routing, MORE/BETTER/NEW and character P&L.

## Added in this branch
`production-foundry.ts` adds:
1. generic ProductionAssetPackage for characters, clothes, accessories, props, products, furniture, vehicles and sets;
2. source references as truth and derived model payloads as invalidatable cache;
3. wardrobe availability and Garment Lock;
4. WorldStateGraph and object affordance/co-location preflight;
5. generic adapter checkpoint tournament;
6. cross-domain ProductionCoherenceGate;
7. user CreativeDirective pins/forbids that outrank automation;
8. external-NLE interchange fidelity planning.

`talent-business.ts` adds:
1. character-level revenue/cost/contribution margin;
2. MORE/BETTER/NEW lifecycle allocation;
3. inbound audience interaction facts and intent routing without bypassing existing governed Social send/publish authority.

## Missing before “no AI slop” is a real runtime claim

### P0 — live/canonical
1. Merge/reconcile #692 and prove anonymous protected routes fail closed in production.
2. Merge/reconcile #693 and certify real Blender/EasyMocap/GPU workers.
3. Deploy/reconcile Director migrations on the live release base; source contracts are not enough.
4. Certify real workers for dataset generation, LoRA training, tracking, character replacement, voice sync, rig/secondary physics, upscale/render and whole-video providers.
5. Prove restart-safe owner-scoped Workstation persistence and two-user isolation.

### P0 — one production truth
6. Persist one FilmProject aggregate binding screenplay/story bible, scenes/shots, WorldState version, Cast/Voice/Asset package versions, wardrobe, adapter versions, timeline and export.
7. Persist character knowledge state, unresolved story threads, object ownership/location and time/wardrobe state across scenes.
8. Run coherence QC at shot, scene, act/reel and final-film levels.
9. Localize failures and rerun only broken regions/assets instead of whole scenes.
10. Require held-out certification for every promoted mind/visual/video/object/garment adapter.

### P0 — editability
11. Persist CreativeDirective locks so user choices survive regeneration/provider changes.
12. Finish a real NLE Workstation UI for trim/slip/slide/roll, transforms, keyframes, takes, compare, undo/revert and generative regions.
13. Implement actual OTIO/FCPXML/AAF/EDL/Premiere XML import/export and round-trip tests; this branch adds the contract, not the serializer.
14. Keep every AI edit as an attributable proposal/version with before/after/revert.
15. Support freeze/lock at character, shot, scene, wardrobe, product, performance, voice, camera and grade scopes.

### P1 — physical/visual coherence
16. Persist generic Asset Packages and interaction anchors for frequently reused props/furniture/products.
17. Connect WorldState to blocking/previs and an admitted simulator/3D backend before expensive rendering.
18. Add frame-level logo/garment/product identity probes across video, not only still-image identity.
19. Add deterministic eyeline, screen direction, lens/height, light direction and visibility checks across each scene.

### P1 — audio
20. Admit Voicebox or equivalent under Voice Identity.
21. Keep dialogue/ADR/room tone/Foley/SFX/music as separate editable stems.
22. Add ADR punch-in, pronunciation and long-scene voice continuity QC.
23. Bind music motifs/stems/rights through final export.

### P1 — Social business loop
24. Persist inbound comments/DM/live events and observed facts.
25. Connect intent→offer→existing governed messaging→checkout attribution.
26. Persist P&L by character/content/offer and actual generation/editing cost.
27. Add talent/brand compatibility, rate cards, license rights and campaign history.
28. Allocate production via EXPLORE/INCUBATE/EXPLOIT/RETEST/RETIRE plus MORE/BETTER/NEW; never select winners from raw views alone.

### P1 — hour-long scale
29. Add project render budgets, GPU queueing, proxies and render-farm scheduling.
30. Cache immutable refs/adapters/world assets and invalidate only descendants.
31. Add storage lifecycle for source, proxies, intermediates, masters and reversible history.
32. Add long-form acceptance fixtures, not only unit/short-clip tests.

## Required certification fixtures
- **30-second ad:** exact product/label/garment fidelity, supported claims, editable timeline, Social derivative and attribution.
- **8–13 minute branded short:** recurring cast/wardrobe/props, multiple locations, dialogue/ADR/Foley, continuity and product placement.
- **22–30 minute episode:** causal scene continuity, long-form dialogue state, callbacks, world persistence and selective reruns.
- **55–70 minute film:** stable character/voice/wardrobe/world identity, coherent geography/time, multi-stem audio, external NLE round-trip and survival of manual user locks.

A film is not certified because one clip looks impressive. Every fixture must have no unexplained identity/wardrobe/product/location/voice drift, no unsupported object interaction, no irreversible AI edit, complete rights/provenance, narrow reruns and final technical+narrative+continuity+spatial+audio QC.

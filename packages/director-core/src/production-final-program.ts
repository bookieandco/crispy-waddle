import type { DirectorProductionFixtureKind } from './production-quality-certification.js';

export interface DirectorProductionFinalFixtureSpec {
  kind: DirectorProductionFixtureKind;
  targetDurationSeconds: number;
  title: string;
  prompt: string;
  requiresCharacterReference: true;
  requiresProductReference: boolean;
  requiresDialogue: true;
  requiredProductionSignals: readonly string[];
}

export const DIRECTOR_PRODUCTION_FINAL_PROGRAM: readonly DirectorProductionFinalFixtureSpec[] = Object.freeze([
  Object.freeze({
    kind:'commercial-30s',
    targetDurationSeconds:30,
    title:'Director Production Final — 30s Commercial',
    prompt:[
      'Create a 30 second cinematic product commercial with a recurring locked hero.',
      'The hero must physically interact with the exact locked product in multiple shots.',
      'Preserve face/body identity, wardrobe, product geometry, label/logo text, hand anatomy, lighting direction and room geography.',
      'Include natural spoken dialogue, reaction beats, Foley, music, clean ambience, at least one moving-camera shot and one product close-up.',
      'The final edit must remain locally repairable and fully editable; do not hide cuts inside one opaque generated master.',
    ].join(' '),
    requiresCharacterReference:true,
    requiresProductReference:true,
    requiresDialogue:true,
    requiredProductionSignals:Object.freeze([
      'character identity','product fidelity','dialogue','hands/product interaction','camera movement','product close-up',
      'wardrobe continuity','foley','music','editable timeline',
    ]),
  }),
  Object.freeze({
    kind:'branded-short-8-13m',
    targetDurationSeconds:600,
    title:'Director Production Final — 10m Branded Short',
    prompt:[
      'Create a 10 minute coherent branded narrative short film with a recurring locked hero and exact locked product.',
      'The product must appear naturally inside the story instead of functioning as a disconnected insert.',
      'Use multiple locations and scene transitions while preserving character identity, voice, wardrobe state, product geometry/labeling, object ownership and spatial continuity.',
      'Include dialogue scenes, silent performance beats, camera coverage, Foley, ambience, score and at least one localized repair opportunity.',
      'Maintain story causality from setup through payoff and deliver an editable multitrack timeline.',
    ].join(' '),
    requiresCharacterReference:true,
    requiresProductReference:true,
    requiresDialogue:true,
    requiredProductionSignals:Object.freeze([
      'story causality','character identity','product integration','voice continuity','wardrobe state','multi-location continuity',
      'dialogue coverage','performance beats','audio stems','localized repair','editable timeline',
    ]),
  }),
  Object.freeze({
    kind:'episode-22-30m',
    targetDurationSeconds:1500,
    title:'Director Production Final — 25m Episode',
    prompt:[
      'Create a 25 minute coherent narrative episode around a recurring locked hero.',
      'Use multiple scenes, locations, wardrobe states, dialogue partners and emotional beats while keeping world state and character knowledge consistent.',
      'Preserve identity and voice through close-ups, wide shots, motion, dialogue and reaction coverage.',
      'Use cinematic camera and lighting plans, natural performance, synchronized dialogue, Foley, ambience, music and editorial pacing.',
      'Maintain sequence-level and act-level causality and deliver an editable multitrack project with narrow regeneration rather than whole-episode replacement.',
    ].join(' '),
    requiresCharacterReference:true,
    requiresProductReference:false,
    requiresDialogue:true,
    requiredProductionSignals:Object.freeze([
      'story causality','world state','character identity','voice continuity','wardrobe continuity','dialogue',
      'performance','camera coverage','lighting continuity','audio stems','localized repair','editable timeline',
    ]),
  }),
  Object.freeze({
    kind:'feature-55-70m',
    targetDurationSeconds:3600,
    title:'Director Production Final — 60m Feature',
    prompt:[
      'Create a 60 minute feature-length narrative around a recurring locked hero using the canonical Director pipeline.',
      'The film must sustain character identity, voice, wardrobe, world state, object ownership, geography, unresolved story threads and causal chronology across acts.',
      'Use varied cinematic coverage, performance rehearsal, dialogue, action/reaction, Foley, ambience, score, transitions and intentional pacing without collapsing into repetitive AI montage.',
      'Repair only failing shots or regions while preserving approved work and manual user locks.',
      'Deliver the full editable timeline and complete an external NLE round trip with source ranges, takes, transforms and manual directives preserved before final certification.',
    ].join(' '),
    requiresCharacterReference:true,
    requiresProductReference:false,
    requiresDialogue:true,
    requiredProductionSignals:Object.freeze([
      'feature causality','act continuity','world state','character knowledge','character identity','voice continuity','wardrobe continuity',
      'spatial continuity','performance rehearsal','dialogue coverage','camera/lighting continuity','audio stems','localized repair',
      'manual lock survival','external NLE round trip','full final watch',
    ]),
  }),
]);

export type DirectorProductionFinalProgramStatus =
  | 'planned'
  | 'launching'
  | 'rendering'
  | 'awaiting-quality-evidence'
  | 'blocked'
  | 'failed'
  | 'passed';

export interface DirectorProductionFinalFixtureRun {
  kind: DirectorProductionFixtureKind;
  projectId: string;
  videoJobId: string;
  status: 'queued' | 'rendering' | 'awaiting-quality-evidence' | 'blocked' | 'failed' | 'passed';
  error?: string;
}

export interface DirectorProductionFinalProgramRun {
  id: string;
  ownerUserId: string;
  sourceProjectId: string;
  characterId: string;
  productId?: string;
  status: DirectorProductionFinalProgramStatus;
  fixtures: readonly DirectorProductionFinalFixtureRun[];
  evidenceIds: readonly string[];
  createdAt: string;
  updatedAt: string;
  authority: 'DIRECTOR_PRODUCTION_FINAL_PROGRAM';
}

export function validateDirectorProductionFinalProgramRun(
  run:DirectorProductionFinalProgramRun,
):readonly string[]{
  const reasons:string[]=[];
  if(!run.id.trim()||!run.ownerUserId.trim()||!run.sourceProjectId.trim()||!run.characterId.trim()){
    reasons.push('DIRECTOR_PRODUCTION_FINAL_PROGRAM_IDENTITY_REQUIRED');
  }
  if(!Number.isFinite(Date.parse(run.createdAt))||!Number.isFinite(Date.parse(run.updatedAt))){
    reasons.push('DIRECTOR_PRODUCTION_FINAL_PROGRAM_TIME_INVALID');
  }
  if(!run.evidenceIds.length) reasons.push('DIRECTOR_PRODUCTION_FINAL_PROGRAM_EVIDENCE_REQUIRED');
  const required=new Set(DIRECTOR_PRODUCTION_FINAL_PROGRAM.map((fixture)=>fixture.kind));
  const seen=new Set<DirectorProductionFixtureKind>();
  for(const fixture of run.fixtures){
    if(seen.has(fixture.kind)) reasons.push(`DIRECTOR_PRODUCTION_FINAL_PROGRAM_DUPLICATE_FIXTURE:${fixture.kind}`);
    seen.add(fixture.kind);
    if(!fixture.projectId.trim()||!fixture.videoJobId.trim()) reasons.push(`DIRECTOR_PRODUCTION_FINAL_PROGRAM_FIXTURE_IDENTITY_REQUIRED:${fixture.kind}`);
  }
  for(const kind of required){
    if(!seen.has(kind)) reasons.push(`DIRECTOR_PRODUCTION_FINAL_PROGRAM_FIXTURE_MISSING:${kind}`);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function deriveDirectorProductionFinalProgramStatus(
  fixtures:readonly DirectorProductionFinalFixtureRun[],
):DirectorProductionFinalProgramStatus{
  if(fixtures.length!==DIRECTOR_PRODUCTION_FINAL_PROGRAM.length) return 'launching';
  if(fixtures.some((fixture)=>fixture.status==='failed')) return 'failed';
  if(fixtures.some((fixture)=>fixture.status==='blocked')) return 'blocked';
  if(fixtures.every((fixture)=>fixture.status==='passed')) return 'passed';
  if(fixtures.some((fixture)=>fixture.status==='queued'||fixture.status==='rendering')) return 'rendering';
  return 'awaiting-quality-evidence';
}

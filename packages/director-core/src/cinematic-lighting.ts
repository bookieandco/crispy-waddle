export const CINEMATIC_LIGHTING_ORDER = Object.freeze([
  'direction',
  'quality',
  'color',
  'intensity',
  'cut-shape',
] as const);

export type CinematicLightingAttribute = typeof CINEMATIC_LIGHTING_ORDER[number];

export type LightingDirectionKind =
  | 'front'
  | 'butterfly'
  | 'rembrandt'
  | 'side'
  | 'kicker'
  | 'backlight'
  | 'custom';

export type LightingUnitRole =
  | 'key'
  | 'fill'
  | 'background'
  | 'practical'
  | 'edge'
  | 'ambient'
  | 'custom';

export interface LightingDirectionSetup {
  id:string;
  role:LightingUnitRole;
  direction:LightingDirectionKind;
  subjectIds:readonly string[];
  horizontalAngleDegrees?:number;
  downwardAngleDegrees?:number;
  highPlacement?:boolean;
  narrativeEffect:string;
  placementNotes?:string;
  evidenceIds:readonly string[];
}

export interface SubjectLightingInterpretation {
  subjectId:string;
  sourceSetupId:string;
  perceivedDirection:LightingDirectionKind;
  blockingRef:string;
  evidenceIds:readonly string[];
}

export interface LightingQualityPlan {
  quality:'hard'|'soft'|'custom';
  relativeSourceSize:number;
  subjectDistanceMeters?:number;
  diffusion?:string;
  fillDiffusionFrameEvenly?:boolean;
  rationale:string;
  evidenceIds:readonly string[];
}

export interface MotivatedLightingSource {
  id:string;
  kind:'window'|'practical-lamp'|'candle'|'sun'|'moon'|'fluorescent'|'screen'|'custom';
  visibleInFrame:boolean;
  description:string;
  apparentQuality?:'hard'|'soft'|'custom';
  extensionSetupIds:readonly string[];
  evidenceIds:readonly string[];
}

export interface LightingColorPlan {
  keyColorTemperatureKelvin?:number;
  cameraWhiteBalanceKelvin?:number;
  practicalColorTemperatureKelvin?:number;
  backgroundColorTemperatureKelvin?:number;
  gelOrRgbNotes?:readonly string[];
  creativeIntent:string;
  evidenceIds:readonly string[];
}

export interface LightingIntensityPlan {
  keyLevel?:number;
  fillLevel?:number;
  backgroundLevel?:number;
  unit?:'lux'|'foot-candle'|'relative';
  keyToFillStops?:number;
  foregroundToBackgroundStops?:number;
  exposureIntent:string;
  evidenceIds:readonly string[];
}

export type LightingModifierKind =
  | 'topper'
  | 'sider'
  | 'skirt'
  | 'barn-door'
  | 'flag'
  | 'negative-fill'
  | 'bounce'
  | 'snapgrid'
  | 'egg-crate';

export interface LightingCutShapeInstruction {
  id:string;
  kind:LightingModifierKind;
  target:string;
  placement?:'between-source-and-diffusion'|'between-diffusion-and-subject'|'subject-shadow-side'|'under-subject'|'at-source'|'custom';
  purpose:string;
  evidenceIds:readonly string[];
}

export interface LightingSeparationPlan {
  independentSubjectAndBackgroundControl:boolean;
  subjectToBackgroundDistanceMeters?:number;
  pullFurnitureFromWallMeters?:number;
  backgroundSpillStrategy?:string;
  negativeFillStrategy?:string;
  evidenceIds:readonly string[];
}

export type ObservedFaceShadowCue =
  | 'even-face-no-nose-shadow'
  | 'butterfly-shadow-under-nose'
  | 'triangle-light-on-shadow-cheek'
  | 'face-split-light-shadow'
  | 'edge-wrap-on-cheek'
  | 'shoulder-rim-no-cheek-wrap'
  | 'unknown';

export interface LightingObservation {
  id:string;
  subjectId:string;
  cue:ObservedFaceShadowCue;
  confidence:number;
  evidenceIds:readonly string[];
}

export interface LightingDirectionInference {
  direction:LightingDirectionKind|'unknown';
  rationale:string;
  confidence:number;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_LIGHTING_OBSERVATION';
}

export interface CinematographyLightingPlan {
  version:1;
  goal:string;
  attributeOrder:readonly CinematicLightingAttribute[];
  directionSetups:readonly LightingDirectionSetup[];
  subjectInterpretations?:readonly SubjectLightingInterpretation[];
  quality:LightingQualityPlan;
  color:LightingColorPlan;
  motivatedSources?:readonly MotivatedLightingSource[];
  intensity:LightingIntensityPlan;
  separation?:LightingSeparationPlan;
  cutAndShape:readonly LightingCutShapeInstruction[];
  blockingNotes?:readonly string[];
  preserveAcrossCoverage?:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_CINEMATOGRAPHY_LIGHTING';
}

export interface CinematographyLightingIssue {
  code:string;
  severity:'error'|'warning';
  path:string;
  message:string;
}

export function validateCinematographyLightingPlan(
  plan:CinematographyLightingPlan,
):readonly CinematographyLightingIssue[]{
  const issues:CinematographyLightingIssue[]=[];

  if(!plan.goal.trim()) issues.push(issue('LIGHTING_GOAL_REQUIRED','error','goal','Lighting needs a concrete story/emotional goal.'));
  if(!plan.evidenceIds.length) issues.push(issue('LIGHTING_EVIDENCE_REQUIRED','error','evidenceIds','Lighting plan requires evidence/provenance.'));

  if(
    plan.attributeOrder.length!==CINEMATIC_LIGHTING_ORDER.length||
    plan.attributeOrder.some((value,index)=>value!==CINEMATIC_LIGHTING_ORDER[index])
  ){
    issues.push(issue(
      'LIGHTING_ATTRIBUTE_ORDER_INVALID',
      'error',
      'attributeOrder',
      'Work in Direction -> Quality -> Color -> Intensity -> Cut & Shape order to avoid redundant adjustments.',
    ));
  }

  if(!plan.directionSetups.length){
    issues.push(issue('LIGHTING_DIRECTION_REQUIRED','error','directionSetups','Choose the lighting direction before later attributes.'));
  }

  const setupIds=new Set<string>();
  for(const [index,setup] of plan.directionSetups.entries()){
    if(!setup.id.trim()||setupIds.has(setup.id)) issues.push(issue('LIGHTING_SETUP_ID_INVALID','error',`directionSetups[${index}].id`,'Lighting setup IDs must be unique and non-empty.'));
    setupIds.add(setup.id);
    if(!setup.subjectIds.length) issues.push(issue('LIGHTING_SETUP_SUBJECT_REQUIRED','error',`directionSetups[${index}].subjectIds`,'Lighting setup needs one or more subjects.'));
    if(!setup.narrativeEffect.trim()) issues.push(issue('LIGHTING_DIRECTION_EFFECT_REQUIRED','error',`directionSetups[${index}].narrativeEffect`,'Direction should state the intended audience/story effect.'));
    if(!setup.evidenceIds.length) issues.push(issue('LIGHTING_SETUP_EVIDENCE_REQUIRED','error',`directionSetups[${index}].evidenceIds`,'Direction setup needs evidence.'));
    validateAngle(setup.horizontalAngleDegrees,`directionSetups[${index}].horizontalAngleDegrees`,issues);
    validateAngle(setup.downwardAngleDegrees,`directionSetups[${index}].downwardAngleDegrees`,issues);
  }

  for(const [index,interpretation] of (plan.subjectInterpretations??[]).entries()){
    if(!interpretation.subjectId.trim()||!interpretation.blockingRef.trim()){
      issues.push(issue('LIGHTING_BLOCKING_INTERPRETATION_INVALID','error',`subjectInterpretations[${index}]`,'Blocking-aware lighting needs subject and blocking references.'));
    }
    if(!setupIds.has(interpretation.sourceSetupId)){
      issues.push(issue('LIGHTING_BLOCKING_SETUP_UNKNOWN','error',`subjectInterpretations[${index}].sourceSetupId`,'Blocking interpretation must reference an existing lighting setup.'));
    }
    if(!interpretation.evidenceIds.length){
      issues.push(issue('LIGHTING_BLOCKING_EVIDENCE_REQUIRED','error',`subjectInterpretations[${index}].evidenceIds`,'Blocking interpretation needs evidence.'));
    }
  }

  if(!Number.isFinite(plan.quality.relativeSourceSize)||plan.quality.relativeSourceSize<=0){
    issues.push(issue('LIGHTING_RELATIVE_SOURCE_SIZE_INVALID','error','quality.relativeSourceSize','Relative source size must be positive.'));
  }
  if(plan.quality.subjectDistanceMeters!==undefined&&(!Number.isFinite(plan.quality.subjectDistanceMeters)||plan.quality.subjectDistanceMeters<=0)){
    issues.push(issue('LIGHTING_SUBJECT_DISTANCE_INVALID','error','quality.subjectDistanceMeters','Subject distance must be positive.'));
  }
  if(!plan.quality.rationale.trim()||!plan.quality.evidenceIds.length){
    issues.push(issue('LIGHTING_QUALITY_RATIONALE_REQUIRED','error','quality','Lighting quality needs rationale and evidence.'));
  }

  for(const source of plan.motivatedSources??[]){
    if(!source.id.trim()||!source.description.trim()||!source.evidenceIds.length){
      issues.push(issue('LIGHTING_MOTIVATED_SOURCE_INVALID','error','motivatedSources','Motivated sources need identity, description, and evidence.'));
    }
    for(const setupId of source.extensionSetupIds){
      if(!setupIds.has(setupId)){
        issues.push(issue('LIGHTING_MOTIVATED_EXTENSION_SETUP_UNKNOWN','error',`motivatedSources.${source.id}`,'Motivated extensions must reference existing lighting setups.'));
      }
    }
    if(
      source.apparentQuality==='soft'&&
      source.extensionSetupIds.some(setupId=>plan.quality.quality==='hard'&&setupIds.has(setupId))
    ){
      issues.push(issue(
        'LIGHTING_EXTENSION_HARDER_THAN_MOTIVATED_SOURCE',
        'warning',
        `motivatedSources.${source.id}`,
        'A visibly soft motivated source is being extended with a harder authored quality; the source lesson notes softer extensions are usually easier to sell than harder ones.',
      ));
    }
  }

  for(const [name,value] of [
    ['keyColorTemperatureKelvin',plan.color.keyColorTemperatureKelvin],
    ['cameraWhiteBalanceKelvin',plan.color.cameraWhiteBalanceKelvin],
    ['practicalColorTemperatureKelvin',plan.color.practicalColorTemperatureKelvin],
    ['backgroundColorTemperatureKelvin',plan.color.backgroundColorTemperatureKelvin],
  ] as const){
    if(value!==undefined&&(!Number.isFinite(value)||value<=0)){
      issues.push(issue('LIGHTING_COLOR_TEMPERATURE_INVALID','error',`color.${name}`,'Color temperature must be positive Kelvin.'));
    }
  }
  if(!plan.color.creativeIntent.trim()||!plan.color.evidenceIds.length){
    issues.push(issue('LIGHTING_COLOR_INTENT_REQUIRED','error','color','Color needs creative intent and evidence.'));
  }

  for(const [name,value] of [
    ['keyToFillStops',plan.intensity.keyToFillStops],
    ['foregroundToBackgroundStops',plan.intensity.foregroundToBackgroundStops],
  ] as const){
    if(value!==undefined&&(!Number.isFinite(value)||value<0)){
      issues.push(issue('LIGHTING_RATIO_STOPS_INVALID','error',`intensity.${name}`,'Lighting contrast in stops must be finite and non-negative.'));
    }
  }
  if(!plan.intensity.exposureIntent.trim()||!plan.intensity.evidenceIds.length){
    issues.push(issue('LIGHTING_INTENSITY_INTENT_REQUIRED','error','intensity','Intensity/exposure needs creative intent and evidence.'));
  }

  if(plan.separation){
    if(!plan.separation.evidenceIds.length){
      issues.push(issue('LIGHTING_SEPARATION_EVIDENCE_REQUIRED','error','separation.evidenceIds','Subject/background separation needs evidence.'));
    }
    for(const [name,value] of [
      ['subjectToBackgroundDistanceMeters',plan.separation.subjectToBackgroundDistanceMeters],
      ['pullFurnitureFromWallMeters',plan.separation.pullFurnitureFromWallMeters],
    ] as const){
      if(value!==undefined&&(!Number.isFinite(value)||value<0)){
        issues.push(issue('LIGHTING_SEPARATION_DISTANCE_INVALID','error',`separation.${name}`,'Separation distances must be finite and non-negative.'));
      }
    }
  }

  for(const [index,modifier] of plan.cutAndShape.entries()){
    if(!modifier.id.trim()||!modifier.target.trim()||!modifier.purpose.trim()||!modifier.evidenceIds.length){
      issues.push(issue('LIGHTING_MODIFIER_INVALID','error',`cutAndShape[${index}]`,'Lighting modifiers need identity, target, purpose, and evidence.'));
    }
    if(
      modifier.kind==='flag'&&
      plan.quality.diffusion&&
      modifier.placement==='between-source-and-diffusion'
    ){
      issues.push(issue(
        'LIGHTING_FLAG_PLACEMENT_SUBOPTIMAL',
        'warning',
        `cutAndShape[${index}].placement`,
        'With diffusion, placing the flag between diffusion and subject generally produces a cleaner cut and is less likely to change softness/intensity.',
      ));
    }
  }

  return Object.freeze(issues);
}

export function assertCinematographyLightingPlan(
  plan:CinematographyLightingPlan,
):CinematographyLightingPlan{
  const errors=validateCinematographyLightingPlan(plan).filter(candidate=>candidate.severity==='error');
  if(errors.length){
    throw new Error(`DIRECTOR_LIGHTING_PLAN_INVALID: ${errors.map(candidate=>`${candidate.code}@${candidate.path}`).join(', ')}`);
  }
  return plan;
}

export function compileCinematographyLightingDirective(
  plan:CinematographyLightingPlan,
):string{
  assertCinematographyLightingPlan(plan);
  const lines:string[]=[
    `Lighting goal: ${plan.goal.trim()}`,
    'Work order: Direction -> Quality/softness -> Color -> Intensity/exposure -> Cut & Shape.',
    `Direction: ${plan.directionSetups.map(compileDirection).join(' | ')}`,
  ];

  if(plan.subjectInterpretations?.length){
    lines.push(`Blocking-aware direction: ${plan.subjectInterpretations.map(item=>
      `${item.subjectId} reads as ${item.perceivedDirection} from ${item.sourceSetupId} at ${item.blockingRef}`
    ).join(' | ')}`);
  }

  lines.push(`Quality: ${[
    plan.quality.quality,
    `relative source size ${fmt(plan.quality.relativeSourceSize)}`,
    plan.quality.subjectDistanceMeters!==undefined&&`subject distance ${fmt(plan.quality.subjectDistanceMeters)}m`,
    plan.quality.diffusion&&`diffusion ${plan.quality.diffusion}`,
    plan.quality.fillDiffusionFrameEvenly&&'fill diffusion frame evenly',
    plan.quality.rationale,
  ].filter(Boolean).join('; ')}`);

  lines.push(`Color: ${[
    plan.color.keyColorTemperatureKelvin!==undefined&&`key ${fmt(plan.color.keyColorTemperatureKelvin)}K`,
    plan.color.cameraWhiteBalanceKelvin!==undefined&&`camera WB ${fmt(plan.color.cameraWhiteBalanceKelvin)}K`,
    plan.color.practicalColorTemperatureKelvin!==undefined&&`practical ${fmt(plan.color.practicalColorTemperatureKelvin)}K`,
    plan.color.backgroundColorTemperatureKelvin!==undefined&&`background ${fmt(plan.color.backgroundColorTemperatureKelvin)}K`,
    ...(plan.color.gelOrRgbNotes??[]),
    plan.color.creativeIntent,
  ].filter(Boolean).join('; ')}`);

  if(plan.motivatedSources?.length){
    lines.push(`Motivated sources: ${plan.motivatedSources.map(source=>[
      source.kind,
      source.visibleInFrame?'visible in frame':'off-screen',
      source.description,
      source.apparentQuality&&`apparent quality ${source.apparentQuality}`,
      source.extensionSetupIds.length&&`extended by ${source.extensionSetupIds.join(', ')}`,
    ].filter(Boolean).join('; ')).join(' | ')}`);
  }

  lines.push(`Intensity/exposure: ${[
    formatLevel('key',plan.intensity.keyLevel,plan.intensity.unit),
    formatLevel('fill',plan.intensity.fillLevel,plan.intensity.unit),
    formatLevel('background',plan.intensity.backgroundLevel,plan.intensity.unit),
    plan.intensity.keyToFillStops!==undefined&&`key-to-fill ${fmt(plan.intensity.keyToFillStops)} stops (${fmt(stopsToBrightnessRatio(plan.intensity.keyToFillStops))}:1)`,
    plan.intensity.foregroundToBackgroundStops!==undefined&&`foreground-to-background ${fmt(plan.intensity.foregroundToBackgroundStops)} stops (${fmt(stopsToBrightnessRatio(plan.intensity.foregroundToBackgroundStops))}:1)`,
    plan.intensity.exposureIntent,
  ].filter(Boolean).join('; ')}`);

  if(plan.separation){
    lines.push(`Subject/background separation: ${[
      plan.separation.independentSubjectAndBackgroundControl?'independent subject/background control':'shared subject/background control',
      plan.separation.subjectToBackgroundDistanceMeters!==undefined&&`subject-background distance ${fmt(plan.separation.subjectToBackgroundDistanceMeters)}m`,
      plan.separation.pullFurnitureFromWallMeters!==undefined&&`pull furniture from wall ${fmt(plan.separation.pullFurnitureFromWallMeters)}m`,
      plan.separation.backgroundSpillStrategy,
      plan.separation.negativeFillStrategy,
    ].filter(Boolean).join('; ')}`);
  }

  if(plan.cutAndShape.length){
    lines.push(`Cut & Shape: ${plan.cutAndShape.map(modifier=>[
      modifier.kind,
      `target ${modifier.target}`,
      modifier.placement&&`placement ${modifier.placement}`,
      modifier.purpose,
    ].filter(Boolean).join(', ')).join(' | ')}`);
  }

  if(plan.blockingNotes?.length) lines.push(`Blocking collaboration: ${plan.blockingNotes.join(' | ')}`);
  if(plan.preserveAcrossCoverage?.length) lines.push(`Preserve across coverage: ${plan.preserveAcrossCoverage.join(', ')}`);

  return lines.join('\n');
}

export function stopsToBrightnessRatio(stops:number):number{
  if(!Number.isFinite(stops)||stops<0) throw new Error('DIRECTOR_LIGHTING_STOPS_INVALID');
  return 2**stops;
}

function compileDirection(setup:LightingDirectionSetup):string{
  return [
    `${setup.role} ${setup.direction}`,
    setup.horizontalAngleDegrees!==undefined&&`${fmt(setup.horizontalAngleDegrees)}° horizontal`,
    setup.downwardAngleDegrees!==undefined&&`${fmt(setup.downwardAngleDegrees)}° down`,
    setup.highPlacement&&'high placement',
    `subjects ${setup.subjectIds.join(', ')}`,
    `effect ${setup.narrativeEffect}`,
    setup.placementNotes,
  ].filter(Boolean).join('; ');
}

function formatLevel(label:string,value:number|undefined,unit:LightingIntensityPlan['unit']):string|undefined{
  return value===undefined?undefined:`${label} ${fmt(value)} ${unit??'relative'}`;
}

function validateAngle(value:number|undefined,path:string,issues:CinematographyLightingIssue[]):void{
  if(value!==undefined&&(!Number.isFinite(value)||value<0||value>360)){
    issues.push(issue('LIGHTING_ANGLE_INVALID','error',path,'Lighting angle must be between 0 and 360 degrees.'));
  }
}

function issue(code:string,severity:'error'|'warning',path:string,message:string):CinematographyLightingIssue{
  return {code,severity,path,message};
}

function fmt(value:number):string{
  return Number.isInteger(value)?String(value):String(Number(value.toFixed(3)));
}


export function inferLightingDirectionFromObservation(
  observation:LightingObservation,
):LightingDirectionInference{
  if(
    !observation.id.trim()||
    !observation.subjectId.trim()||
    !Number.isFinite(observation.confidence)||
    observation.confidence<0||
    observation.confidence>1||
    !observation.evidenceIds.length
  ){
    throw new Error('DIRECTOR_LIGHTING_OBSERVATION_INVALID');
  }

  const mapping:Record<ObservedFaceShadowCue,{direction:LightingDirectionKind|'unknown';rationale:string}>={
    'even-face-no-nose-shadow':{
      direction:'front',
      rationale:'Even facial illumination with no visible nose shadow is consistent with front lighting.',
    },
    'butterfly-shadow-under-nose':{
      direction:'butterfly',
      rationale:'A centered butterfly-shaped nose shadow is consistent with a high frontal butterfly setup.',
    },
    'triangle-light-on-shadow-cheek':{
      direction:'rembrandt',
      rationale:'A triangle of light on the shadow-side cheek is the characteristic Rembrandt cue described in the source.',
    },
    'face-split-light-shadow':{
      direction:'side',
      rationale:'A face divided strongly between lit and shadow halves is consistent with side lighting.',
    },
    'edge-wrap-on-cheek':{
      direction:'kicker',
      rationale:'A rear edge that wraps onto the cheek is consistent with a kicker/edge light.',
    },
    'shoulder-rim-no-cheek-wrap':{
      direction:'backlight',
      rationale:'A rear shoulder/head rim without cheek wrap is consistent with backlight.',
    },
    unknown:{
      direction:'unknown',
      rationale:'The supplied shadow cue is insufficient to classify lighting direction.',
    },
  };

  const result=mapping[observation.cue];
  return Object.freeze({
    ...result,
    confidence:observation.confidence,
    evidenceIds:Object.freeze([...observation.evidenceIds]),
    authority:'DIRECTOR_LIGHTING_OBSERVATION',
  });
}

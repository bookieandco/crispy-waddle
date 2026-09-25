import type {
  CameraAngle,
  CameraFormApproach,
  CameraMovementKind,
  CameraShotSize,
} from './camera-language.js';

export type ObservedCompositionCue =
  | 'symmetry'
  | 'rule-of-thirds'
  | 'leading-lines'
  | 'short-sided'
  | 'lead-room'
  | 'headroom'
  | 'negative-space'
  | 'centered'
  | 'custom';

export interface CameraCompositionObservation {
  cue:ObservedCompositionCue;
  description:string;
  attentionTarget?:string;
  evidenceIds:readonly string[];
}

export interface CinematographyObservation {
  id:string;
  shotId:string;
  shotSize:CameraShotSize;
  angle?:CameraAngle;
  movements:readonly CameraMovementKind[];
  composition:readonly CameraCompositionObservation[];
  opticsNotes?:readonly string[];
  observedFormApproach?:CameraFormApproach|'undetermined';
  formApproachRationale?:string;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_CAMERA_OBSERVATION';
}

export interface CameraMeaningReading {
  featureRef:string;
  possibleMeaning:string;
  rationale:string;
  contextEvidenceIds:readonly string[];
}

export interface CinematographyInterpretation {
  id:string;
  observationId:string;
  sceneToneOrTheme:string;
  readings:readonly CameraMeaningReading[];
  confidence:number;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_CAMERA_INTERPRETATION';
}

export function validateCinematographyObservation(
  observation:CinematographyObservation,
):readonly string[]{
  const reasons:string[]=[];
  if(!observation.id.trim()||!observation.shotId.trim()){
    reasons.push('DIRECTOR_CAMERA_OBSERVATION_IDENTITY_REQUIRED');
  }
  if(!observation.movements.length){
    reasons.push('DIRECTOR_CAMERA_OBSERVATION_MOVEMENT_REQUIRED');
  }
  if(!observation.evidenceIds.length){
    reasons.push('DIRECTOR_CAMERA_OBSERVATION_EVIDENCE_REQUIRED');
  }
  for(const [index,cue] of observation.composition.entries()){
    if(!cue.description.trim()||!cue.evidenceIds.length){
      reasons.push(`DIRECTOR_CAMERA_COMPOSITION_OBSERVATION_INVALID:${index}`);
    }
  }
  if(
    observation.observedFormApproach&&
    observation.observedFormApproach!=='undetermined'&&
    !observation.formApproachRationale?.trim()
  ){
    reasons.push('DIRECTOR_CAMERA_FORM_APPROACH_RATIONALE_REQUIRED');
  }
  return Object.freeze([...new Set(reasons)]);
}

export function describeObservedCinematography(
  observation:CinematographyObservation,
):string{
  const reasons=validateCinematographyObservation(observation);
  if(reasons.length) throw new Error(`DIRECTOR_CAMERA_OBSERVATION_INVALID: ${reasons.join(', ')}`);

  const lines=[
    `Position: ${[observation.shotSize,observation.angle].filter(Boolean).join(', ')}`,
    `Composition: ${observation.composition.length
      ? observation.composition.map(item=>[
          item.cue,
          item.description,
          item.attentionTarget&&`attention ${item.attentionTarget}`,
        ].filter(Boolean).join('; ')).join(' | ')
      : 'no structured composition cue recorded'}`,
    `Movement: ${observation.movements.join(', ')}`,
  ];
  if(observation.opticsNotes?.length) lines.push(`Optics: ${observation.opticsNotes.join(' | ')}`);
  if(observation.observedFormApproach){
    lines.push(`Observed film-form approach: ${observation.observedFormApproach}${observation.formApproachRationale?` — ${observation.formApproachRationale}`:''}`);
  }
  return lines.join('\n');
}

export function validateCinematographyInterpretation(
  observation:CinematographyObservation,
  interpretation:CinematographyInterpretation,
):readonly string[]{
  const reasons=[...validateCinematographyObservation(observation)];
  if(!interpretation.id.trim()||interpretation.observationId!==observation.id){
    reasons.push('DIRECTOR_CAMERA_INTERPRETATION_LINEAGE_REQUIRED');
  }
  if(!interpretation.sceneToneOrTheme.trim()){
    reasons.push('DIRECTOR_CAMERA_INTERPRETATION_CONTEXT_REQUIRED');
  }
  if(!Number.isFinite(interpretation.confidence)||interpretation.confidence<0||interpretation.confidence>1){
    reasons.push('DIRECTOR_CAMERA_INTERPRETATION_CONFIDENCE_INVALID');
  }
  if(!interpretation.readings.length){
    reasons.push('DIRECTOR_CAMERA_INTERPRETATION_READING_REQUIRED');
  }
  if(!interpretation.evidenceIds.length){
    reasons.push('DIRECTOR_CAMERA_INTERPRETATION_EVIDENCE_REQUIRED');
  }

  const allowedFeatureRefs=new Set<string>([
    `shot-size:${observation.shotSize}`,
    ...(observation.angle?[`angle:${observation.angle}`]:[]),
    ...observation.movements.map(movement=>`movement:${movement}`),
    ...observation.composition.map((cue,index)=>`composition:${index}:${cue.cue}`),
  ]);

  for(const [index,reading] of interpretation.readings.entries()){
    if(!allowedFeatureRefs.has(reading.featureRef)){
      reasons.push(`DIRECTOR_CAMERA_INTERPRETATION_FEATURE_UNKNOWN:${reading.featureRef}`);
    }
    if(!reading.possibleMeaning.trim()||!reading.rationale.trim()||!reading.contextEvidenceIds.length){
      reasons.push(`DIRECTOR_CAMERA_INTERPRETATION_READING_INVALID:${index}`);
    }
  }

  return Object.freeze([...new Set(reasons)]);
}

export function compileCinematographyInterpretation(
  observation:CinematographyObservation,
  interpretation:CinematographyInterpretation,
):string{
  const reasons=validateCinematographyInterpretation(observation,interpretation);
  if(reasons.length) throw new Error(`DIRECTOR_CAMERA_INTERPRETATION_INVALID: ${reasons.join(', ')}`);

  return [
    describeObservedCinematography(observation),
    `Scene tone/theme: ${interpretation.sceneToneOrTheme}`,
    'Contextual readings:',
    ...interpretation.readings.map(reading=>
      `- ${reading.featureRef}: ${reading.possibleMeaning} because ${reading.rationale}`
    ),
    `Interpretive confidence: ${interpretation.confidence}`,
    'Interpretations are contextual hypotheses, not fixed meanings of camera techniques.',
  ].join('\n');
}

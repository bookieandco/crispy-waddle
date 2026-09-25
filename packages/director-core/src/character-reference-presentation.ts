import type { CharacterReferenceView } from './character-reference-bootstrap.js';

export type CharacterReferenceBackground =
  | { kind:'neutral-gray'; reflectancePercent?:number }
  | { kind:'white' }
  | { kind:'transparent' }
  | { kind:'custom'; description:string };

export interface CharacterReferencePresentationProfile {
  id:string;
  background:CharacterReferenceBackground;
  lighting:'flat-even'|'soft-even'|'custom';
  lightingNotes?:string;
  recommendedPanelCount?:number;
  preferredViews:readonly CharacterReferenceView[];
  includeFullBody:boolean;
  includeCloseUp:boolean;
  evidenceIds:readonly string[];
  authority:'DIRECTOR_CHARACTER_REFERENCE_PRESENTATION';
}

export function validateCharacterReferencePresentationProfile(
  profile:CharacterReferencePresentationProfile,
):readonly string[]{
  const reasons:string[]=[];
  if(!profile.id.trim()) reasons.push('DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_ID_REQUIRED');
  if(!profile.preferredViews.length) reasons.push('DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_VIEWS_REQUIRED');
  if(!profile.evidenceIds.length) reasons.push('DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_EVIDENCE_REQUIRED');
  if(
    profile.recommendedPanelCount!==undefined &&
    (!Number.isInteger(profile.recommendedPanelCount)||profile.recommendedPanelCount<1)
  ) reasons.push('DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_PANEL_COUNT_INVALID');
  if(
    profile.background.kind==='neutral-gray' &&
    profile.background.reflectancePercent!==undefined &&
    (!Number.isFinite(profile.background.reflectancePercent)||
      profile.background.reflectancePercent<=0||
      profile.background.reflectancePercent>=100)
  ) reasons.push('DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_GRAY_INVALID');
  if(profile.background.kind==='custom'&&!profile.background.description.trim()){
    reasons.push('DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_BACKGROUND_DESCRIPTION_REQUIRED');
  }
  if(profile.lighting==='custom'&&!profile.lightingNotes?.trim()){
    reasons.push('DIRECTOR_CHARACTER_REFERENCE_PRESENTATION_LIGHTING_DESCRIPTION_REQUIRED');
  }
  return Object.freeze([...new Set(reasons)]);
}

/**
 * Source-derived working profile from the supplied tutorial.
 * This is a provider/workflow recommendation, not a universal character-sheet rule.
 */
export const SOURCE_FLAT_GRAY_CHARACTER_REFERENCE_PROFILE:CharacterReferencePresentationProfile=Object.freeze({
  id:'source:flat-gray-character-sheet:v1',
  background:Object.freeze({kind:'neutral-gray' as const,reflectancePercent:18}),
  lighting:'flat-even',
  recommendedPanelCount:3,
  preferredViews:Object.freeze(['front','rear','close-up'] as CharacterReferenceView[]),
  includeFullBody:true,
  includeCloseUp:true,
  evidenceIds:Object.freeze(['source:ai-cinematic-story-workflow']),
  authority:'DIRECTOR_CHARACTER_REFERENCE_PRESENTATION',
});

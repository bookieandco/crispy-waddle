export interface StoryBibleTimelineBeat {
  id:string;
  order:number;
  label:string;
  summary:string;
  evidenceIds:readonly string[];
}

export interface StoryBibleLocation {
  id:string;
  locationRef:string;
  label:string;
  storyFunction:string;
  continuityNotes:readonly string[];
  evidenceIds:readonly string[];
}

export interface StoryBibleCharacter {
  characterId:string;
  castRecordId:string;
  voiceIdentityId?:string;
  voiceTonality:string;
  personalityTraits:readonly string[];
  defaultEmotionalState?:string;
  storyFunction:string;
  evidenceIds:readonly string[];
}

export interface CinematicStoryBible {
  id:string;
  projectId:string;
  premise:string;
  thesis:string;
  plotSummary:string;
  timeline:readonly StoryBibleTimelineBeat[];
  locations:readonly StoryBibleLocation[];
  characters:readonly StoryBibleCharacter[];
  lockedCreativeTruths:readonly string[];
  evidenceIds:readonly string[];
  authority:'DIRECTOR_STORY_BIBLE';
}

export function validateCinematicStoryBible(
  bible:CinematicStoryBible,
):readonly string[]{
  const reasons:string[]=[];
  if(!bible.id.trim()||!bible.projectId.trim()) reasons.push('DIRECTOR_STORY_BIBLE_IDENTITY_REQUIRED');
  if(!bible.premise.trim()) reasons.push('DIRECTOR_STORY_BIBLE_PREMISE_REQUIRED');
  if(!bible.thesis.trim()) reasons.push('DIRECTOR_STORY_BIBLE_THESIS_REQUIRED');
  if(!bible.plotSummary.trim()) reasons.push('DIRECTOR_STORY_BIBLE_PLOT_REQUIRED');
  if(!bible.timeline.length) reasons.push('DIRECTOR_STORY_BIBLE_TIMELINE_REQUIRED');
  if(!bible.locations.length) reasons.push('DIRECTOR_STORY_BIBLE_LOCATIONS_REQUIRED');
  if(!bible.characters.length) reasons.push('DIRECTOR_STORY_BIBLE_CHARACTERS_REQUIRED');
  if(!bible.lockedCreativeTruths.length) reasons.push('DIRECTOR_STORY_BIBLE_LOCKS_REQUIRED');
  if(!bible.evidenceIds.length) reasons.push('DIRECTOR_STORY_BIBLE_EVIDENCE_REQUIRED');

  const beatIds=new Set<string>();
  const orders=new Set<number>();
  for(const beat of bible.timeline){
    if(!beat.id.trim()||beatIds.has(beat.id)) reasons.push(`DIRECTOR_STORY_BIBLE_BEAT_ID_INVALID:${beat.id||'unknown'}`);
    beatIds.add(beat.id);
    if(!Number.isInteger(beat.order)||beat.order<1||orders.has(beat.order)) reasons.push(`DIRECTOR_STORY_BIBLE_BEAT_ORDER_INVALID:${beat.id}`);
    orders.add(beat.order);
    if(!beat.label.trim()||!beat.summary.trim()||!beat.evidenceIds.length) reasons.push(`DIRECTOR_STORY_BIBLE_BEAT_INVALID:${beat.id}`);
  }

  const locationIds=new Set<string>();
  for(const location of bible.locations){
    if(!location.id.trim()||locationIds.has(location.id)) reasons.push(`DIRECTOR_STORY_BIBLE_LOCATION_ID_INVALID:${location.id||'unknown'}`);
    locationIds.add(location.id);
    if(!location.locationRef.trim()||!location.label.trim()||!location.storyFunction.trim()||!location.evidenceIds.length){
      reasons.push(`DIRECTOR_STORY_BIBLE_LOCATION_INVALID:${location.id}`);
    }
  }

  const characterIds=new Set<string>();
  for(const character of bible.characters){
    if(!character.characterId.trim()||characterIds.has(character.characterId)){
      reasons.push(`DIRECTOR_STORY_BIBLE_CHARACTER_ID_INVALID:${character.characterId||'unknown'}`);
    }
    characterIds.add(character.characterId);
    if(
      !character.castRecordId.trim()||
      !character.voiceTonality.trim()||
      !character.personalityTraits.length||
      !character.storyFunction.trim()||
      !character.evidenceIds.length
    ){
      reasons.push(`DIRECTOR_STORY_BIBLE_CHARACTER_INVALID:${character.characterId}`);
    }
  }

  return Object.freeze([...new Set(reasons)]);
}

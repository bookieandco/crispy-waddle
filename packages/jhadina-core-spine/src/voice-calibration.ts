import {JHADINA_CANONICAL_VOICE_IDENTITY_ID} from './jhadina-voice-identity.js';
import type {ExpressionProsodyGenome} from './types.js';

export type VoiceCalibrationCategory =
  | 'normal'
  | 'thoughtful'
  | 'playful'
  | 'serious'
  | 'excited'
  | 'quiet-intimate'
  | 'command-urgent'
  | 'storytelling'
  | 'make-it-make-sense'
  | 'operational-sass'
  | 'short-quip'
  | 'shared-bit'
  | 'callback-reentry';

export interface VoiceCalibrationSample {
  id:string;
  voiceIdentityId:string;
  category:VoiceCalibrationCategory;
  text:string;
  intent:string;
  syntheticScenario:boolean;
  identityMustRemainStable:true;
  delivery:Partial<ExpressionProsodyGenome>;
}

export interface VoiceCalibrationPack {
  id:string;
  version:number;
  voiceIdentityId:string;
  language:string;
  samples:readonly VoiceCalibrationSample[];
}

export const REQUIRED_VOICE_CALIBRATION_CATEGORIES:readonly VoiceCalibrationCategory[]=Object.freeze([
  'normal',
  'thoughtful',
  'playful',
  'serious',
  'excited',
  'quiet-intimate',
  'command-urgent',
  'storytelling',
  'make-it-make-sense',
  'operational-sass',
  'short-quip',
  'shared-bit',
  'callback-reentry',
]);

function sample(
  category:VoiceCalibrationCategory,
  text:string,
  intent:string,
  delivery:Partial<ExpressionProsodyGenome>,
):VoiceCalibrationSample{
  return Object.freeze({
    id:`jhadina-calibration:v1:${category}`,
    voiceIdentityId:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
    category,
    text,
    intent,
    syntheticScenario:true,
    identityMustRemainStable:true as const,
    delivery:Object.freeze({...delivery}),
  });
}

/**
 * Original calibration copy. These lines test Jhadina's own performance mechanics;
 * they are not quotes, imitation prompts, or biometric references to any source person.
 */
export const JHADINA_VOICE_CALIBRATION_PACK_V1:VoiceCalibrationPack=Object.freeze({
  id:'jhadina-voice-calibration:v1',
  version:1,
  voiceIdentityId:JHADINA_CANONICAL_VOICE_IDENTITY_ID,
  language:'en-US',
  samples:Object.freeze([
    sample(
      'normal',
      'Alright, I have it. Here is the clean version, and then we can deal with the weird part.',
      'Everyday competent conversation: warm, grounded, direct, unhurried.',
      {cadence:0.52,microPauseDensity:0.35,energy:0.56,warmth:0.72,groundedConfidence:0.82,conversationality:0.86,sentenceFinality:0.68,spontaneity:0.55},
    ),
    sample(
      'thoughtful',
      'Hmm. There are two things happening here. One is what the evidence says, and the other is the story our brains want to finish for it.',
      'Reflective live-thinking with space, soft uncertainty, and a grounded synthesis.',
      {cadence:0.72,microPauseDensity:0.70,thoughtPauseDurationMs:650,energy:0.38,warmth:0.74,groundedConfidence:0.70,conversationality:0.78,intimacy:0.34,breathiness:0.26,spontaneity:0.48},
    ),
    sample(
      'playful',
      'Oh, so we made it simple and then immediately found a way to make it complicated again. Cute. Here is the fix.',
      'Light teasing and quick contrast without slowing down the task.',
      {cadence:0.58,microPauseDensity:0.30,pitchRange:0.66,pitchContour:'dynamic',energy:0.72,warmth:0.70,playfulness:0.82,spontaneity:0.76,reactionIntensity:0.72,operationalSass:0.36},
    ),
    sample(
      'serious',
      'This part matters. I am separating what we know, what we can verify, and what is still an assumption before we do anything else.',
      'Precision-first serious delivery with zero bit, flourish, or emotional overstatement.',
      {cadence:0.28,microPauseDensity:0.24,pitchRange:0.28,pitchContour:'level',energy:0.50,warmth:0.46,groundedConfidence:0.90,conversationality:0.36,playfulness:0,operationalSass:0,absurdEscalation:0,sentenceFinality:0.92},
    ),
    sample(
      'excited',
      'Okay, this actually connects. The memory layer, the behavior layer, and the voice layer can all use the same receipt instead of guessing at each other.',
      'Real excitement without changing identity, shouting, or becoming cartoonish.',
      {cadence:0.56,microPauseDensity:0.28,pitchRange:0.74,pitchContour:'dynamic',energy:0.84,warmth:0.76,groundedConfidence:0.84,conversationality:0.88,spontaneity:0.82,reactionIntensity:0.82},
    ),
    sample(
      'quiet-intimate',
      'You do not have to solve the whole thing in one thought. Give me the part that feels tangled, and we will make that part clearer first.',
      'Quiet relational warmth with closeness but no therapy performance or forced sentimentality.',
      {cadence:0.78,microPauseDensity:0.78,thoughtPauseDurationMs:760,pitchRange:0.34,pitchContour:'gentle',energy:0.28,warmth:0.88,groundedConfidence:0.70,conversationality:0.78,intimacy:0.78,breathiness:0.34,sentenceFinality:0.54},
    ),
    sample(
      'command-urgent',
      'Stop the current run. Preserve the logs, freeze the state, and do not overwrite anything until we know what failed.',
      'Urgent operational command: controlled, clipped, unmistakable, not panicked.',
      {cadence:0.24,microPauseDensity:0.18,pitchRange:0.36,pitchContour:'level',energy:0.78,warmth:0.24,groundedConfidence:0.96,conversationality:0.24,emphasis:0.94,sentenceFinality:0.98,spontaneity:0.16},
    ),
    sample(
      'storytelling',
      'Picture it: the system wakes up thinking it has one little job. Ten minutes later it has three tabs open, two side quests, and somehow a spreadsheet with feelings.',
      'Narrative setup, visual detail, controlled escalation, then a clean landing.',
      {cadence:0.60,microPauseDensity:0.46,pitchRange:0.70,pitchContour:'dynamic',energy:0.68,warmth:0.74,conversationality:0.88,spontaneity:0.74,playfulness:0.72,absurdEscalation:0.62,storytellingIntensity:0.90},
    ),
    sample(
      'make-it-make-sense',
      'It sounds neat, but neat is not evidence. The timeline has to work, the incentives have to work, and the explanation still has to beat the boring alternatives.',
      'Skeptical coherence check: direct, curious, evidence-disciplined, not dismissive.',
      {cadence:0.40,microPauseDensity:0.34,pitchRange:0.42,pitchContour:'gentle',energy:0.58,warmth:0.48,groundedConfidence:0.92,conversationality:0.62,emphasis:0.82,sentenceFinality:0.82,playfulness:0.16},
    ),
    sample(
      'operational-sass',
      'You can absolutely hand me twelve things at once. I can also tell you which three are blocking the other nine, because chaos does not get extra credit for being ambitious.',
      'Competence first, then bounded sass; never changes task semantics or protocol.',
      {cadence:0.50,microPauseDensity:0.30,pitchRange:0.58,pitchContour:'dynamic',energy:0.66,warmth:0.62,groundedConfidence:0.90,conversationality:0.82,spontaneity:0.68,playfulness:0.62,operationalSass:0.78},
    ),
    sample(
      'short-quip',
      'That bug came in wearing a fake mustache. Found it.',
      'Fast reaction line: brief, immediate, then stop.',
      {cadence:0.38,microPauseDensity:0.18,pitchRange:0.64,pitchContour:'dynamic',energy:0.68,warmth:0.64,groundedConfidence:0.86,conversationality:0.84,spontaneity:0.92,reactionIntensity:0.90,playfulness:0.86},
    ),
    sample(
      'shared-bit',
      'See, now you are feeding the bit. Fine, we have officially gone from one joke to a whole franchise. One more beat, then back to work.',
      'Escalate a user-built bit without losing the exit or the real task.',
      {cadence:0.56,microPauseDensity:0.32,pitchRange:0.72,pitchContour:'dynamic',energy:0.74,warmth:0.72,conversationality:0.92,spontaneity:0.86,reactionIntensity:0.82,playfulness:0.90,absurdEscalation:0.76},
    ),
    sample(
      'callback-reentry',
      'Yep, same kind of nonsense as before. I caught it. Anyway, back to the actual build: the identity receipt is the part that still matters.',
      'Synthetic callback mechanics followed by a crisp return to the task; never claims real shared history.',
      {cadence:0.48,microPauseDensity:0.30,pitchRange:0.54,pitchContour:'gentle',energy:0.58,warmth:0.70,groundedConfidence:0.86,conversationality:0.88,spontaneity:0.68,playfulness:0.52,sentenceFinality:0.72},
    ),
  ]),
});

export function validateVoiceCalibrationPack(pack:VoiceCalibrationPack):readonly string[]{
  const reasons:string[]=[];
  if(!pack.id.trim()||!Number.isInteger(pack.version)||pack.version<=0) reasons.push('VOICE_CALIBRATION_ID_VERSION_REQUIRED');
  if(pack.voiceIdentityId!==JHADINA_CANONICAL_VOICE_IDENTITY_ID) reasons.push('VOICE_CALIBRATION_IDENTITY_MISMATCH');
  if(!pack.language.trim()) reasons.push('VOICE_CALIBRATION_LANGUAGE_REQUIRED');

  const ids=new Set<string>();
  const categories=new Set<VoiceCalibrationCategory>();
  for(const item of pack.samples){
    if(ids.has(item.id)) reasons.push(`VOICE_CALIBRATION_DUPLICATE_ID:${item.id}`);
    ids.add(item.id);
    if(categories.has(item.category)) reasons.push(`VOICE_CALIBRATION_DUPLICATE_CATEGORY:${item.category}`);
    categories.add(item.category);
    if(item.voiceIdentityId!==pack.voiceIdentityId) reasons.push(`VOICE_CALIBRATION_SAMPLE_IDENTITY_MISMATCH:${item.id}`);
    if(!item.text.trim()||item.text.length>600) reasons.push(`VOICE_CALIBRATION_TEXT_INVALID:${item.id}`);
    if(!item.intent.trim()) reasons.push(`VOICE_CALIBRATION_INTENT_REQUIRED:${item.id}`);
    if(item.syntheticScenario!==true||item.identityMustRemainStable!==true){
      reasons.push(`VOICE_CALIBRATION_GOVERNANCE_INVALID:${item.id}`);
    }
  }
  for(const category of REQUIRED_VOICE_CALIBRATION_CATEGORIES){
    if(!categories.has(category)) reasons.push(`VOICE_CALIBRATION_CATEGORY_REQUIRED:${category}`);
  }

  const serious=pack.samples.find(item=>item.category==='serious');
  if((serious?.delivery.playfulness??0)>0||(serious?.delivery.operationalSass??0)>0||(serious?.delivery.absurdEscalation??0)>0){
    reasons.push('VOICE_CALIBRATION_SERIOUS_PLAYFULNESS_FORBIDDEN');
  }
  return Object.freeze([...new Set(reasons)]);
}


export interface VoiceCalibrationManifest {
  id:string;
  version:number;
  voiceIdentityId:string;
  language:string;
  categories:readonly VoiceCalibrationCategory[];
  sampleCount:number;
  identityMustRemainStable:true;
}

export function voiceCalibrationManifest(
  pack:VoiceCalibrationPack=JHADINA_VOICE_CALIBRATION_PACK_V1,
):VoiceCalibrationManifest{
  const reasons=validateVoiceCalibrationPack(pack);
  if(reasons.length) throw new Error(`VOICE_CALIBRATION_PACK_INVALID:${reasons.join(';')}`);
  return Object.freeze({
    id:pack.id,
    version:pack.version,
    voiceIdentityId:pack.voiceIdentityId,
    language:pack.language,
    categories:Object.freeze(pack.samples.map(item=>item.category)),
    sampleCount:pack.samples.length,
    identityMustRemainStable:true as const,
  });
}

import { describe, expect, it } from 'vitest';
import {
  selectBestSoundtrackCandidate,
  soundtrackCandidateToTimelineClip,
  speechPerformanceToDialogueRequest,
  validateSoundtrackCandidate,
  validateSoundtrackGenerationBrief,
  validateSpeechPerformancePlan,
  type GeneratedSoundtrackCandidate,
  type SoundtrackGenerationBrief,
  type SpeechPerformancePlan,
} from './creative-audio-generation';

const brief:SoundtrackGenerationBrief={
  id:'soundtrack:1',
  projectId:'project-1',
  purpose:'animated short',
  moodTags:['playful','warm'],
  styleTags:['lo-fi'],
  energy:.55,
  tempo:{mode:'medium'},
  durationSeconds:40,
  variationCount:4,
  sourceVideoAssetId:'video:rough-cut',
  evidenceIds:['timeline:rough-cut','creative-brief:music'],
  authority:'DIRECTOR_SOUNDTRACK_BRIEF',
};

function candidate(
  id:string,
  index:number,
  mood:number,
  purpose:number,
  beat=.8,
):GeneratedSoundtrackCandidate{
  return {
    id,
    requestId:brief.id,
    candidateIndex:index,
    assetId:`audio:${id}`,
    sha256:`sha:${id}`,
    provider:'music-provider',
    modelId:'music-model',
    durationSeconds:40,
    moodAlignmentScore:mood,
    purposeAlignmentScore:purpose,
    beatAlignmentScore:beat,
    rightsEvidenceIds:[`generated-rights:${id}`],
    evidenceIds:[`music-qc:${id}`],
  };
}

const speech:SpeechPerformancePlan={
  id:'speech:1',
  projectId:'project-1',
  characterId:'narrator',
  voiceIdentityId:'voice:narrator',
  voiceVariantId:'voice:narrator:en',
  language:'en',
  text:'One day, Boba left home. She was excited for the adventure.',
  sceneId:'scene:1',
  lineId:'line:1',
  speed:1.05,
  pitchSemitones:0,
  toneSpans:[{
    id:'tone:adventure',
    startChar:25,
    endChar:59,
    tone:'storytelling-excited',
    scope:'sentence',
    evidenceIds:['direction:storytelling'],
  }],
  pauses:[{id:'pause:1',afterChar:24,durationMs:350}],
  targetDurationSeconds:5,
  evidenceIds:['script:approved'],
  authority:'DIRECTOR_SPEECH_PERFORMANCE',
};

describe('creative audio generation',()=> {
  it('validates soundtrack mood/style/energy/tempo/duration/variation controls',()=> {
    expect(validateSoundtrackGenerationBrief(brief)).toEqual([]);
    expect(validateSoundtrackGenerationBrief({...brief,energy:1.4})).toContain(
      'DIRECTOR_SOUNDTRACK_ENERGY_INVALID',
    );
  });

  it('selects among multiple soundtrack variations by admitted QC evidence',()=> {
    const selected=selectBestSoundtrackCandidate(brief,[
      candidate('track-1',1,.84,.82,.75),
      candidate('track-2',2,.95,.94,.91),
      candidate('track-3',3,.89,.97,.85),
      candidate('track-4',4,.6,.95,.95),
    ],{
      durationToleranceSeconds:1,
      minimumMoodAlignment:.8,
      minimumPurposeAlignment:.8,
      minimumBeatAlignment:.7,
    });
    expect(selected?.id).toBe('track-2');
  });

  it('rejects a generated soundtrack candidate with no rights evidence',()=> {
    const invalid={...candidate('track-no-rights',1,.9,.9),rightsEvidenceIds:[]};
    expect(validateSoundtrackCandidate(brief,invalid,{
      durationToleranceSeconds:1,
      minimumMoodAlignment:.8,
      minimumPurposeAlignment:.8,
    })).toContain('DIRECTOR_SOUNDTRACK_RIGHTS_EVIDENCE_REQUIRED');
  });

  it('converts an admitted generated soundtrack to a normal music timeline clip',()=> {
    const clip=soundtrackCandidateToTimelineClip({
      brief,
      candidate:candidate('track-2',2,.95,.94,.91),
      trackId:'music',
      startSeconds:0,
    });
    expect(clip).toMatchObject({
      assetId:'audio:track-2',
      trackId:'music',
      audioRole:'music',
      durationSeconds:40,
    });
  });

  it('compiles tone, pause, speed and pitch into the existing DialogueGenerationRequest',()=> {
    expect(validateSpeechPerformancePlan(speech)).toEqual([]);
    const request=speechPerformanceToDialogueRequest(speech);
    expect(request.voiceIdentityId).toBe('voice:narrator');
    expect(request.text).toBe(speech.text);
    expect(request.deliveryInstruction).toContain('storytelling-excited');
    expect(request.deliveryInstruction).toContain('pause 350ms');
    expect(request.deliveryInstruction).toContain('speed 1.05x');
    expect(request.evidenceIds).toEqual(expect.arrayContaining([
      'script:approved',
      'direction:storytelling',
    ]));
  });

  it('rejects overlapping tone spans instead of producing ambiguous performance markup',()=> {
    const invalid:SpeechPerformancePlan={
      ...speech,
      toneSpans:[
        speech.toneSpans[0]!,
        {
          id:'tone:overlap',
          startChar:30,
          endChar:45,
          tone:'warm',
          scope:'phrase',
          evidenceIds:['direction:warm'],
        },
      ],
    };
    expect(validateSpeechPerformancePlan(invalid)).toContain('DIRECTOR_SPEECH_TONE_SPAN_OVERLAP');
  });
});

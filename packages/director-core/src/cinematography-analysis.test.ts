import {describe,expect,it} from 'vitest';
import {
  compileCinematographyInterpretation,
  describeObservedCinematography,
  validateCinematographyInterpretation,
  type CinematographyObservation,
} from './cinematography-analysis';

const observation:CinematographyObservation={
  id:'camera-observation:1',
  shotId:'shot:1',
  shotSize:'medium-close-up',
  angle:'eye-level',
  movements:['dolly-in'],
  composition:[
    {
      cue:'rule-of-thirds',
      description:'Subject sits on the right third with open negative space to camera left.',
      attentionTarget:'subject face',
      evidenceIds:['frame:120'],
    },
    {
      cue:'leading-lines',
      description:'Hallway lines converge toward the subject.',
      attentionTarget:'subject face',
      evidenceIds:['frame:120'],
    },
    {
      cue:'frame-within-frame',
      description:'Doorway creates a smaller rectangle around the subject.',
      attentionTarget:'subject face',
      evidenceIds:['frame:120'],
    },
    {
      cue:'depth-layering',
      description:'Soft foreground edge, sharp subject midground, and softer hallway background create three visual layers.',
      attentionTarget:'subject face',
      evidenceIds:['frame:120'],
    },
    {
      cue:'luminance-contrast',
      description:'The subject face is brighter than the surrounding hallway.',
      attentionTarget:'subject face',
      evidenceIds:['frame:120'],
    },
  ],
  focusShifts:[
    {
      fromTarget:'foreground subject',
      toTarget:'background doorway',
      triggerOrMoment:'a second character appears',
      evidenceIds:['frame:180','frame:188'],
    },
  ],
  opticsNotes:['shallow depth of field'],
  observedFormApproach:'formalist',
  formApproachRationale:'The conspicuous slow dolly and designed convergence call attention to camera construction.',
  evidenceIds:['clip:shot-1'],
  authority:'DIRECTOR_CAMERA_OBSERVATION',
};

describe('cinematography analysis',()=>{
  it('describes position, composition and movement before interpretation',()=>{
    const description=describeObservedCinematography(observation);
    expect(description.indexOf('Position:')).toBeLessThan(description.indexOf('Composition:'));
    expect(description.indexOf('Composition:')).toBeLessThan(description.indexOf('Movement:'));
    expect(description).toContain('medium-close-up');
    expect(description).toContain('rule-of-thirds');
    expect(description).toContain('frame-within-frame');
    expect(description).toContain('depth-layering');
    expect(description).toContain('luminance-contrast');
    expect(description).toContain('dolly-in');
    expect(description).toContain('Focus shifts: #1 foreground subject -> background doorway');
  });

  it('allows contextual meaning readings without hard-coding technique symbolism',()=>{
    const interpretation={
      id:'camera-interpretation:1',
      observationId:observation.id,
      sceneToneOrTheme:'The character is becoming trapped by a decision.',
      readings:[
        {
          featureRef:'movement:dolly-in',
          possibleMeaning:'increasing psychological pressure',
          rationale:'the camera closes physical distance at the exact beat the character commits to the decision',
          contextEvidenceIds:['performance:decision-beat'],
        },
        {
          featureRef:'composition:0:rule-of-thirds',
          possibleMeaning:'isolation within the surrounding space',
          rationale:'the empty side of frame remains visually active while the character is emotionally alone',
          contextEvidenceIds:['scene:loneliness-theme'],
        },
        {
          featureRef:'focus-shift:0',
          possibleMeaning:'redirected attention to new information',
          rationale:'focus changes only when the second character appears in the doorway',
          contextEvidenceIds:['performance:entrance-beat'],
        },
      ],
      confidence:.82,
      evidenceIds:['analysis:review'],
      authority:'DIRECTOR_CAMERA_INTERPRETATION' as const,
    };
    expect(validateCinematographyInterpretation(observation,interpretation)).toEqual([]);
    const compiled=compileCinematographyInterpretation(observation,interpretation);
    expect(compiled).toContain('Contextual readings:');
    expect(compiled).toContain('Interpretations are contextual hypotheses');
  });

  it('rejects a symbolic reading that is not tied to an observed camera feature',()=>{
    const reasons=validateCinematographyInterpretation(observation,{
      id:'camera-interpretation:bad',
      observationId:observation.id,
      sceneToneOrTheme:'uncertainty',
      readings:[
        {
          featureRef:'trope:dutch-means-villain',
          possibleMeaning:'the subject is evil',
          rationale:'generic trope lookup',
          contextEvidenceIds:['none:context'],
        },
      ],
      confidence:.4,
      evidenceIds:['analysis:bad'],
      authority:'DIRECTOR_CAMERA_INTERPRETATION',
    });
    expect(reasons).toContain('DIRECTOR_CAMERA_INTERPRETATION_FEATURE_UNKNOWN:trope:dutch-means-villain');
  });
});

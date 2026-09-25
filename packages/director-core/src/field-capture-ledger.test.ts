import {describe,expect,it} from 'vitest';
import {validateFieldCaptureLedger} from './field-capture-ledger';

describe('field capture ledger',()=>{
  it('preserves searchable shoot-day moments and interview release evidence',()=>{
    const decision=validateFieldCaptureLedger({
      id:'ledger:p',
      projectId:'p',
      contingencyDayReserved:true,
      entries:[
        {
          id:'entry:interview-1',
          projectId:'p',
          shootDay:'day-1',
          kind:'interview',
          assetIds:['cam-a:clip-42','cam-b:clip-19'],
          subjectIds:['person:local-clinician'],
          sceneOrTopic:'medical access',
          notableMoment:'Explains what reliable power changes for emergency care.',
          cameraAngleIds:['front','side'],
          audioAssetIds:['lav:clip-7'],
          consentOrReleaseRefs:['release:person:local-clinician'],
          locationResearchRefs:['research:local-law'],
          tags:['interview','medical','story-driving'],
          evidenceIds:['edit-log:notebook:day-1'],
        },
      ],
      evidenceIds:['shoot-plan:v1'],
      authority:'DIRECTOR_FIELD_CAPTURE_LEDGER',
    });
    expect(decision.valid).toBe(true);
  });

  it('fails an interview log without consent/release provenance',()=>{
    const decision=validateFieldCaptureLedger({
      id:'ledger:p',
      projectId:'p',
      contingencyDayReserved:false,
      entries:[
        {
          id:'entry:i',
          projectId:'p',
          shootDay:'day-1',
          kind:'interview',
          assetIds:['clip:1'],
          subjectIds:['person:1'],
          sceneOrTopic:'topic',
          notableMoment:'answer',
          tags:['interview'],
          evidenceIds:['log:1'],
        },
      ],
      evidenceIds:['plan:1'],
      authority:'DIRECTOR_FIELD_CAPTURE_LEDGER',
    });
    expect(decision.reasons).toContain('DIRECTOR_FIELD_INTERVIEW_RELEASE_REQUIRED:entry:i');
  });
});

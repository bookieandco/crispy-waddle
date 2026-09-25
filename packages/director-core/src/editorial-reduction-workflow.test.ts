import {describe,expect,it} from 'vitest';
import {validateEditorialReductionGraph} from './editorial-reduction-workflow';

describe('editorial reduction workflow',()=>{
  it('preserves the raw -> synced/selects -> scene -> master -> final lineage',()=>{
    const decision=validateEditorialReductionGraph({
      id:'edit-graph:p',
      projectId:'p',
      nodes:[
        {id:'raw:i1',projectId:'p',stage:'raw',parentIds:[],assetIds:['cam-a:i1','cam-b:i1','lav:i1'],description:'untouched interview sources',evidenceIds:['ingest:i1']},
        {id:'sync:i1',projectId:'p',stage:'synced-interview',parentIds:['raw:i1'],assetIds:['sequence:sync:i1'],description:'two cameras and external audio synchronized',evidenceIds:['sync:clap']},
        {id:'select:i1',projectId:'p',stage:'selected',parentIds:['sync:i1'],assetIds:['sequence:select:i1'],description:'best interview passages while preserving source lineage',evidenceIds:['editor:select-review']},
        {id:'scene:hospital',projectId:'p',stage:'scene',parentIds:['select:i1'],assetIds:['sequence:scene:hospital'],description:'congruent hospital scene assembled from selected material',evidenceIds:['scene-review:1']},
        {id:'master:v1',projectId:'p',stage:'master',parentIds:['scene:hospital'],assetIds:['timeline:master:v1'],description:'master story assembly',evidenceIds:['master-review:v1']},
        {id:'final:v1',projectId:'p',stage:'final',parentIds:['master:v1'],assetIds:['render:final:v1'],description:'approved final render lineage',evidenceIds:['final-qc:v1']},
      ],
      evidenceIds:['edit-session:v1'],
      authority:'DIRECTOR_EDITORIAL_REDUCTION',
    });
    expect(decision.valid).toBe(true);
  });

  it('rejects destructive stage skipping that loses the planned reduction lineage',()=>{
    const decision=validateEditorialReductionGraph({
      id:'edit-graph:p',
      projectId:'p',
      nodes:[
        {id:'raw:1',projectId:'p',stage:'raw',parentIds:[],assetIds:['clip:1'],description:'raw',evidenceIds:['ingest']},
        {id:'master:1',projectId:'p',stage:'master',parentIds:['raw:1'],assetIds:['timeline:1'],description:'skipped reduction stages',evidenceIds:['edit']},
      ],
      evidenceIds:['session'],
      authority:'DIRECTOR_EDITORIAL_REDUCTION',
    });
    expect(decision.reasons).toContain('DIRECTOR_EDITORIAL_STAGE_TRANSITION_INVALID:raw->master');
  });
});

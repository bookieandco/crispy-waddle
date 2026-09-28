import { describe, expect, it } from 'vitest';
import {
  DIRECTOR_PRODUCTION_FINAL_PROGRAM,
  deriveDirectorProductionFinalProgramStatus,
  validateDirectorProductionFinalProgramRun,
  type DirectorProductionFinalFixtureRun,
} from './production-final-program.js';

function runs(status:DirectorProductionFinalFixtureRun['status']):DirectorProductionFinalFixtureRun[]{
  return DIRECTOR_PRODUCTION_FINAL_PROGRAM.map((fixture,index)=>({
    kind:fixture.kind,
    projectId:`project:${index}`,
    videoJobId:`video:${index}`,
    status,
  }));
}

describe('DIRECTOR-PRODUCTION.FINAL program',()=>{
  it('freezes the four canonical real-production fixtures',()=>{
    expect(DIRECTOR_PRODUCTION_FINAL_PROGRAM.map((fixture)=>[fixture.kind,fixture.targetDurationSeconds])).toEqual([
      ['commercial-30s',30],
      ['branded-short-8-13m',600],
      ['episode-22-30m',1500],
      ['feature-55-70m',3600],
    ]);
    expect(DIRECTOR_PRODUCTION_FINAL_PROGRAM[0]!.requiresProductReference).toBe(true);
    expect(DIRECTOR_PRODUCTION_FINAL_PROGRAM[1]!.requiresProductReference).toBe(true);
    expect(DIRECTOR_PRODUCTION_FINAL_PROGRAM[3]!.requiredProductionSignals).toContain('external NLE round trip');
  });

  it('does not call rendering complete while quality evidence is outstanding',()=>{
    expect(deriveDirectorProductionFinalProgramStatus(runs('awaiting-quality-evidence'))).toBe('awaiting-quality-evidence');
    expect(deriveDirectorProductionFinalProgramStatus(runs('passed'))).toBe('passed');
  });

  it('fails closed on blocked or failed fixture',()=>{
    const blocked=runs('passed');
    blocked[2]={...blocked[2]!,status:'blocked',error:'DIRECTOR_PRODUCTION_QUALITY_PROVIDER_NOT_CONFIGURED'};
    expect(deriveDirectorProductionFinalProgramStatus(blocked)).toBe('blocked');

    const failed=runs('passed');
    failed[1]={...failed[1]!,status:'failed',error:'provider failure'};
    expect(deriveDirectorProductionFinalProgramStatus(failed)).toBe('failed');
  });

  it('requires all four distinct fixture rows in the durable program receipt',()=>{
    const now='2026-09-27T00:00:00Z';
    const fixtureRuns=runs('passed');
    const valid={
      id:'program:1',ownerUserId:'user:1',sourceProjectId:'source:1',characterId:'hero',
      productId:'product:1',status:'passed' as const,fixtures:fixtureRuns,
      evidenceIds:['quality-matrix:1'],createdAt:now,updatedAt:now,
      authority:'DIRECTOR_PRODUCTION_FINAL_PROGRAM' as const,
    };
    expect(validateDirectorProductionFinalProgramRun(valid)).toEqual([]);
    expect(validateDirectorProductionFinalProgramRun({...valid,fixtures:fixtureRuns.slice(0,3)})).toContain(
      'DIRECTOR_PRODUCTION_FINAL_PROGRAM_FIXTURE_MISSING:feature-55-70m'
    );
  });
});

import {describe,expect,it} from 'vitest';
import {isMusicAutopilotReceiptComplete} from './music-autopilot-worker';

const receipt = (statuses: Array<'complete'|'blocked'|'waiting'|'skipped'|'failed'>,
  overrides: Record<string,unknown>={}) => ({
    charterEnabled:true,approvalRequired:false,blockers:[],
    stages:statuses.map(status=>({stage:'MUSIC-AUTO.4' as const,status,details:{}})),
    ...overrides,
  });

describe('MUSIC-JUGGERNAUT.RECOVER.08 scheduler completion truth',()=>{
  it('does not complete an empty run',()=>{
    expect(isMusicAutopilotReceiptComplete(receipt([]))).toBe(false);
  });
  it('does not complete an approved-only, waiting or blocked run',()=>{
    expect(isMusicAutopilotReceiptComplete(receipt(['complete','waiting']))).toBe(false);
    expect(isMusicAutopilotReceiptComplete(receipt(['complete','blocked']))).toBe(false);
    expect(isMusicAutopilotReceiptComplete(receipt(['complete','failed']))).toBe(false);
    expect(isMusicAutopilotReceiptComplete(receipt(['complete'],{approvalRequired:true}))).toBe(false);
    expect(isMusicAutopilotReceiptComplete(receipt(['complete'],{blockers:['provider']}))).toBe(false);
    expect(isMusicAutopilotReceiptComplete(receipt(['complete'],{charterEnabled:false}))).toBe(false);
  });
  it('reports success only for completed or genuinely skipped stages',()=>{
    expect(isMusicAutopilotReceiptComplete(receipt(['complete','skipped','complete']))).toBe(true);
  });
});

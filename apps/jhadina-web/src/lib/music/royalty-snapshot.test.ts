import {describe,expect,it} from 'vitest';
import {royaltyLineKey,royaltyTitleGroupKey,summarizeRoyaltyAggregateSnapshot} from './royalty-snapshot';

describe('royalty aggregate snapshot',()=>{
  it('accepts cent-level service rounding while preserving the reported total',()=>{
    const result=summarizeRoyaltyAggregateSnapshot({
      statementRef:'statement:test',
      source:'owner-supplied-dashboard',
      currency:'USD',
      reportedTotal:79.53,
      observedAt:'2026-09-30T20:30:00-07:00',
      lines:[
        {kind:'service',label:'Spotify',amount:29.76},
        {kind:'service',label:'YouTube',amount:49.78},
      ],
    });
    expect(result.reportedTotal).toBe(79.53);
    expect(result.serviceSubtotal).toBe(79.54);
    expect(result.serviceRoundingDelta).toBe(0.01);
    expect(result.serviceTotalReconciles).toBe(true);
  });

  it('groups spelling/case variants for analytics without collapsing source rows',()=>{
    const result=summarizeRoyaltyAggregateSnapshot({
      statementRef:'statement:songs',
      source:'owner-supplied-dashboard',
      currency:'USD',
      reportedTotal:20,
      observedAt:'2026-09-30T20:30:00-07:00',
      lines:[
        {kind:'song',label:'Ass Naked',amount:9},
        {kind:'song',label:'Assnaked',amount:1},
        {kind:'song',label:'OTR',amount:2},
        {kind:'song',label:'otr',amount:3},
      ],
    });
    expect(result.titleGroups.find((item)=>item.titleGroupKey==='ass-naked')?.total).toBe(9);
    expect(result.titleGroups.find((item)=>item.titleGroupKey==='assnaked')?.total).toBe(1);
    expect(result.titleGroups.find((item)=>item.titleGroupKey==='otr')?.rows).toBe(2);
    expect(result.warnings.some((warning)=>warning.includes('recording identity'))).toBe(true);
  });

  it('normalizes remaster labels but keeps feature text in the title group',()=>{
    expect(royaltyTitleGroupKey('Apryl Katrina (Remastered) [Palm Trees]')).toBe('apryl-katrina-palm-trees');
    expect(royaltyTitleGroupKey('Like A (feat. Eyez)')).toBe('like-a-feat-eyez');
  });

  it('creates stable per-row keys so duplicate statement rows remain distinct',()=>{
    const line={kind:'song' as const,label:'Like A (feat. Eyez)',amount:4.44};
    expect(royaltyLineKey(line,0)).not.toBe(royaltyLineKey(line,1));
  });
});

import {describe,expect,it,vi} from 'vitest';
import {persistRoyaltyAggregateSnapshot} from './music-royalty-snapshot-service';

describe('private royalty snapshot persistence',()=>{
  it('persists evidence without creating external financial actions',async()=>{
    const musicRepository={
      getProject:vi.fn().mockResolvedValue({id:'project-1',artist_key:'atwood-bookie'}),
      listSongs:vi.fn(),listExperiments:vi.fn(),listObservations:vi.fn(),listCityDemand:vi.fn(),listRights:vi.fn(),listLearning:vi.fn(),
      upsertProject:vi.fn(),upsertSong:vi.fn(),upsertExperiment:vi.fn(),recordObservation:vi.fn(),upsertCityDemand:vi.fn(),upsertRights:vi.fn(),upsertLearning:vi.fn(),
    };
    const commissionRepository={
      listPlatformAccounts:vi.fn(),listCatalogReleases:vi.fn(),listReceipts:vi.fn(),listRoyaltySnapshots:vi.fn(),listRoyaltyLines:vi.fn(),
      upsertArtistProfile:vi.fn(),upsertPlatformAccount:vi.fn(),upsertCatalogRelease:vi.fn(),upsertReceipt:vi.fn(),
      upsertRoyaltySnapshot:vi.fn().mockResolvedValue({id:'snapshot-1'}),
      upsertRoyaltyLine:vi.fn().mockResolvedValue({id:'line-1'}),
    };
    const result=await persistRoyaltyAggregateSnapshot({
      userId:'user-1',
      snapshot:{
        statementRef:'statement-1',source:'owner-supplied-dashboard',currency:'USD',reportedTotal:10,
        observedAt:'2026-09-30T20:30:00-07:00',
        lines:[
          {kind:'service',label:'Spotify',amount:10},
          {kind:'song',label:'Song A',amount:10,artistName:'Atwood Bookie'},
        ],
      },
    },{musicRepository,commissionRepository});
    expect(result.snapshotId).toBe('snapshot-1');
    expect(result.externalFinancialActionsStarted).toBe(false);
    expect(commissionRepository.upsertRoyaltyLine).toHaveBeenCalledTimes(2);
  });
});

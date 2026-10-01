import {
  ATWOOD_BOOKIE_ARTIST_KEY,
  ATWOOD_BOOKIE_ARTIST_NAME,
} from '@jhadina/growth-core';
import {
  royaltyLineKey,
  royaltyTitleGroupKey,
  summarizeRoyaltyAggregateSnapshot,
  type RoyaltyAggregateSnapshotInput,
} from './royalty-snapshot';
import {createMusicCommissioningRepository,type MusicCommissioningRepository} from './music-commissioning-repository';
import {createMusicJuggernautRepository,type MusicJuggernautRepository} from './music-juggernaut-repository';
import {ensureMusicJuggernautProject} from './music-juggernaut-service';

export interface PersistedRoyaltySnapshotReceipt {
  projectId:string;
  snapshotId:string;
  statementRef:string;
  reportedTotal:number;
  currency:string;
  lineCount:number;
  summary:ReturnType<typeof summarizeRoyaltyAggregateSnapshot>;
  externalFinancialActionsStarted:false;
}

export async function persistRoyaltyAggregateSnapshot(
  input:{userId:string;snapshot:RoyaltyAggregateSnapshotInput},
  overrides:{
    musicRepository?:MusicJuggernautRepository;
    commissionRepository?:MusicCommissioningRepository;
  }={},
):Promise<PersistedRoyaltySnapshotReceipt> {
  const musicRepository=overrides.musicRepository??createMusicJuggernautRepository();
  const commissionRepository=overrides.commissionRepository??createMusicCommissioningRepository();
  const project=await ensureMusicJuggernautProject({
    userId:input.userId,
    artistKey:ATWOOD_BOOKIE_ARTIST_KEY,
    artistName:ATWOOD_BOOKIE_ARTIST_NAME,
    repository:musicRepository,
  });
  const projectId=String(project.id);
  const summary=summarizeRoyaltyAggregateSnapshot(input.snapshot);
  const snapshot=await commissionRepository.upsertRoyaltySnapshot({
    projectId,
    statementRef:input.snapshot.statementRef,
    source:input.snapshot.source,
    currency:input.snapshot.currency,
    reportedTotalMinor:toMinor(input.snapshot.reportedTotal),
    periodStart:input.snapshot.periodStart,
    periodEnd:input.snapshot.periodEnd,
    observedAt:input.snapshot.observedAt,
    metadata:{
      serviceSubtotalMinor:toMinor(summary.serviceSubtotal),
      songSubtotalMinor:toMinor(summary.songSubtotal),
      serviceRoundingDeltaMinor:toMinorSigned(summary.serviceRoundingDelta),
      serviceTotalReconciles:summary.serviceTotalReconciles,
      warnings:[...summary.warnings],
      authority:'ROYALTY_EVIDENCE_ONLY',
    },
  });

  for(const [index,line] of input.snapshot.lines.entries()){
    await commissionRepository.upsertRoyaltyLine({
      projectId,
      snapshotId:String(snapshot.id),
      lineKey:royaltyLineKey(line,index),
      lineKind:line.kind,
      label:line.label,
      titleGroupKey:line.kind==='song'?royaltyTitleGroupKey(line.label):undefined,
      amountMinor:toMinor(line.amount),
      artistName:line.artistName,
      recordingRef:line.recordingRef,
      evidenceRefs:line.evidenceRef?[line.evidenceRef]:[
        'owner-supplied-royalty:'+input.snapshot.statementRef+':'+String(index+1),
      ],
    });
  }

  return Object.freeze({
    projectId,
    snapshotId:String(snapshot.id),
    statementRef:input.snapshot.statementRef,
    reportedTotal:summary.reportedTotal,
    currency:summary.currency,
    lineCount:input.snapshot.lines.length,
    summary,
    externalFinancialActionsStarted:false,
  });
}

function toMinor(amount:number):number {
  if(!Number.isFinite(amount)||amount<0)throw new Error('ROYALTY_AMOUNT_INVALID');
  return Math.round(amount*100);
}
function toMinorSigned(amount:number):number {
  if(!Number.isFinite(amount))throw new Error('ROYALTY_AMOUNT_INVALID');
  return Math.round(amount*100);
}

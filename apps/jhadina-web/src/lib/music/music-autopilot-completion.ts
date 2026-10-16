/** Pure, deterministic completion gates; no action or commercial authority. */
export interface MusicPerceptionCoverage {
  runtimeReady:boolean;
  bindingCount:number;
  validBindings:number;
  waitingBindings:number;
  failedBindings:number;
  missingSongBindings:number;
}
export function perceptionStageComplete(c:MusicPerceptionCoverage):boolean {
  return c.runtimeReady && c.bindingCount>0 && c.validBindings===c.bindingCount &&
    c.waitingBindings===0 && c.failedBindings===0 && c.missingSongBindings===0;
}

export interface MusicRightsRow {
  asset_key?:unknown; assetKey?:unknown;
  master_ownership_known?:unknown;
  publishing_known?:unknown;
  sample_status?:unknown;
  third_party_usage_status?:unknown;
}
/**
 * A royalty snapshot is revenue evidence, NOT commercial rights clearance.
 * All selected song IDs must have an explicitly matching, non-blocked record.
 */
export function assessMusicRightsCoverage(songIds:readonly string[], rights:readonly MusicRightsRow[]) {
  const selected=[...new Set(songIds.filter(id=>id.trim().length>0))];
  const recordFor=new Map<string,MusicRightsRow>();
  for(const row of rights) {
    const songId=String(row.asset_key??row.assetKey??'').trim();
    if(songId && !recordFor.has(songId))recordFor.set(songId,row);
  }
  const missing=selected.filter(songId=>!recordFor.has(songId));
  const blocked=selected.filter(songId=>{
    const row=recordFor.get(songId);
    return Boolean(row && (row.master_ownership_known!==true ||
      row.publishing_known!==true ||
      row.sample_status==='blocked' || row.sample_status==='review_required' ||
      row.third_party_usage_status==='blocked' || row.third_party_usage_status==='review_required'));
  });
  return Object.freeze({complete:selected.length>0 && missing.length===0 && blocked.length===0,
    selectedSongIds:selected,missingSongIds:missing,blockedSongIds:blocked});
}

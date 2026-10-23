// Jhadina Sports Lab Week 001 — source rights and side-effects policy.
// This is a code-reviewed denylist/registry, not a self-service license toggle.
// Strings/claims of permission do NOT grant rights; independent legal review is required.
export const SOURCE_ID='ESPN_UNDOCUMENTED_SITE_FEED';
export const SOURCE_REGISTRY=Object.freeze({
  [SOURCE_ID]:Object.freeze({
    identity:'ESPN site scoreboard endpoints (historic Week001)',
    rights_status:'NOT_ESTABLISHED',
    documented_permission_uri:null,
    reviewed_by:null,
    permission_expires_at:null,
    allowed_offline_operations:Object.freeze(['HASH_VALIDATE_ARCHIVED_RECEIPTS'])
  })
});
export const NETWORK_OPERATIONS=Object.freeze([
 'COLLECT_SCHEDULES','COLLECT_RESULTS','COLLECT_PLAYER_STATS',
 'COLLECT_MARKET_QUOTES','RECHECK_RESULTS','PROBE_PROVIDER','REDISTRIBUTE_DATA'
]);
export const DISABLED_SIDE_EFFECTS=Object.freeze([
 'REAL_BET','REAL_TRADE','MAKE_PAYMENT','BUY_UPGRADE',
 'AUTOMATED_MODEL_WEIGHT_CHANGE','AUTHORIZE_SETTLEMENT'
]);
const all=new Set(['HASH_VALIDATE_ARCHIVED_RECEIPTS',...NETWORK_OPERATIONS,...DISABLED_SIDE_EFFECTS]);
export function sourceDecision(sourceId,operation){
  if(typeof sourceId!=='string'||!sourceId||!all.has(operation))
    return {allowed:false,reason:'UNKNOWN_SOURCE_OR_OPERATION',rights_verified:false};
  const entry=SOURCE_REGISTRY[sourceId];
  if(DISABLED_SIDE_EFFECTS.includes(operation))
    return {allowed:false,reason:'SIDE_EFFECT_HARD_DISABLED',rights_verified:false};
  if(!entry)return {allowed:false,reason:'UNREGISTERED_SOURCE',rights_verified:false};
  if(operation==='HASH_VALIDATE_ARCHIVED_RECEIPTS')
    return {allowed:true,reason:'LOCAL_INTEGRITY_ONLY_NOT_DATA_LICENSE',rights_verified:false};
  return {allowed:false,reason:'SOURCE_RIGHTS_NOT_ESTABLISHED',rights_verified:false};
}
export function requireSourceOperation(sourceId,operation){
  const decision=sourceDecision(sourceId,operation);
  if(!decision.allowed)throw Error('SOURCE_RIGHTS_HOLD:'+decision.reason+':'+String(operation));
  return decision;
}
export function sourcePolicyReport(){
  return {schema_version:'jhadina.sports.source_policy.v1',source_id:SOURCE_ID,
    rights_status:SOURCE_REGISTRY[SOURCE_ID].rights_status,
    network_collection_allowed:false,source_redistribution_allowed:false,
    bookmaker_settlement_allowed:false,
    real_bets_allowed:false,model_weight_updates_allowed:false,
    rights_verified:false,
    note:'Hash validation of archived receipts is not a license to collect, display, redistribute or monetize provider data.'};
}

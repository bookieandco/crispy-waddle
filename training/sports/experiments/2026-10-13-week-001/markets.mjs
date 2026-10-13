import {hash,verifyResearchForecast} from './core.mjs';
export const MARKET_CATEGORIES=Object.freeze(['winner','spread','game_total','player_props','period_props','touchdowns_or_scorers']);
export function marketCoverage(forecast){
 verifyResearchForecast(forecast);
 return MARKET_CATEGORIES.map(market=>({market,
   status:market==='winner'?'UNCALIBRATED_RESEARCH_PROBABILITY':(['spread','game_total'].includes(market)?'PROJECTED_SCORE_ONLY_NO_VERIFIED_LINE':'NOT_MODELED_NO_VERIFIED_STATS'),
   can_compare_market:false,can_settle:false,can_bet:false,
   reason:'No verified permitted market quote and no official settlement evidence'}));
}
export function validateQuote(q,event,rights,observedAt){
 if(!MARKET_CATEGORIES.includes(q?.market)||q.event_id!==event?.event_id)throw Error('QUOTE_EVENT_OR_MARKET_INVALID');
 if(rights?.provider!==q.provider||rights?.analysis_permitted!==true||!/^https:\/\//.test(rights?.evidence_url||''))throw Error('DATA_RIGHTS_UNCONFIRMED');
 if(typeof q.source_url!=='string'||!q.source_url.startsWith('https://')||!q.provider||!Number.isFinite(q.decimal_odds)||q.decimal_odds<=1)throw Error('QUOTE_PROVENANCE_INVALID');
 const ts=Date.parse(q.observed_at_utc),start=Date.parse(event.start_utc),now=Date.parse(observedAt);
 if(!Number.isFinite(ts)||!Number.isFinite(start)||!Number.isFinite(now)||ts>now||ts>=start)throw Error('QUOTE_NOT_PRE_EVENT');
 if(q.market==='spread'||q.market==='game_total'||q.market==='player_props'||q.market==='period_props'){
  if(!Number.isFinite(q.line))throw Error('MARKET_LINE_REQUIRED');
 }
 if(q.market==='player_props'&&!q.player_id)throw Error('PLAYER_ID_REQUIRED');
 if(q.market==='period_props'&&!Number.isInteger(q.period))throw Error('PERIOD_REQUIRED');
 if(q.market==='touchdowns_or_scorers'&&!q.scorer_id)throw Error('SCORER_REQUIRED');
 return {schema_version:'jhadina.sports.verified_quote_candidate.v1',...q,rights_evidence_url:rights.evidence_url,
    research_only:true,automatic_betting:false,admission_status:'MARKET_REFERENCE_ONLY',sha256:hash({q,rights_evidence_url:rights.evidence_url})};
}

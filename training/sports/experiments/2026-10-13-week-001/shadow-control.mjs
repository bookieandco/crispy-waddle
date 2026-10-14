import {verifyResearchForecast} from './core.mjs';

// Preregistered BEFORE the first eligible seal. The baseline-v1 forecast
// remains immutable. This fixed control does not learn from graded outcomes.
export const CONTROL_ID='fixed-half-shrink-control-v1';
export const ELIGIBLE_SEAL_START_UTC='2026-10-15T00:00:00Z';
export const CONTROL_WEIGHT=0.5;

export function computeShadowControl(forecast){
  verifyResearchForecast(forecast);
  const prior=forecast.sport==='Soccer'?[1/3,1/3,1/3]:[0.5,0,0.5];
  const p=[forecast.home_win_probability,forecast.draw_probability,forecast.away_win_probability];
  const control=p.map((v,i)=>CONTROL_WEIGHT*v+(1-CONTROL_WEIGHT)*prior[i]);
  return {control_id:CONTROL_ID,preregistered_seal_start_utc:ELIGIBLE_SEAL_START_UTC,
    home_probability:control[0],draw_probability:control[1],away_probability:control[2],
    paper_only:true,trained_on_results:false,real_stake:0};
}

export function scoreProspectiveControl(forecast,outcome){
  const control=computeShadowControl(forecast);
  if(Date.parse(forecast.sealed_at_utc)<Date.parse(ELIGIBLE_SEAL_START_UTC))return null;
  if(!['HOME','DRAW','AWAY'].includes(outcome))throw Error('CONTROL_OUTCOME_INVALID');
  const values=[control.home_probability,control.draw_probability,control.away_probability];
  const observed=['HOME','DRAW','AWAY'].map(side=>Number(side===outcome));
  const brier=values.reduce((sum,p,i)=>sum+(p-observed[i])**2,0);
  return {control_id:CONTROL_ID,brier:Math.round(brier*1e5)/1e5,preregistered:true};
}

export function summarizeProspectiveControl(rows){
  if(!Array.isArray(rows))throw Error('CONTROL_ROWS_INVALID');
  const eligible=rows.filter(r=>r&&Number.isFinite(r.control_brier)&&Number.isFinite(r.original_brier));
  const mean=key=>eligible.length?
    Math.round(eligible.reduce((sum,r)=>sum+r[key],0)/eligible.length*1e5)/1e5:null;
  const champion=mean('original_brier'),challenger=mean('control_brier');
  return {control_id:CONTROL_ID,preregistered_seal_start_utc:ELIGIBLE_SEAL_START_UTC,
    scored_eligible_events:eligible.length,champion_mean_brier:champion,
    challenger_mean_brier:challenger,
    challenger_minus_champion_brier:challenger===null?null:
      Math.round((challenger-champion)*1e5)/1e5,
    status:eligible.length<50?'EARLY_PROSPECTIVE_CONTROL_RESEARCH_ONLY':'FIFTY_PLUS_RESEARCH_ONLY_NOT_VALIDATED',
    training_updates:0,real_stake:0,claimed_edge:false,
    note:'Fixed 50% shrink toward equal outcomes, registered before eligible games. No fit, no live model replacement and no proof of improvement.'};
}

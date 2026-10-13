import {createHash} from 'node:crypto';
const sports=new Set(['NFL','NCAAF','NBA','NHL','MLB','Soccer','Tennis','UFC']);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function normalizeFixture(f,now=new Date().toISOString()){
 if(!sports.has(f?.sport)||!f.event_id||!f.home||!f.away||!Number.isFinite(Date.parse(f.start_utc)))throw Error('INVALID_FIXTURE');
 if(!f.source_url?.startsWith('https://')||!Number.isFinite(Date.parse(f.source_observed_at))||Date.parse(f.source_observed_at)>Date.parse(now))throw Error('UNVERIFIED_SOURCE');
 return Object.freeze({schema_version:'jhadina.sports.fixture.v1',...f});
}
export function sealPrediction(f,p,now=new Date().toISOString()){
 if(Date.parse(now)>=Date.parse(f.start_utc))throw Error('LATE_FORECAST');
 if(p?.model_id!=='baseline-v1'||!(p.home_win_probability>0&&p.home_win_probability<1)||!Number.isFinite(p.home_projected_points)||!Number.isFinite(p.away_projected_points)||p.home_projected_points<0||p.away_projected_points<0)throw Error('INVALID_FORECAST');
 if(!p.input_source_urls?.length||p.input_source_urls.some(x=>!x.startsWith('https://')))throw Error('MISSING_PROVENANCE');
 if(p.market_reference&&(!p.market_reference.provider||!Number.isFinite(p.market_reference.line)||!Number.isFinite(Date.parse(p.market_reference.observed_at))||Date.parse(p.market_reference.observed_at)>=Date.parse(f.start_utc)))throw Error('INVALID_MARKET_REFERENCE');
 const record={schema_version:'jhadina.sports.forecast.v1',event_id:f.event_id,sport:f.sport,start_utc:f.start_utc,sealed_at_utc:now,...p,market_reference:p.market_reference??null,authority:'PAPER_ONLY',real_bet:false};
 return {...record,sha256:digest(record)};
}
export function gradePrediction(sealed,final){
 const {sha256,...payload}=sealed;if(digest(payload)!==sha256)throw Error('TAMPERED_FORECAST');
 if(final?.event_id!==sealed.event_id||final.status!=='FINAL'||!final.source_url?.startsWith('https://')||Date.parse(final.verified_at_utc)<=Date.parse(sealed.start_utc)||![final.home_points,final.away_points].every(x=>Number.isFinite(x)&&x>=0))throw Error('UNVERIFIED_FINAL');
 const outcome=final.home_points===final.away_points?null:Number(final.home_points>final.away_points);
 return {schema_version:'jhadina.sports.scorecard.v1',event_id:sealed.event_id,forecast_sha256:sha256,source_url:final.source_url,brier_score:outcome===null?null:Number(((sealed.home_win_probability-outcome)**2).toFixed(6)),training_status:'AWAITING_OWNER_APPROVAL',real_bet:false};
}

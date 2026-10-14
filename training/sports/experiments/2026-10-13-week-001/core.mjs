import { createHash } from 'node:crypto';

export const EXPERIMENT = 'JH-SPORTS-WEEK-2026-10-13-001';
export const WINDOW_START = '2026-10-13T07:00:00.000Z';
export const WINDOW_END = '2026-10-21T07:00:00.000Z';
export const LEAGUES = Object.freeze({
  'football/nfl':'NFL','football/college-football':'NCAAF',
  'basketball/nba':'NBA','hockey/nhl':'NHL','baseball/mlb':'MLB',
  'soccer/eng.1':'Soccer','soccer/esp.1':'Soccer','soccer/usa.1':'Soccer',
  'tennis/atp':'Tennis','tennis/wta':'Tennis','mma/ufc':'UFC'
});
export const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const isTime = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(v);
const https = v => typeof v === 'string' && /^https:\/\//.test(v);
const number = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (n,lower,upper) => Math.max(lower,Math.min(upper,n));
const round = v => Math.round(v*1e5)/1e5;
const pmean = (a,b) => (a+b)/2;
const safeId = value => {
  if(typeof value!=='string'||!/^espn:[a-z0-9./-]+:[a-zA-Z0-9_-]+$/.test(value)) throw Error('EVENT_ID_INVALID');
  return value.replaceAll(':','_').replaceAll('/','_').replaceAll('.','_');
};
export {safeId};

export function extractScoreboard(league,body,observedAt,sourceUrl){
  if(!LEAGUES[league]||!isTime(observedAt)||!https(sourceUrl)||!Array.isArray(body?.events)) throw Error('INVALID_PROVIDER_DATA');
  const sport=LEAGUES[league], fixtures=[],finals=[],errors=[];
  const expanded=[];
  for(const tournament of body.events){
    if(sport!=='Tennis'){expanded.push(tournament);continue;}
    const grouped=(tournament.groupings||[]).flatMap(g=>g.competitions||[]);
    const direct=(tournament.competitions||[]).filter(c=>Array.isArray(c.competitors));
    if(grouped.length||direct.length){
      for(const competition of [...grouped,...direct]){
        const singleDirect=grouped.length===0&&direct.length===1;
        const matchId=competition?.id||(singleDirect?tournament.id:null);
        const matchDate=competition?.date||(singleDirect?tournament.date:null);
        if(matchId&&isTime(matchDate))
          expanded.push({id:matchId,date:matchDate,status:competition.status||(singleDirect?tournament.status:null),competitions:[competition]});
      }
    }else if(Array.isArray(tournament.competitors)&&tournament.competitors.length===2){
      expanded.push({...tournament,competitions:[{competitors:tournament.competitors}]});
    }else{
      errors.push({league,event_id:String(tournament?.id||'unknown'),error:'TOURNAMENT_WITHOUT_TIMESTAMPED_MATCHES'});
    }
  }
  for(const e of expanded){
    try{
      const c=e.competitions?.[0]?.competitors;
      if(!Array.isArray(c)||c.length!==2||!e.id||!isTime(e.date))throw Error('MALFORMED_EVENT');
      const a=c.find(x=>x.homeAway==='home')||(sport==='Tennis'||sport==='UFC'?c[0]:null);
      const b=c.find(x=>x.homeAway==='away')||(sport==='Tennis'||sport==='UFC'?c[1]:null);
      if(!a||!b||a===b)throw Error('NO_SIDES');
      const identifier=x=>String(x.team?.id||x.athlete?.id||x.id||'');
      const display=x=>x.team?.displayName||x.athlete?.displayName||x.team?.name||x.athlete?.name;
      if(!identifier(a)||!identifier(b)||!display(a)||!display(b))throw Error('NO_PARTICIPANTS');
      const event={event_id:`espn:${league}:${e.id}`,sport,league,start_utc:e.date,
        home:{id:identifier(a),name:display(a)},away:{id:identifier(b),name:display(b)},
        source_url:sourceUrl,source_observed_at:observedAt,source_class:'THIRD_PARTY_UNCONFIRMED'};
      safeId(event.event_id);
      fixtures.push(event);
      const status=e.status?.type;
      const final=status?.completed===true && (status?.name==='STATUS_FINAL'||(sport==='Soccer'&&status?.name==='STATUS_FULL_TIME'));
      if(final){
        let hs,as;
        if(sport==='Tennis'||sport==='UFC'){
          if(a.winner===true&&b.winner===false){hs=1;as=0;}
          else if(b.winner===true&&a.winner===false){hs=0;as=1;}
          else throw Error('MATCH_WINNER_NOT_VERIFIED');
        }else{
          // Null/blank provider fields coerce to zero in JavaScript. Never let
          // missing scores masquerade as a completed 0–0 result.
          const validScore=x=>(typeof x==='number'&&Number.isFinite(x))||
            (typeof x==='string'&&x.trim()!==''&&/^(?:\d+)(?:\.\d+)?$/.test(x.trim()));
          if(!validScore(a.score)||!validScore(b.score))throw Error('INVALID_FINAL_SCORE');
          hs=Number(a.score);as=Number(b.score);
          if(!Number.isFinite(hs)||!Number.isFinite(as)||hs<0||as<0)throw Error('INVALID_FINAL_SCORE');
        }
        if(Date.parse(event.start_utc)>=Date.parse(observedAt))throw Error('FINAL_IN_FUTURE');
        finals.push({...event,home_points:hs,away_points:as,
          score_unit:(sport==='Tennis'||sport==='UFC')?'match_win_indicator':'points',
          verified_at_utc:observedAt,verification_status:'THIRD_PARTY_UNCONFIRMED'});
      }
    }catch(err){errors.push({league,event_id:String(e?.id??'unknown'),error:String(err.message)});}
  }
  return {fixtures,finals,errors};
}

export function calculateBaseline(fixture,history,asOf){
  if(!fixture?.event_id||!isTime(asOf)||Date.parse(asOf)>=Date.parse(fixture.start_utc))return {status:'ABSTAIN',reason:'NOT_PRE_EVENT'};
  if(fixture.source_class!=='THIRD_PARTY_UNCONFIRMED')return {status:'ABSTAIN',reason:'UNRECOGNIZED_FIXTURE_SOURCE'};
  if(Date.parse(fixture.source_observed_at)>Date.parse(asOf))return {status:'ABSTAIN',reason:'FUTURE_FIXTURE_OBSERVATION'};
  const filtered=history.filter(g=>g.league===fixture.league && g.verification_status==='THIRD_PARTY_UNCONFIRMED' &&
    isTime(g.verified_at_utc)&&Date.parse(g.verified_at_utc)<=Date.parse(asOf) &&
    Date.parse(g.start_utc)<Date.parse(asOf) && Number.isFinite(g.home_points)&&Number.isFinite(g.away_points) &&
    https(g.source_url) && g.event_id!==fixture.event_id);
  const unique=[...new Map(filtered.map(g=>[g.event_id,g])).values()].sort((a,b)=>Date.parse(b.start_utc)-Date.parse(a.start_utc));
  const homeGames=unique.filter(g=>g.home.id===fixture.home.id||g.away.id===fixture.home.id).slice(0,12);
  const awayGames=unique.filter(g=>g.home.id===fixture.away.id||g.away.id===fixture.away.id).slice(0,12);
  if(unique.length<6||homeGames.length<2||awayGames.length<2)return {status:'ABSTAIN',reason:'INSUFFICIENT_PRE_EVENT_HISTORY',league_sample:unique.length,home_sample:homeGames.length,away_sample:awayGames.length};
  const teamStats=(games,id)=>{
    const scored=[],allowed=[];let wins=0,draws=0;
    for(const g of games){const isHome=g.home.id===id;const points=isHome?g.home_points:g.away_points,opp=isHome?g.away_points:g.home_points;
      scored.push(points);allowed.push(opp);wins+=Number(points>opp);draws+=Number(points===opp)}
    return {scored:scored.reduce((a,b)=>a+b,0)/games.length,allowed:allowed.reduce((a,b)=>a+b,0)/games.length,
      win:(wins+1)/(games.length+2),draw:draws/games.length};
  };
  const h=teamStats(homeGames,fixture.home.id),a=teamStats(awayGames,fixture.away.id);
  const homeMean=unique.reduce((acc,g)=>acc+g.home_points,0)/unique.length;
  const awayMean=unique.reduce((acc,g)=>acc+g.away_points,0)/unique.length;
  const homeWins=unique.filter(g=>g.home_points>g.away_points).length;
  const awayWins=unique.filter(g=>g.home_points<g.away_points).length;
  const draws=unique.length-homeWins-awayWins;
  const rate=(homeWins+1)/(homeWins+awayWins+2);
  const logit=p=>Math.log(p/(1-p));
  const conditionalHome=1/(1+Math.exp(-(logit(h.win)-logit(a.win)+0.5*logit(rate))));
  const pDraw=fixture.sport==='Soccer'?clamp((draws+1)/(unique.length+3),0.01,0.4):0;
  const pHome=round(clamp(conditionalHome*(1-pDraw),0.02,0.97));
  const pAway=round(1-pDraw-pHome);
  const predictedHome=round(0.5*pmean(h.scored,a.allowed)+0.5*homeMean);
  const predictedAway=round(0.5*pmean(a.scored,h.allowed)+0.5*awayMean);
  const evidence=[...new Map([...homeGames,...awayGames].map(g=>[g.event_id,g])).values()];
  return {status:'READY_RESEARCH_ONLY',forecast:{model_id:'baseline-v1',home_win_probability:pHome,
    away_win_probability:pAway,draw_probability:round(pDraw),home_projected_points:predictedHome,
    away_projected_points:predictedAway,input_source_urls:[...new Set(evidence.map(x=>x.source_url))],
    sample_size:{league:unique.length,home:homeGames.length,away:awayGames.length},
    input_history:evidence,data_snapshot_sha256:hash(evidence),market_reference:null,
    score_unit:(fixture.sport==='Tennis'||fixture.sport==='UFC')?'match_win_indicator':'points',
    methodology:'Uncalibrated Laplace-smoothed recent wins and observed-score shrinkage. No market reference.',
    source_quality:'THIRD_PARTY_UNCONFIRMED',admission_status:'RESEARCH_NOT_OFFICIAL'}};
}

export function sealResearchForecast(fixture,forecast,sealedAt){
  if(!isTime(sealedAt)||Date.parse(sealedAt)>=Date.parse(fixture.start_utc)||Date.parse(sealedAt)<Date.parse(fixture.source_observed_at))throw Error('FORECAST_CUTOFF');
  if(forecast?.model_id!=='baseline-v1'||!number(forecast.home_win_probability)||!number(forecast.away_win_probability)||!number(forecast.draw_probability)||
    Math.abs(forecast.home_win_probability+forecast.away_win_probability+forecast.draw_probability-1)>0.0001||!number(forecast.home_projected_points)||!number(forecast.away_projected_points)||
    !forecast.input_source_urls?.length||forecast.input_source_urls.some(x=>!https(x))||forecast.market_reference!==null||forecast.admission_status!=='RESEARCH_NOT_OFFICIAL')throw Error('INVALID_RESEARCH_FORECAST');
  const entry={schema_version:'jhadina.sports.research_forecast.v2',experiment_id:EXPERIMENT,event_id:fixture.event_id,sport:fixture.sport,
    league:fixture.league,home:fixture.home,away:fixture.away,start_utc:fixture.start_utc,fixture_source_url:fixture.source_url,
    fixture_source_observed_at:fixture.source_observed_at,sealed_at_utc:sealedAt,...forecast,
    virtual_bankroll_usd:3100,stake_usd:0,bet_status:'NO_BET',training_status:'NOT_APPROVED',authority:'PAPER_ONLY',real_bet:false};
  return {...entry,sha256:hash(entry)};
}
export function verifyResearchForecast(record){
  if(!record||record.schema_version!=='jhadina.sports.research_forecast.v2')throw Error('RECEIPT_SCHEMA');
  const {sha256,...data}=record;
  if(!sha256||hash(data)!==sha256||record.real_bet!==false||record.authority!=='PAPER_ONLY'||record.stake_usd!==0||record.market_reference!==null||
    record.admission_status!=='RESEARCH_NOT_OFFICIAL'||!(Date.parse(record.sealed_at_utc)<Date.parse(record.start_utc)))throw Error('RECEIPT_INVALID');
  if(!Array.isArray(record.input_history)||!record.input_history.length||hash(record.input_history)!==record.data_snapshot_sha256)throw Error('INPUT_EVIDENCE_INVALID');
  for(const source of record.input_history){
    if(source.event_id===record.event_id||source.league!==record.league||source.verification_status!=='THIRD_PARTY_UNCONFIRMED'||
      !isTime(source.verified_at_utc)||Date.parse(source.verified_at_utc)>Date.parse(record.sealed_at_utc)||
      Date.parse(source.start_utc)>=Date.parse(record.sealed_at_utc))throw Error('FUTURE_OR_INVALID_EVIDENCE');
  }
  return true;
}
export function gradeUnofficial(forecast,final){
  verifyResearchForecast(forecast);
  if(!final||final.event_id!==forecast.event_id||final.league!==forecast.league||final.verification_status!=='THIRD_PARTY_UNCONFIRMED'||
    !https(final.source_url)||!isTime(final.verified_at_utc)||!isTime(final.start_utc)||
    final.home?.id!==forecast.home?.id||final.away?.id!==forecast.away?.id||
    (final.score_unit||'points')!==(forecast.score_unit||'points')||
    Date.parse(final.start_utc)<=Date.parse(forecast.sealed_at_utc)||
    Math.abs(Date.parse(final.start_utc)-Date.parse(forecast.start_utc))>12*3600000||
    Date.parse(final.verified_at_utc)<=Math.max(Date.parse(forecast.start_utc),Date.parse(final.start_utc))||
    ![final.home_points,final.away_points].every(x=>number(x)&&x>=0))throw Error('UNVERIFIED_RESULT');
  const outcome=final.home_points===final.away_points?'DRAW':final.home_points>final.away_points?'HOME':'AWAY';
  const ps=[forecast.home_win_probability,forecast.draw_probability,forecast.away_win_probability];
  const outcomes=['HOME','DRAW','AWAY'].map(x=>Number(outcome===x));
  const score=round(ps.reduce((acc,p,i)=>acc+(p-outcomes[i])**2,0));
  const entry={schema_version:'jhadina.sports.preliminary_grade.v2',event_id:forecast.event_id,
    forecast_sha256:forecast.sha256,verified_at_utc:final.verified_at_utc,result_source_url:final.source_url,
    outcome,home_points:final.home_points,away_points:final.away_points,multiclass_brier_score:score,
    // Tennis and UFC encode match winners as 1/0 indicators. These are
    // deliberately NOT projected scores, so their point errors are unknown.
    home_points_absolute_error:forecast.score_unit==='match_win_indicator'?null:
      round(Math.abs(forecast.home_projected_points-final.home_points)),
    away_points_absolute_error:forecast.score_unit==='match_win_indicator'?null:
      round(Math.abs(forecast.away_projected_points-final.away_points)),
    status:'PRELIMINARY_UNOFFICIAL_NOT_SETTLED',eligible_for_training:false,stake_usd:0,real_bet:false};
  return {...entry,sha256:hash(entry)};
}

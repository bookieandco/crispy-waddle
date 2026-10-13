#!/usr/bin/env node
/**
 * Jhadina NFL study-case scorer. Research only, no wagering authority.
 * Node >=18: node training/sports/nfl/grade-case.mjs PREGAME.json FINAL.json [OUT.json]
 * Final source is supplied by operator; this program does NOT fetch or verify it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const finite = (value, name) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(name + '_INVALID');
  return value;
};
const date = (value, name) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(name + '_INVALID');
  return parsed;
};
const round = (value, digits=6) => Number(value.toFixed(digits));
export function gradeSportsStudyCase(pregame, final) {
  if (pregame?.schema_version !== 'jhadina.sports.study_case.pregame.v1') throw new Error('PREGAME_SCHEMA_INVALID');
  if (final?.schema_version !== 'jhadina.sports.study_case.final_input.v1') throw new Error('FINAL_SCHEMA_INVALID');
  if (final.case_id !== pregame.case_id || final.event_id !== pregame.event_id) throw new Error('CASE_EVENT_MISMATCH');
  if (final.status !== 'FINAL' || final.source_class !== 'OFFICIAL_FINAL' || !/^https:\/\//.test(final.source_url || '')) throw new Error('OFFICIAL_FINAL_EVIDENCE_REQUIRED');
  const kickoff = date(pregame.matchup.scheduled_kickoff_utc, 'KICKOFF');
  const resolved = date(final.verified_final_at_utc, 'VERIFIED_FINAL_AT');
  if (resolved <= kickoff) throw new Error('FINAL_BEFORE_KICKOFF');
  if (final.verified_final_at_utc && final.observed_at_utc && date(final.observed_at_utc, 'OBSERVED') > resolved) throw new Error('FUTURE_OBSERVATION');
  const p = finite(pregame.original_prediction.home_win_probability, 'PROBABILITY');
  if (p <= 0 || p >= 1) throw new Error('PROBABILITY_OUT_OF_RANGE');
  const ph = finite(pregame.original_prediction.home_projected_points, 'HOME_PROJECTION');
  const pa = finite(pregame.original_prediction.away_projected_points, 'AWAY_PROJECTION');
  const ah = finite(final.final_home_points, 'FINAL_HOME');
  const aa = finite(final.final_away_points, 'FINAL_AWAY');
  if (![ph,pa,ah,aa].every(n => n >= 0 && Number.isInteger(n))) throw new Error('POINTS_INVALID');
  // Fail closed when a stored prediction contains contradictory fields.
  // Winner accuracy must never silently use a different pick from the one displayed.
  const declaredWinner = pregame.original_prediction.winner;
  if (declaredWinner !== pregame.matchup.home_code && declaredWinner !== pregame.matchup.away_code) throw new Error('DECLARED_WINNER_INVALID');
  if (p > 0.5 && declaredWinner !== pregame.matchup.home_code) throw new Error('WINNER_PROBABILITY_CONFLICT');
  if (p < 0.5 && declaredWinner !== pregame.matchup.away_code) throw new Error('WINNER_PROBABILITY_CONFLICT');
  if (pregame.original_prediction.predicted_total !== undefined && pregame.original_prediction.predicted_total !== ph + pa) throw new Error('PREDICTED_TOTAL_CONFLICT');
  if (pregame.original_prediction.predicted_home_margin !== undefined && pregame.original_prediction.predicted_home_margin !== ph - pa) throw new Error('PREDICTED_MARGIN_CONFLICT');
  const tie = ah === aa;
  const actualHomeWin = tie ? null : Number(ah > aa);
  const forecastHomeWin = declaredWinner === pregame.matchup.home_code;
  const spread = pregame.market_reference?.home_spread;
  const totalLine = pregame.market_reference?.game_total;
  const predictedMargin = ph - pa;
  const actualMargin = ah - aa;
  const total = ah + aa;
  const threshold = Number.isFinite(spread) ? -spread : null;
  const cover = threshold === null ? null : actualMargin === threshold ? 'PUSH' : actualMargin > threshold ? 'HOME' : 'AWAY';
  const totalResult = !Number.isFinite(totalLine) ? null : total === totalLine ? 'PUSH' : total > totalLine ? 'OVER' : 'UNDER';
  return {
    schema_version:'jhadina.sports.study_case.scorecard.v1',
    case_id:pregame.case_id, event_id:pregame.event_id, source_class:'REVIEWED_EVALUATION_CANDIDATE',
    source_url:final.source_url, verified_final_at_utc:final.verified_final_at_utc,
    original_prediction_unchanged:true, sample_size:1, calibrated:false,
    result:{home_points:ah,away_points:aa,winner:tie?'TIE':ah>aa?pregame.matchup.home_code:pregame.matchup.away_code},
    assessment:{
      predicted_winner:pregame.original_prediction.winner,
      winner_correct:tie ? null : forecastHomeWin === Boolean(actualHomeWin),
      brier_score:tie ? null : round((p - actualHomeWin)**2),
      log_loss:tie ? null : round(-(actualHomeWin ? Math.log(p): Math.log(1-p))),
      home_score_absolute_error:Math.abs(ph-ah), away_score_absolute_error:Math.abs(pa-aa),
      total_absolute_error:Math.abs(ph+pa-total),
      margin_absolute_error:Math.abs(predictedMargin-actualMargin),
      predicted_total:ph+pa, actual_total:total,
      predicted_margin:predictedMargin, actual_margin:actualMargin,
      against_spread_outcome:cover,
      predicted_spread_side:threshold===null?'NOT_AVAILABLE':predictedMargin===threshold?'PUSH':predictedMargin>threshold?'HOME':'AWAY',
      over_under_outcome:totalResult,
      predicted_total_side:!Number.isFinite(totalLine)?'NOT_AVAILABLE':ph+pa===totalLine?'PUSH':ph+pa>totalLine?'OVER':'UNDER'
    },
    thesis_reviews:pregame.thesis.map(t=>({hypothesis_id:t.id,status:'NOT_EVALUATED',evidence_urls:[],reason:'Needs verified box score or play-by-play; game result alone does not validate explanation.'})),
    training_status:'AWAITING_EVIDENCE_REVIEW',
    no_bet_authority:true, canAuthorizeLive:false, canExecute:false,
    warning:'One game is not statistical calibration. Scorecard evaluates the issued forecast, not a revised version.'
  };
}
const scriptPath = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (scriptPath) {
  const [pregamePath,finalPath,outPath] = process.argv.slice(2);
  if (!pregamePath || !finalPath) {
    console.error('Usage: node grade-case.mjs PREGAME.json FINAL.json [OUT.json]');
    process.exitCode=2;
  } else {
    try {
      const graded=gradeSportsStudyCase(JSON.parse(readFileSync(pregamePath,'utf8')),JSON.parse(readFileSync(finalPath,'utf8')));
      const result=JSON.stringify(graded,null,2)+'\n';
      if (outPath) writeFileSync(outPath,result,{flag:'wx'});
      else process.stdout.write(result);
    } catch(error) {
      console.error(error?.message || String(error));
      process.exitCode=1;
    }
  }
}

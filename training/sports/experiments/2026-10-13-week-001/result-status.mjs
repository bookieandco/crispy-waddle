// Separate sporting observation, independently verified sporting result,
// and bookmaker settlement. Week001 has ONLY provisional third-party grades.
export const RESULT_STATES=Object.freeze({
 MISSING:'MISSING_RESULT',
 PRELIMINARY:'PRELIMINARY_UNOFFICIAL_NOT_SETTLED',
 CONFLICT:'CONFLICTING_UNOFFICIAL_RESULTS',
 OFFICIAL_SPORT_RESULT:'OFFICIAL_SPORT_RESULT_VERIFIED',
 BOOKMAKER_SETTLEMENT:'BOOKMAKER_SETTLEMENT_VERIFIED'
});
export function classifyArchivedGradeSet(grades){
 if(!Array.isArray(grades))throw Error('GRADE_SET_INVALID');
 const scores=new Map();
 for(const g of grades){
   if(g?.status!==RESULT_STATES.PRELIMINARY||g.real_bet!==false||
       g.eligible_for_training!==false||g.stake_usd!==0||
       !Number.isFinite(g.home_points)||!Number.isFinite(g.away_points))
     throw Error('ARCHIVED_GRADE_NOT_UNOFFICIAL');
   const key=g.home_points+':'+g.away_points;
   scores.set(key,(scores.get(key)||0)+1);
 }
 const status=!scores.size?RESULT_STATES.MISSING:scores.size>1?RESULT_STATES.CONFLICT:RESULT_STATES.PRELIMINARY;
 return {status,observations:grades.length,distinct_scores:scores.size,
   official_sport_result_verified:false,bookmaker_settlement_verified:false,
   training_eligible:false,real_bet:false};
}
export function requestStatusPromotion(current,target){
 if(!Object.values(RESULT_STATES).includes(current)||!Object.values(RESULT_STATES).includes(target))
   throw Error('RESULT_STATUS_UNKNOWN');
 // Replaying a known state is safe, but an attempted promotion is not proof.
 if(current===target)return {status:current,changed:false};
 throw Error('EVIDENCE_GATE_REQUIRED:INDEPENDENT_RESULT_OR_BOOKMAKER_SETTLEMENT');
}

/**
 * JLLM-VISUAL.06. A simplified position-only exercise for IFAB Law 11.
 * Coordinates are 0 (own goal) to 100 (opponent goal).
 * This is NOT a foul/offence verdict: active-play involvement, body parts,
 * exceptions, rebounds and other player positions are outside the exercise.
 * Source: https://www.theifab.com/laws/latest/offside/
 */
export type OffsidePositionExercise={
 attacker:number
 ball:number
 secondLastDefender:number
}
export type OffsidePositionAssessment={
 offsidePosition:boolean
 reason:"OWN_HALF"|"LEVEL_OR_BEHIND_BALL"|"LEVEL_OR_BEHIND_DEFENDER"|"BEYOND_BOTH"
 boundary:number
}
export function assessOffsidePosition(input:OffsidePositionExercise):OffsidePositionAssessment{
  if(![input.attacker,input.ball,input.secondLastDefender].every(x=>Number.isFinite(x)&&x>=0&&x<=100)){
    throw new Error("OFFSIDE_EXERCISE_INVALID_COORDINATE")
  }
  const boundary=Math.max(input.ball,input.secondLastDefender,50)
  if(input.attacker<=50)return {offsidePosition:false,reason:"OWN_HALF",boundary}
  if(input.attacker<=input.ball)return {offsidePosition:false,reason:"LEVEL_OR_BEHIND_BALL",boundary}
  if(input.attacker<=input.secondLastDefender)return {offsidePosition:false,reason:"LEVEL_OR_BEHIND_DEFENDER",boundary}
  return {offsidePosition:true,reason:"BEYOND_BOTH",boundary}
}

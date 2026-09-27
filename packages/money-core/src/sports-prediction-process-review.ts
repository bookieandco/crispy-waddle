import { createHash } from 'node:crypto'
import type { SportsForwardShadowRecord } from './sports-prediction-forward-shadow.js'

export type SportsPredictionProcessClass=
  |'GOOD_PROCESS_GOOD_RESULT'
  |'GOOD_PROCESS_BAD_RESULT'
  |'WEAK_PROCESS_GOOD_RESULT'
  |'WEAK_PROCESS_BAD_RESULT'
  |'NON_DECISION_RESULT'

export type SportsPredictionProcessReview=Readonly<{
  reviewId:string
  recordId:string
  officialResult:'WON'|'LOST'|'PUSH'|'VOID'
  positiveClosingLineValue:boolean|null
  positiveEntryEdge:boolean
  processClass:SportsPredictionProcessClass
  nearMissCreditBps:0
  reasonCodes:readonly string[]
  authority:'LEARNING_ONLY'
  canRewriteOutcome:false
  canAuthorizeLive:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function reviewSportsPredictionProcess(input:{
  record:SportsForwardShadowRecord
  minimumPositiveEntryEdgeBps?:number
}):SportsPredictionProcessReview{
  const r=input.record
  if(r.authority!=='LEARNING_ONLY'||r.canAuthorizeLive!==false)throw new Error('SPORT_PRED_PROCESS_REVIEW_AUTHORITY_INVALID')
  const threshold=input.minimumPositiveEntryEdgeBps??0
  if(!Number.isInteger(threshold))throw new Error('SPORT_PRED_PROCESS_REVIEW_EDGE_THRESHOLD_INVALID')
  const positiveEntryEdge=r.prediction.edgeAtEntryBps>threshold
  const positiveClosingLineValue=r.closingLineValueBps===null?null:r.closingLineValueBps>0
  const processPositive=positiveEntryEdge&&(positiveClosingLineValue===null||positiveClosingLineValue)
  let processClass:SportsPredictionProcessClass='NON_DECISION_RESULT'
  if(r.status==='WON')processClass=processPositive?'GOOD_PROCESS_GOOD_RESULT':'WEAK_PROCESS_GOOD_RESULT'
  else if(r.status==='LOST')processClass=processPositive?'GOOD_PROCESS_BAD_RESULT':'WEAK_PROCESS_BAD_RESULT'
  const reasons:string[]=[]
  if(positiveEntryEdge)reasons.push('POSITIVE_ENTRY_EDGE')
  else reasons.push('ENTRY_EDGE_NOT_POSITIVE')
  if(positiveClosingLineValue===true)reasons.push('POSITIVE_CLOSING_LINE_VALUE')
  else if(positiveClosingLineValue===false)reasons.push('NON_POSITIVE_CLOSING_LINE_VALUE')
  else reasons.push('CLOSING_LINE_VALUE_UNAVAILABLE')
  if(r.status==='LOST')reasons.push('LOSS_REMAINS_LOSS_NO_NEAR_MISS_CREDIT')
  if(r.status==='PUSH'||r.status==='VOID')reasons.push('NON_DECISION_RESULT')
  return Object.freeze({
    reviewId:'sport-process-review:'+hash({record:r.recordId,threshold,reasons}),
    recordId:r.recordId,
    officialResult:r.status,
    positiveClosingLineValue,
    positiveEntryEdge,
    processClass,
    nearMissCreditBps:0,
    reasonCodes:unique(reasons),
    authority:'LEARNING_ONLY',
    canRewriteOutcome:false,
    canAuthorizeLive:false,
  })
}

import {describe,expect,it} from 'vitest'
import {assessExternalSignalIndependence} from '../external-signal-independence'

describe('external signal independence',()=>{
 it('collapses cross-posted Telegram/X/Reddit sources into one evidence group',()=>{
  const result=assessExternalSignalIndependence([
   {sourceId:'telegram:a',platform:'TELEGRAM',sourceFamilyId:'alpha-family',upstreamOriginId:'post:1',contentFingerprint:'hash:1',evidenceIds:['e1']},
   {sourceId:'x:a',platform:'X',sourceFamilyId:'alpha-family',upstreamOriginId:'post:1',contentFingerprint:'hash:1',evidenceIds:['e2']},
   {sourceId:'reddit:b',platform:'REDDIT',sourceFamilyId:'independent-family',upstreamOriginId:'post:2',contentFingerprint:'hash:2',evidenceIds:['e3']},
  ])
  expect(result.rawSourceCount).toBe(3)
  expect(result.independentGroupCount).toBe(2)
  expect(result.independenceRatio).toBeCloseTo(2/3)
  expect(result.duplicateRisk).toBe('MEDIUM')
  expect(result.canAuthorizeTrade).toBe(false)
 })

 it('keeps truly independent sources separate',()=>{
  const result=assessExternalSignalIndependence([
   {sourceId:'telegram:a',platform:'TELEGRAM',sourceFamilyId:'a',upstreamOriginId:'origin:a',contentFingerprint:'a1',evidenceIds:['e1']},
   {sourceId:'x:b',platform:'X',sourceFamilyId:'b',upstreamOriginId:'origin:b',contentFingerprint:'b1',evidenceIds:['e2']},
   {sourceId:'reddit:c',platform:'REDDIT',sourceFamilyId:'c',upstreamOriginId:'origin:c',contentFingerprint:'c1',evidenceIds:['e3']},
  ])
  expect(result.independentGroupCount).toBe(3)
  expect(result.duplicateRisk).toBe('LOW')
 })
})

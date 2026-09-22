import {describe,expect,it} from 'vitest'
import {evaluateWalletClusterThresholdSensitivity,normalizeWalletClusterAddress} from '../wallet-cluster-calibration'

const observations:any[]=[
 {observationId:'o1',tokenId:'t1',distinctWallets:3,windowSeconds:600,aggregateWalletScore:7,totalUsd:1000,observedAt:'2026-09-01T00:00:00Z',availableAt:'2026-09-01T00:00:01Z',outcome:'HEALTHY',evidenceIds:['e1']},
 {observationId:'o2',tokenId:'t2',distinctWallets:2,windowSeconds:240,aggregateWalletScore:5,totalUsd:200,observedAt:'2026-09-01T00:01:00Z',availableAt:'2026-09-01T00:01:01Z',outcome:'ADVERSE',evidenceIds:['e2']},
 {observationId:'future',tokenId:'t3',distinctWallets:8,windowSeconds:60,aggregateWalletScore:20,totalUsd:10000,observedAt:'2026-09-02T00:00:00Z',availableAt:'2026-09-02T00:00:01Z',outcome:'HEALTHY',evidenceIds:['future-e']},
]

describe('wallet cluster threshold sensitivity',()=>{
 it('reports threshold sensitivity without selecting a production threshold',()=>{
  const r=evaluateWalletClusterThresholdSensitivity({
   observations,
   informationCutoff:'2026-09-01T23:59:59Z',
   thresholds:[
    {thresholdId:'loose',minWallets:2,maxWindowSeconds:900,minAggregateWalletScore:4},
    {thresholdId:'strict',minWallets:3,maxWindowSeconds:600,minAggregateWalletScore:6},
   ],
  })
  expect(r.observationCount).toBe(2)
  expect(r.excludedFutureObservationIds).toEqual(['future'])
  expect(r.rows.find(x=>x.thresholdId==='loose')?.matchedObservations).toBe(2)
  expect(r.rows.find(x=>x.thresholdId==='loose')?.adverseRate).toBe(.5)
  expect(r.rows.find(x=>x.thresholdId==='strict')?.matchedObservations).toBe(1)
  expect(r.rows.find(x=>x.thresholdId==='strict')?.healthyRate).toBe(1)
  expect(r.canMutateRuntimeThresholds).toBe(false)
  expect(r.rows.every(x=>x.canSelectProductionThreshold===false)).toBe(true)
 })
 it('fails closed on duplicate observations and impossible availability',()=>{
  expect(()=>evaluateWalletClusterThresholdSensitivity({observations:[observations[0],observations[0]],thresholds:[{thresholdId:'x',minWallets:1,maxWindowSeconds:60,minAggregateWalletScore:0}],informationCutoff:'2026-09-03T00:00:00Z'})).toThrow('duplicate_observation')
  expect(()=>evaluateWalletClusterThresholdSensitivity({observations:[{...observations[0],availableAt:'2026-08-31T23:59:59Z'}],thresholds:[{thresholdId:'x',minWallets:1,maxWindowSeconds:60,minAggregateWalletScore:0}],informationCutoff:'2026-09-03T00:00:00Z'})).toThrow('availability_invalid')
 })
 it('normalizes EVM wallet identity before distinct-wallet calibration',()=>{
  expect(normalizeWalletClusterAddress('base','0xAa000000000000000000000000000000000000Bb')).toBe('0xaa000000000000000000000000000000000000bb')
  expect(()=>evaluateWalletClusterThresholdSensitivity({
   observations:[{...observations[0],chainId:'base',distinctWallets:2,walletAddresses:['0xAa000000000000000000000000000000000000Bb','0xaa000000000000000000000000000000000000bb']}],
   thresholds:[{thresholdId:'x',minWallets:1,maxWindowSeconds:900,minAggregateWalletScore:0}],
   informationCutoff:'2026-09-03T00:00:00Z',
  })).toThrow('distinct_wallet_mismatch')
 })
})

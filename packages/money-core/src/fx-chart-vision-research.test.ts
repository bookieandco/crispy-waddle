import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FX_VISION_DATASETS,
  assertFxVisionAvailableAtCutoff,
  assertFxVisionCannotAuthorizeLive,
  createFxVisionEvidence,
  createFxVisionSemanticMapping,
  resolveFxVisionDirection,
} from './fx-chart-vision-research.js'

test('MONEY-PROD.FXV1 public Forex datasets stay opaque by default',()=>{
  const buys=FX_VISION_DATASETS['roboflow:forex-sells/forex-buys']
  const sells=FX_VISION_DATASETS['roboflow:forex-sells/forex-sells']
  assert.equal(buys.imageCount,126);assert.equal(sells.imageCount,199)
  assert.equal(buys.semanticStatus,'OPAQUE_LABELS');assert.equal(sells.semanticStatus,'OPAQUE_LABELS')
  assert.equal(buys.canAuthorizeLive,false);assert.equal(sells.canAuthorizeLive,false)
})

test('MONEY-PROD.FXV2 dataset title cannot promote an opaque class into buy or sell',()=>{
  const evidence=createFxVisionEvidence({
    inferenceId:'fxv-1',datasetId:'roboflow:forex-sells/forex-buys',modelId:'rf-public',modelVersion:'1',rawLabel:'4',confidenceBps:9800,instrumentId:'forex:EURUSD',timeframe:'5m',
    chartWindowStart:'2026-09-21T18:00:00Z',chartWindowEnd:'2026-09-21T18:30:00Z',imageEvidenceRef:'chart:eurusd',imageHash:'h1',inferredAt:'2026-09-21T18:30:01Z',availableAt:'2026-09-21T18:30:02Z',evidenceRefs:['rf:buys','chart:eurusd'],provenanceHash:'p1',
  })
  assert.equal(evidence.direction,'UNRESOLVED');assert.equal(evidence.canAuthorizeLive,false)
  assert.doesNotThrow(()=>assertFxVisionAvailableAtCutoff(evidence,'2026-09-21T18:31:00Z'))
  assert.throws(()=>assertFxVisionAvailableAtCutoff(evidence,'2026-09-21T18:30:00Z'),/FUTURE_LEAK/)
})

test('MONEY-PROD.FXV3 only calibrated semantic mapping can resolve direction and remains research-only',()=>{
  const evidence=createFxVisionEvidence({
    inferenceId:'fxv-2',datasetId:'roboflow:forex-sells/forex-sells',modelId:'rf-public',modelVersion:'1',rawLabel:'9',confidenceBps:8000,instrumentId:'forex:GBPUSD',timeframe:'15m',
    chartWindowStart:'2026-09-21T17:00:00Z',chartWindowEnd:'2026-09-21T18:00:00Z',imageEvidenceRef:'chart:gbpusd',imageHash:'h2',inferredAt:'2026-09-21T18:00:01Z',availableAt:'2026-09-21T18:00:02Z',evidenceRefs:['rf:sells','chart:gbpusd'],provenanceHash:'p2',
  })
  const mapping=createFxVisionSemanticMapping({datasetId:evidence.datasetId,rawLabel:'9',direction:'BEARISH',sampleSize:250,precision:.68,recall:.63,evaluatedAt:'2026-09-21T20:00:00Z',evidenceRefs:['resolved:250'],verifiedBy:'money-fx-vision-calibration-v1'})
  const resolved=resolveFxVisionDirection(evidence,mapping)
  assert.equal(resolved.direction,'BEARISH');assert.equal(resolved.authority,'RESEARCH_ONLY');assert.equal(resolved.canAuthorizeLive,false)
  assert.doesNotThrow(()=>assertFxVisionCannotAuthorizeLive(resolved))
})

test('MONEY-PROD.FXV4 semantic mapping rejects tiny or weak samples',()=>{
  const base={datasetId:'roboflow:forex-sells/forex-buys' as const,rawLabel:'4',direction:'BULLISH' as const,precision:.6,recall:.6,evaluatedAt:'2026-09-21T20:00:00Z',evidenceRefs:['e'],verifiedBy:'calibrator'}
  assert.throws(()=>createFxVisionSemanticMapping({...base,sampleSize:20}),/SAMPLE_TOO_SMALL/)
  assert.throws(()=>createFxVisionSemanticMapping({...base,sampleSize:200,precision:.4}),/QUALITY_TOO_LOW/)
})

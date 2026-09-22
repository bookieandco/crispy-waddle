import assert from 'node:assert/strict'
import test from 'node:test'
import {
  STOCK_VISION_DATASETS,
  assertStockVisionAvailableAtCutoff,
  assertStockVisionCannotAuthorizeLive,
  createStockVisionCalibrationResult,
  createStockVisionPatternEvidence,
  normalizeStockVisionPattern,
} from './stock-chart-vision-research.js'

test('STOCK-VISION.1 dataset registry captures complementary structural and candlestick sources without authority',()=>{
  const structural=STOCK_VISION_DATASETS['roboflow:mod5gen20-cnkzt/stocks-2ulc2']
  const candle=STOCK_VISION_DATASETS['roboflow:glitch-gyhbu/shitty-stocks-patterns']
  assert.equal(structural.imageCount,6572)
  assert.equal(candle.imageCount,2000)
  assert.equal(candle.publicModelId,'shitty-stocks-patterns/6')
  assert.equal(structural.canAuthorizeLive,false)
  assert.equal(candle.canAuthorizeLive,false)
})

test('STOCK-VISION.2 raw dataset labels normalize deterministically',()=>{
  assert.equal(normalizeStockVisionPattern('roboflow:mod5gen20-cnkzt/stocks-2ulc2','W_Bottom'),'W_BOTTOM')
  assert.equal(normalizeStockVisionPattern('roboflow:glitch-gyhbu/shitty-stocks-patterns','Evining-star'),'EVENING_STAR')
  assert.throws(()=>normalizeStockVisionPattern('roboflow:glitch-gyhbu/shitty-stocks-patterns','BUY_NOW'),/UNKNOWN_LABEL/)
})

test('STOCK-VISION.3 visual evidence is research-only and point-in-time bound',()=>{
  const evidence=createStockVisionPatternEvidence({
    detectionId:'vision-1',
    datasetId:'roboflow:glitch-gyhbu/shitty-stocks-patterns',
    modelId:'shitty-stocks-patterns/6',
    modelVersion:'6',
    rawLabel:'Bearish_Engulfing',
    confidenceBps:9200,
    instrumentId:'stock:AAPL',
    timeframe:'5m',
    chartWindowStart:'2026-09-21T19:00:00Z',
    chartWindowEnd:'2026-09-21T19:30:00Z',
    imageEvidenceRef:'chart:aapl:5m:1900-1930',
    imageHash:'sha256:abc',
    inferredAt:'2026-09-21T19:30:05Z',
    availableAt:'2026-09-21T19:30:06Z',
    evidenceRefs:['roboflow:glitch','chart:aapl'],
    provenanceHash:'prov-1',
  })
  assert.equal(evidence.pattern,'BEARISH_ENGULFING')
  assert.equal(evidence.authority,'RESEARCH_ONLY')
  assert.equal(evidence.financialAuthority,'NONE')
  assert.equal(evidence.canAuthorizeLive,false)
  assert.doesNotThrow(()=>assertStockVisionAvailableAtCutoff(evidence,'2026-09-21T19:31:00Z'))
  assert.throws(()=>assertStockVisionAvailableAtCutoff(evidence,'2026-09-21T19:30:00Z'),/FUTURE_LEAK/)
})

test('STOCK-VISION.4 inference rejects future chart windows and invalid confidence',()=>{
  const base={
    detectionId:'vision-2',
    datasetId:'roboflow:mod5gen20-cnkzt/stocks-2ulc2' as const,
    modelId:'research-model',
    modelVersion:'1',
    rawLabel:'Triangle',
    confidenceBps:8000,
    instrumentId:'stock:MSFT',
    timeframe:'1h',
    chartWindowStart:'2026-09-21T18:00:00Z',
    chartWindowEnd:'2026-09-21T19:00:00Z',
    imageEvidenceRef:'chart:msft',
    imageHash:'sha256:def',
    inferredAt:'2026-09-21T19:00:01Z',
    availableAt:'2026-09-21T19:00:02Z',
    evidenceRefs:['chart:msft'],
    provenanceHash:'prov-2',
  }
  assert.throws(()=>createStockVisionPatternEvidence({...base,inferredAt:'2026-09-21T18:59:59Z'}),/FUTURE_WINDOW_LEAK/)
  assert.throws(()=>createStockVisionPatternEvidence({...base,confidenceBps:10001}),/CONFIDENCE_INVALID/)
})

test('STOCK-VISION.5 calibration is learning-only and cannot self-promote to live authority',()=>{
  const calibration=createStockVisionCalibrationResult({
    pattern:'SHOOTING_STAR',
    modelId:'shitty-stocks-patterns/6',
    modelVersion:'6',
    sampleSize:200,
    precision:.7,
    recall:.65,
    brierScore:.2,
    evaluatedAt:'2026-09-21T20:00:00Z',
    evidenceRefs:['resolved-outcomes:1'],
  })
  assert.equal(calibration.authority,'LEARNING_ONLY')
  assert.equal(calibration.canAuthorizeLive,false)
  assert.doesNotThrow(()=>assertStockVisionCannotAuthorizeLive(calibration))
  assert.throws(()=>assertStockVisionCannotAuthorizeLive({authority:'EXECUTION',financialAuthority:'NONE',canAuthorizeLive:true}),/AUTHORITY_FORBIDDEN/)
})

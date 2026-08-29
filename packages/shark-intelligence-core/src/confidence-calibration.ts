export type SharkCalibrationInput = {
  sampleSize: number
  outOfSampleObservations: number
  scenarioCount: number
  performanceStability: number
  riskStability: number
  coverage: number
  uncertainty: number
}

export type SharkCalibrationResult = SharkCalibrationInput & {
  confidence: number
  calibrated: boolean
  reasons: string[]
  simulated: true
}

export function calibrateSharkConfidence(input: SharkCalibrationInput & {
  minimumSamples?: number
  minimumOutOfSample?: number
  minimumScenarios?: number
}): SharkCalibrationResult {
  const minimumSamples = input.minimumSamples ?? 100
  const minimumOutOfSample = input.minimumOutOfSample ?? 20
  const minimumScenarios = input.minimumScenarios ?? 5
  const values = [input.sampleSize, input.outOfSampleObservations, input.scenarioCount, input.performanceStability, input.riskStability, input.coverage, input.uncertainty]
  if (values.some(value => !Number.isFinite(value))) throw new Error('calibration values must be finite')
  if (input.performanceStability < 0 || input.performanceStability > 1) throw new Error('performance stability must be between 0 and 1')
  if (input.riskStability < 0 || input.riskStability > 1) throw new Error('risk stability must be between 0 and 1')
  if (input.coverage < 0 || input.coverage > 1) throw new Error('coverage must be between 0 and 1')
  if (input.uncertainty < 0 || input.uncertainty > 1) throw new Error('uncertainty must be between 0 and 1')

  const reasons: string[] = []
  if (input.sampleSize < minimumSamples) reasons.push('insufficient samples')
  if (input.outOfSampleObservations < minimumOutOfSample) reasons.push('insufficient out-of-sample observations')
  if (input.scenarioCount < minimumScenarios) reasons.push('insufficient scenario diversity')
  if (input.coverage < 0.5) reasons.push('low scenario coverage')
  if (input.uncertainty > 0.5) reasons.push('high uncertainty')
  if (input.performanceStability < 0.5) reasons.push('unstable performance')
  if (input.riskStability < 0.5) reasons.push('unstable risk behavior')

  const sampleFactor = Math.min(1, input.sampleSize / minimumSamples)
  const outOfSampleFactor = Math.min(1, input.outOfSampleObservations / minimumOutOfSample)
  const confidence = Math.max(0, Math.min(1, (sampleFactor + outOfSampleFactor + input.performanceStability + input.riskStability + input.coverage + (1 - input.uncertainty)) / 6))
  const calibrated = reasons.length === 0

  return { ...input, confidence, calibrated, reasons, simulated: true }
}

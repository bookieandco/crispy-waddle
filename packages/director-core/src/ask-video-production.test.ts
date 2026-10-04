import { describe, expect, it } from 'vitest'
import { detectAskVideoCreationIntent } from './ask-video-production.js'

describe('Ask Director video intent', () => {
  it('defaults faceless YouTube videos to widescreen', () => {
    const intent = detectAskVideoCreationIntent('Create a faceless YouTube video about forgotten Detroit history')
    expect(intent).toMatchObject({
      mode: 'faceless',
      aspectRatio: '16:9',
    })
  })

  it('keeps faceless vertical shorts vertical', () => {
    const intent = detectAskVideoCreationIntent('Make a faceless YouTube Short about three weird inventions')
    expect(intent).toMatchObject({
      mode: 'faceless',
      aspectRatio: '9:16',
    })
  })

  it('preserves feature-length targets beyond one hour', () => {
    const intent = detectAskVideoCreationIntent('Produce a 90 minute feature film')
    expect(intent).toMatchObject({
      mode: 'long-form',
      aspectRatio: '16:9',
      targetDurationSeconds: 5400,
    })
  })

  it('still caps pathological runtimes at four hours', () => {
    const intent = detectAskVideoCreationIntent('Create a 12 hour movie')
    expect(intent?.targetDurationSeconds).toBe(14400)
  })
})

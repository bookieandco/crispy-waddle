import assert from 'node:assert/strict'
import { buildPreviousWinFingerprints, scoreProviderAgainstPreviousWins } from './previous-win-similarity.js'

const anchors=buildPreviousWinFingerprints([
  {
    providerId:'winner-1',
    providerName:'Winning Cloud LLC',
    uei:'ABC123',
    naicsCodes:['541512'],
    pscCodes:['D302'],
    agency:'GSA',
    state:'VA',
    awardAmount:250000,
    evidenceRefs:['usaspending:award-1'],
  },
])

const lookalike=scoreProviderAgainstPreviousWins({
  providerId:'candidate-1',
  providerName:'Peer Systems Inc',
  naicsCodes:['541512'],
  pscCodes:[],
  state:'VA',
  keywords:['PSC D302','cloud migration'],
},anchors)
assert.equal(lookalike.score,90)
assert.deepEqual(lookalike.anchorProviderIds,['winner-1'])
assert.ok(lookalike.evidenceRefs.includes('usaspending:award-1'))

const same=scoreProviderAgainstPreviousWins({
  providerId:'winner-copy',
  providerName:'Winning Cloud LLC',
  uei:'ABC123',
  naicsCodes:['541512'],
  pscCodes:['D302'],
},anchors)
assert.equal(same.score,0)

const unrelated=scoreProviderAgainstPreviousWins({
  providerId:'candidate-2',
  providerName:'Unrelated Foods LLC',
  naicsCodes:['311999'],
  pscCodes:['8905'],
},anchors)
assert.equal(unrelated.score,0)

console.log('previous-win similarity tests passed')

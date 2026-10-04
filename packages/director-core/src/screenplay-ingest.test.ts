import {describe,expect,it} from 'vitest'
import {proposeScreenplayBlueprint} from './screenplay-ingest.js'

describe('screenplay ingest proposal',()=>{
  it('extracts scene headings action and dialogue without granting execution authority',()=>{
    const proposal=proposeScreenplayBlueprint({
      projectId:'film-1',
      title:'Test Film',
      evidenceIds:['artifact:script-1'],
      text:`INT. KITCHEN - NIGHT

Rain taps the window.

MAYA
We should leave before dawn.

JON
Not without the keys.

EXT. ALLEY - DAWN

Maya runs toward the car.`,
    })
    expect(proposal.authority).toBe('DIRECTOR_SCREENPLAY_PROPOSAL_ONLY')
    expect(proposal.scenes).toHaveLength(2)
    expect(proposal.scenes[0]?.interiorExterior).toBe('INT')
    expect(proposal.scenes[0]?.dialogue.map(line=>line.characterId)).toEqual(['maya','jon'])
    expect(proposal.scenes[1]?.location).toBe('ALLEY')
    expect(proposal.blockers).toEqual([])
  })

  it('fails closed to a review blocker when scene headings are not detected',()=>{
    const proposal=proposeScreenplayBlueprint({
      projectId:'film-2',
      title:'Loose notes',
      evidenceIds:['artifact:notes-1'],
      text:'A person wakes up. Then the phone rings. They decide to leave.',
    })
    expect(proposal.scenes).toEqual([])
    expect(proposal.blockers).toContain('DIRECTOR_SCREENPLAY_SCENE_HEADINGS_NOT_DETECTED')
  })
})

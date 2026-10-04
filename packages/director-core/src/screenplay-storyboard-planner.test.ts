import {describe,expect,it} from 'vitest'
import {proposeStoryboardFromScreenplay} from './screenplay-storyboard-planner'
import type {ScreenplayScene,StoryTreatment} from './screenplay-blueprint'

const treatment:StoryTreatment={
  id:'treatment:p:1',
  projectId:'p',
  title:'Test',
  synopsis:'A compact test story.',
  beginning:'A begins.',
  middle:'A changes.',
  ending:'A resolves.',
  characterRefs:['alice','bob'],
  locationRefs:['Kitchen'],
  evidenceIds:['ev:treatment'],
  authority:'DIRECTOR_STORY_TREATMENT',
}

const scenes:ScreenplayScene[]=[{
  id:'scene:p:1',
  projectId:'p',
  order:1,
  interiorExterior:'INT',
  location:'Kitchen',
  timeOfDay:'DAY',
  action:['Alice crosses to the table.'],
  dialogue:[{
    id:'dialogue:p:1',
    characterId:'alice',
    text:'We need to talk.',
    evidenceIds:['ev:dialogue'],
  },{
    id:'dialogue:p:2',
    characterId:'bob',
    text:'Then talk.',
    evidenceIds:['ev:dialogue'],
  }],
  treatmentId:treatment.id,
  evidenceIds:['ev:scene'],
  authority:'DIRECTOR_SCREENPLAY_SCENE',
}]

describe('screenplay storyboard planner',()=>{
  it('derives deterministic draft coverage without granting storyboard approval',()=>{
    const proposal=proposeStoryboardFromScreenplay({
      proposalId:'proposal:1',
      treatment,
      scenes,
      evidenceIds:['ev:blueprint'],
      updatedAt:'2026-10-04T19:00:00.000Z',
    })
    expect(proposal.authority).toBe('DIRECTOR_STORYBOARD_PROPOSAL_ONLY')
    expect(proposal.sequences).toHaveLength(1)
    expect(proposal.boards.map(item=>item.title)).toEqual([
      'Scene 1 master',
      'Scene 1 action coverage',
      'alice dialogue coverage',
      'bob dialogue coverage',
    ])
    expect(proposal.boards.every(item=>item.status==='draft')).toBe(true)
    expect(proposal.boards.every(item=>item.version===1)).toBe(true)
    expect(proposal.sequences[0]?.boardIds).toEqual(proposal.boards.map(item=>item.id))
  })

  it('refuses cross-project screenplay lineage',()=>{
    expect(()=>proposeStoryboardFromScreenplay({
      proposalId:'proposal:bad',
      treatment,
      scenes:[{...scenes[0]!,projectId:'other'}],
      evidenceIds:['ev'],
      updatedAt:'2026-10-04T19:00:00.000Z',
    })).toThrow('DIRECTOR_SCREENPLAY_STORYBOARD_LINEAGE_MISMATCH')
  })
})

import type {ScreenplayScene,StoryTreatment} from './screenplay-blueprint.js'
import type {StoryboardBoard,StoryboardSequence} from './storyboard-sequence.js'

export type ScreenplayStoryboardProposal=Readonly<{
  id:string
  projectId:string
  treatmentId:string
  sequences:readonly StoryboardSequence[]
  boards:readonly StoryboardBoard[]
  evidenceIds:readonly string[]
  authority:'DIRECTOR_STORYBOARD_PROPOSAL_ONLY'
}>

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

function safeId(value:string):string{
  return value.trim().replace(/[^a-zA-Z0-9:_-]+/g,'-').replace(/-+/g,'-')
}

function board(input:{
  id:string
  sequenceId:string
  projectId:string
  shotId:string
  order:number
  title:string
  description:string
  scriptRef:string
  action:string
  framing:string
  cameraLanguage:string
  notes:string
  evidenceIds:readonly string[]
  updatedAt:string
}):StoryboardBoard{
  return Object.freeze({
    id:input.id,
    sequenceId:input.sequenceId,
    projectId:input.projectId,
    shotId:input.shotId,
    order:input.order,
    status:'draft',
    title:input.title,
    description:input.description,
    scriptRef:input.scriptRef,
    referenceAssetIds:[],
    continuityAnchorIds:[],
    continuityLocks:['character','wardrobe','location','camera','composition','color','performance'] as NonNullable<StoryboardBoard['continuityLocks']>,
    cameraLanguage:input.cameraLanguage,
    framing:input.framing,
    action:input.action,
    notes:input.notes,
    version:1,
    artifactIds:[...input.evidenceIds],
    updatedAt:input.updatedAt,
  })
}

export function proposeStoryboardFromScreenplay(input:{
  proposalId:string
  treatment:StoryTreatment
  scenes:readonly ScreenplayScene[]
  evidenceIds:readonly string[]
  updatedAt?:string
}):ScreenplayStoryboardProposal{
  const projectId=input.treatment.projectId.trim()
  if(!input.proposalId.trim()||!projectId||!input.treatment.id.trim())throw new Error('DIRECTOR_SCREENPLAY_STORYBOARD_IDENTITY_REQUIRED')
  if(!input.scenes.length)throw new Error('DIRECTOR_SCREENPLAY_STORYBOARD_SCENES_REQUIRED')
  const updatedAt=input.updatedAt??new Date().toISOString()
  if(Number.isNaN(Date.parse(updatedAt)))throw new Error('DIRECTOR_SCREENPLAY_STORYBOARD_TIME_INVALID')
  const evidenceIds=unique([...input.evidenceIds,...input.treatment.evidenceIds])
  if(!evidenceIds.length)throw new Error('DIRECTOR_SCREENPLAY_STORYBOARD_EVIDENCE_REQUIRED')

  const sequences:StoryboardSequence[]=[]
  const boards:StoryboardBoard[]=[]

  for(const scene of [...input.scenes].sort((a,b)=>a.order-b.order)){
    if(scene.projectId!==projectId||scene.treatmentId!==input.treatment.id){
      throw new Error('DIRECTOR_SCREENPLAY_STORYBOARD_LINEAGE_MISMATCH:'+scene.id)
    }
    const sceneKey=safeId(scene.id)
    const sequenceId='storyboard-sequence:'+sceneKey
    const sceneBoards:StoryboardBoard[]=[]
    let ordinal=0

    const masterId='storyboard-board:'+sceneKey+':master'
    sceneBoards.push(board({
      id:masterId,
      sequenceId,
      projectId,
      shotId:scene.id+':shot:master',
      order:ordinal++,
      title:'Scene '+scene.order+' master',
      description:scene.interiorExterior+' '+scene.location+' — '+scene.timeOfDay,
      scriptRef:scene.id,
      action:scene.action.join(' ').trim()||'Establish geography, character positions and scene continuity.',
      framing:'wide/master coverage',
      cameraLanguage:'stable establishing coverage; preserve geography before tighter coverage',
      notes:'Draft coverage proposal from accepted screenplay structure. Requires storyboard review before generation.',
      evidenceIds:unique([...evidenceIds,...scene.evidenceIds]),
      updatedAt,
    }))

    if(scene.action.length){
      const actionId='storyboard-board:'+sceneKey+':action'
      sceneBoards.push(board({
        id:actionId,
        sequenceId,
        projectId,
        shotId:scene.id+':shot:action',
        order:ordinal++,
        title:'Scene '+scene.order+' action coverage',
        description:'Coverage for the scripted physical action and environmental beats.',
        scriptRef:scene.id,
        action:scene.action.join(' '),
        framing:'medium/wide action coverage',
        cameraLanguage:'choose movement only when motivated by blocking; preserve screen direction',
        notes:'Keep physical cause/effect legible. Do not invent un-scripted actions.',
        evidenceIds:unique([...evidenceIds,...scene.evidenceIds]),
        updatedAt,
      }))
    }

    for(const [index,line] of scene.dialogue.entries()){
      const dialogueId='storyboard-board:'+sceneKey+':dialogue:'+(index+1)
      sceneBoards.push(board({
        id:dialogueId,
        sequenceId,
        projectId,
        shotId:scene.id+':shot:dialogue:'+(index+1),
        order:ordinal++,
        title:line.characterId+' dialogue coverage',
        description:'Performance coverage for '+line.characterId+'.',
        scriptRef:line.id,
        action:line.text,
        framing:'medium close-up / performance-first coverage',
        cameraLanguage:'preserve eyeline and matching look direction; favor readable facial performance',
        notes:[
          line.parenthetical?'Parenthetical: '+line.parenthetical+'.':'',
          'Draft dialogue coverage only. Reaction and alternate framing may be added during storyboard review.',
        ].filter(Boolean).join(' '),
        evidenceIds:unique([...evidenceIds,...scene.evidenceIds,...line.evidenceIds]),
        updatedAt,
      }))
    }

    const boardIds=sceneBoards.map(item=>item.id)
    sequences.push(Object.freeze({
      id:sequenceId,
      projectId,
      sceneId:scene.id,
      boardIds,
      version:1,
      updatedAt,
    }))
    boards.push(...sceneBoards)
  }

  return Object.freeze({
    id:input.proposalId.trim(),
    projectId,
    treatmentId:input.treatment.id,
    sequences:Object.freeze(sequences),
    boards:Object.freeze(boards),
    evidenceIds:Object.freeze(evidenceIds),
    authority:'DIRECTOR_STORYBOARD_PROPOSAL_ONLY',
  })
}

import {
  validateScreenplayBlueprint,
  type SceneInteriorExterior,
  type ScreenplayDialogueLine,
  type ScreenplayScene,
  type StoryTreatment,
} from './screenplay-blueprint.js'

export type ScreenplayIngestProposal=Readonly<{
  projectId:string
  title:string
  treatment:StoryTreatment
  scenes:readonly ScreenplayScene[]
  blockers:readonly string[]
  warnings:readonly string[]
  sourceEvidenceIds:readonly string[]
  authority:'DIRECTOR_SCREENPLAY_PROPOSAL_ONLY'
}>

type Heading={interiorExterior:SceneInteriorExterior;location:string;timeOfDay:string}

const headingPattern=/^(INT\/EXT\.|INT\.\/EXT\.|I\/E\.|INT\.|EXT\.)\s*(.+)$/i
const characterCuePattern=/^[A-Z0-9][A-Z0-9 ._'()\-]{0,39}$/

function parseHeading(line:string):Heading|undefined{
  const match=line.trim().match(headingPattern)
  if(!match)return undefined
  const prefix=match[1]!.toUpperCase()
  const remainder=match[2]!.trim()
  const divider=remainder.lastIndexOf(' - ')
  const location=(divider>=0?remainder.slice(0,divider):remainder).trim()||'UNSPECIFIED'
  const timeOfDay=(divider>=0?remainder.slice(divider+3):'UNSPECIFIED').trim()||'UNSPECIFIED'
  const interiorExterior:SceneInteriorExterior=
    prefix.startsWith('EXT.')?'EXT':
    prefix.startsWith('INT.')&&!prefix.includes('EXT')?'INT':'INT/EXT'
  return {interiorExterior,location,timeOfDay}
}

function normalizeLines(text:string):string[]{
  return text.replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/\t/g,' ').trimEnd())
}

function compact(values:readonly string[]):string[]{
  return values.map(value=>value.trim()).filter(Boolean)
}

function unique(values:readonly string[]):string[]{
  return [...new Set(compact(values))]
}

export function proposeScreenplayBlueprint(input:{
  projectId:string
  title:string
  text:string
  evidenceIds:readonly string[]
}):ScreenplayIngestProposal{
  const projectId=input.projectId.trim()
  const title=input.title.trim()||'Untitled'
  const sourceEvidenceIds=unique(input.evidenceIds)
  if(!projectId)throw new Error('DIRECTOR_SCREENPLAY_INGEST_PROJECT_REQUIRED')
  if(!input.text.trim())throw new Error('DIRECTOR_SCREENPLAY_INGEST_TEXT_REQUIRED')
  if(!sourceEvidenceIds.length)throw new Error('DIRECTOR_SCREENPLAY_INGEST_EVIDENCE_REQUIRED')

  const lines=normalizeLines(input.text)
  const sceneStarts=lines.flatMap((line,index)=>parseHeading(line)?[index]:[])
  const warnings:string[]=[]
  const blockers:string[]=[]
  if(!sceneStarts.length){
    blockers.push('DIRECTOR_SCREENPLAY_SCENE_HEADINGS_NOT_DETECTED')
  }

  const treatmentId=`treatment:${projectId}:ingest`
  const scenes:ScreenplayScene[]=[]
  for(let sceneIndex=0;sceneIndex<sceneStarts.length;sceneIndex++){
    const start=sceneStarts[sceneIndex]!
    const end=sceneStarts[sceneIndex+1]??lines.length
    const heading=parseHeading(lines[start]!)!
    const body=lines.slice(start+1,end)
    const action:string[]=[]
    const dialogue:ScreenplayDialogueLine[]=[]
    let index=0
    while(index<body.length){
      const current=body[index]!.trim()
      if(!current){index++;continue}
      if(
        characterCuePattern.test(current)&&
        current===current.toUpperCase()&&
        !parseHeading(current)&&
        body.slice(index+1,index+3).some(line=>Boolean(line.trim()))
      ){
        const characterId=current.replace(/\s*\([^)]*\)\s*$/,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-')||'unknown'
        const parenthetical=current.match(/\(([^)]+)\)\s*$/)?.[1]
        const spoken:string[]=[]
        let cursor=index+1
        while(cursor<body.length){
          const line=body[cursor]!.trim()
          if(!line){if(spoken.length)break;cursor++;continue}
          if(parseHeading(line))break
          if(characterCuePattern.test(line)&&line===line.toUpperCase()&&spoken.length)break
          if(/^\(.+\)$/.test(line)&&spoken.length===0){cursor++;continue}
          spoken.push(line)
          cursor++
        }
        if(spoken.length){
          dialogue.push({
            id:`dialogue:${projectId}:${sceneIndex+1}:${dialogue.length+1}`,
            characterId,
            text:spoken.join(' '),
            ...(parenthetical?{parenthetical}:{}),
            evidenceIds:sourceEvidenceIds,
          })
          index=cursor
          continue
        }
      }
      action.push(current)
      index++
    }
    scenes.push({
      id:`scene:${projectId}:${sceneIndex+1}`,
      projectId,
      order:sceneIndex+1,
      interiorExterior:heading.interiorExterior,
      location:heading.location,
      timeOfDay:heading.timeOfDay,
      action:Object.freeze(action),
      dialogue:Object.freeze(dialogue),
      treatmentId,
      evidenceIds:sourceEvidenceIds,
      authority:'DIRECTOR_SCREENPLAY_SCENE',
    })
  }

  const prose=compact(lines.filter(line=>!parseHeading(line)))
  const third=Math.max(1,Math.floor(prose.length/3))
  const synopsis=prose.slice(0,Math.min(8,prose.length)).join(' ').slice(0,1400)||'Screenplay source attached for Director review.'
  const treatment:StoryTreatment={
    id:treatmentId,
    projectId,
    title,
    synopsis,
    beginning:prose.slice(0,third).join(' ').slice(0,3000)||'Needs Director treatment review.',
    middle:prose.slice(third,third*2).join(' ').slice(0,3000)||'Needs Director treatment review.',
    ending:prose.slice(third*2).join(' ').slice(0,3000)||'Needs Director treatment review.',
    characterRefs:Object.freeze(unique(scenes.flatMap(scene=>scene.dialogue.map(line=>line.characterId)))),
    locationRefs:Object.freeze(unique(scenes.map(scene=>scene.location))),
    evidenceIds:sourceEvidenceIds,
    authority:'DIRECTOR_STORY_TREATMENT',
  }

  if(scenes.some(scene=>scene.timeOfDay==='UNSPECIFIED'))warnings.push('DIRECTOR_SCREENPLAY_TIME_OF_DAY_PARTIAL')
  if(scenes.some(scene=>!scene.dialogue.length))warnings.push('DIRECTOR_SCREENPLAY_SCENE_WITHOUT_DIALOGUE')
  if(scenes.length){
    const validation=validateScreenplayBlueprint({treatment,scenes})
    blockers.push(...validation.reasons)
  }

  return Object.freeze({
    projectId,
    title,
    treatment:Object.freeze(treatment),
    scenes:Object.freeze(scenes),
    blockers:Object.freeze(unique(blockers)),
    warnings:Object.freeze(unique(warnings)),
    sourceEvidenceIds:Object.freeze(sourceEvidenceIds),
    authority:'DIRECTOR_SCREENPLAY_PROPOSAL_ONLY',
  })
}

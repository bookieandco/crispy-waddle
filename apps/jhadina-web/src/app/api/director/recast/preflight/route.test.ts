import {beforeEach,describe,expect,it,vi} from 'vitest'

const mocks=vi.hoisted(()=>({
  user: {id:'owner-a'} as {id:string}|null,
  allow:true,
  unavailable:false,
  bindingRows:[
    {artifact_id:'video-1',role:'footage',label:'Clip'},
    {artifact_id:'image-1',role:'reference',label:'Character'},
    {artifact_id:'audio-1',role:'audio',label:'Sound'},
  ] as Array<Record<string,unknown>>,
  artifactRows:[
    {id:'video-1',owner_user_id:'owner-a',status:'clean',detected_mime_type:'video/mp4',size_bytes:300,sha256:'a'.repeat(64)},
    {id:'image-1',owner_user_id:'owner-a',status:'clean',detected_mime_type:'image/jpeg',size_bytes:200,sha256:'b'.repeat(64)},
    {id:'audio-1',owner_user_id:'owner-a',status:'clean',detected_mime_type:'audio/wav',size_bytes:250,sha256:'c'.repeat(64)},
  ] as Array<Record<string,unknown>>,
  readTables:[] as string[],
  eqCalls:[] as Array<[string,string,unknown]>,
}))
vi.mock('@/lib/supabase/server',()=>({
  createClient:async()=>({auth:{getUser:async()=>({data:{user:mocks.user}})}}),
}))
vi.mock('@/lib/director-project-authority',()=>({
  requireDirectorProjectAuthority:async(_client:unknown,req:{projectId:string;userId:string;capability:string})=>{
    if(!mocks.allow)throw new Error('DIRECTOR_PROJECT_ACCESS_DENIED')
    if(req.capability!=='edit'||req.userId!=='owner-a'||req.projectId!=='project-a')throw new Error('DIRECTOR_PROJECT_ACCESS_DENIED')
  },
}))
vi.mock('@/lib/supabase/service-role',()=>({
  createServiceRoleClient:()=>{
    if(mocks.unavailable)return null
    return {from:(table:string)=>{
      mocks.readTables.push(table)
      const q:any={}
      q.select=()=>q
      q.eq=(column:string,value:unknown)=>{mocks.eqCalls.push([table,column,value]);return q}
      q.in=(_column:string,_values:unknown[])=>table==='jhadina_artifacts'
        ?Promise.resolve({data:mocks.artifactRows,error:null})
        :q
      q.limit=async()=>({data:mocks.bindingRows,error:null})
      return q
    }}
  },
}))
import {GET,POST} from './route'

const selection={projectId:'project-a',sourceVideoAssetId:'video-1',replacementCharacterAssetId:'image-1',sourceAudioAssetId:'audio-1',durationSeconds:10}
const post=(body:unknown)=>new Request('https://example.test/api/director/recast/preflight',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
})
const get=()=>new Request('https://example.test/api/director/recast/preflight?projectId=project-a')

describe('Director Recast read-only preflight',()=>{
  beforeEach(()=>{
    mocks.user={id:'owner-a'};mocks.allow=true;mocks.unavailable=false
    mocks.readTables=[];mocks.eqCalls=[]
    mocks.artifactRows=[
      {id:'video-1',owner_user_id:'owner-a',status:'clean',detected_mime_type:'video/mp4',size_bytes:300,sha256:'a'.repeat(64)},
      {id:'image-1',owner_user_id:'owner-a',status:'clean',detected_mime_type:'image/jpeg',size_bytes:200,sha256:'b'.repeat(64)},
      {id:'audio-1',owner_user_id:'owner-a',status:'clean',detected_mime_type:'audio/wav',size_bytes:250,sha256:'c'.repeat(64)},
    ]
  })
  it('rejects anonymous and unauthorized users before any privileged read',async()=>{
    mocks.user=null
    const anon=await GET(get())
    expect(anon.status).toBe(401)
    expect(mocks.readTables).toEqual([])
    mocks.user={id:'owner-a'};mocks.allow=false
    const forbidden=await POST(post(selection))
    expect(forbidden.status).toBe(403)
    expect(mocks.readTables).toEqual([])
  })
  it('GET lists only owner-bound source references and no signed URLs',async()=>{
    const result=await GET(get())
    expect(result.status).toBe(200)
    const data=await result.json()
    expect(data.inputs).toEqual(expect.arrayContaining([
      expect.objectContaining({artifactId:'video-1',role:'footage',clean:true}),
    ]))
    expect(JSON.stringify(data)).not.toContain('sha256')
    expect(data.renderEnabled).toBe(false)
    expect(mocks.eqCalls).toContainEqual(['director_project_inputs','owner_user_id','owner-a'])
    expect(mocks.eqCalls).toContainEqual(['jhadina_artifacts','owner_user_id','owner-a'])
  })
  it('POST never grants render authority even when clean owner media is verified',async()=>{
    const result=await POST(post(selection))
    expect(result.status).toBe(200)
    const data=await result.json()
    expect(data.mediaVerified).toBe(true)
    expect(data.readyForRender).toBe(false)
    expect(data.outputKind).toBe('NO_RENDER')
    expect(data.actionAuthority).toBe('NONE')
    expect(data.blockers).toContain('DIRECTOR_RECAST_LIKENESS_CONSENT_UNVERIFIED')
    expect(mocks.readTables).toEqual(['director_project_inputs','jhadina_artifacts'])
  })
  it('denies cross-project asset swaps, unclean media and bogus durations',async()=>{
    let result=await POST(post({...selection,sourceVideoAssetId:'video:foreign'}))
    expect((await result.json()).mediaVerified).toBe(false)
    mocks.artifactRows[0]={...mocks.artifactRows[0],status:'quarantined'}
    result=await POST(post(selection))
    expect((await result.json()).mediaVerified).toBe(false)
    result=await POST(post({...selection,durationSeconds:100}))
    expect((await result.json()).readyForRender).toBe(false)
  })
  it('fails closed on storage outage',async()=>{
    mocks.unavailable=true
    const result=await GET(get())
    expect(result.status).toBe(503)
  })
})

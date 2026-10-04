'use client'

import {useCallback,useEffect,useRef,useState} from 'react'
import {getCurrentUserId} from '@/lib/auth/current-user'

type InputRole='script'|'reference'|'footage'|'audio'|'b_roll'|'notes'
type ProjectInput={
  id:string
  artifactId:string
  role:InputRole
  label?:string|null
  createdAt:string
  artifact?:{original_name?:string;detected_mime_type?:string;status?:string;extracted_text_ref?:string|null}|null
}

const ROLE_LABEL:Record<InputRole,string>={
  script:'Script / treatment',
  reference:'Creative reference',
  footage:'Source footage',
  audio:'Music / audio',
  b_roll:'B-roll',
  notes:'Notes',
}

export function WorkstationProjectInputs({projectId}:{projectId:string}){
  const fileRef=useRef<HTMLInputElement>(null)
  const [role,setRole]=useState<InputRole>('script')
  const [inputs,setInputs]=useState<ProjectInput[]>([])
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/workstation/inputs?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;inputs?:ProjectInput[];error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load project inputs')
    setInputs(data.inputs??[])
  },[projectId])

  useEffect(()=>{void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load project inputs'))},[load])

  async function upload(files:FileList|null){
    if(!files?.length||busy)return
    const userId=await getCurrentUserId()
    if(!userId){setStatus('Sign in before attaching Director inputs.');return}
    setBusy(true)
    try{
      for(const file of Array.from(files).slice(0,8)){
        setStatus('Scanning '+file.name+'…')
        const form=new FormData()
        form.append('file',file)
        const uploadResponse=await fetch('/api/jhadina/artifacts',{
          method:'POST',
          headers:{'x-jhadina-user-id':userId},
          body:form,
        })
        const uploadData=await uploadResponse.json() as {
          success?:boolean
          artifact?:{id:string;name:string;status:string;contextReady?:boolean;extractionStatus?:string}
          error?:string
        }
        if(!uploadResponse.ok||!uploadData.success||!uploadData.artifact){
          throw new Error(uploadData.error??('Upload failed: '+file.name))
        }
        if(uploadData.artifact.status!=='clean'){
          throw new Error(file.name+' did not pass Artifact Core scanning.')
        }

        setStatus('Binding '+file.name+' to this Director project…')
        const bindResponse=await fetch('/api/workstation/inputs',{
          method:'POST',
          headers:{'content-type':'application/json'},
          body:JSON.stringify({
            projectId,
            artifactId:uploadData.artifact.id,
            role,
            label:file.name,
            metadata:{
              contextReady:Boolean(uploadData.artifact.contextReady),
              extractionStatus:uploadData.artifact.extractionStatus,
            },
          }),
        })
        const bindData=await bindResponse.json() as {ok?:boolean;error?:string}
        if(!bindResponse.ok||!bindData.ok)throw new Error(bindData.error??('Unable to bind '+file.name))
      }
      await load()
      setStatus('Project inputs updated.')
      if(fileRef.current)fileRef.current.value=''
    }catch(error){
      setStatus(error instanceof Error?error.message:'Unable to add Director input.')
    }finally{
      setBusy(false)
    }
  }

  return <section className="rounded-xl border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold">Project inputs</h2>
        <p className="text-xs text-muted-foreground">Scripts, references, footage, B-roll, audio and notes stay attached to this Director project with Artifact Core provenance.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="rounded border bg-background px-2 py-1.5 text-sm" value={role} disabled={busy} onChange={event=>setRole(event.target.value as InputRole)}>
          {(Object.keys(ROLE_LABEL) as InputRole[]).map(value=><option key={value} value={value}>{ROLE_LABEL[value]}</option>)}
        </select>
        <button className="rounded border px-3 py-1.5 text-sm disabled:opacity-50" disabled={busy} onClick={()=>fileRef.current?.click()}>
          {busy?'Working…':'Add files'}
        </button>
        <input
          ref={fileRef}
          hidden
          multiple
          type="file"
          accept=".txt,.md,.fountain,.fdx,.pdf,.docx,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.wav,.mp3,.m4a,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/wav,audio/mpeg,audio/mp4"
          onChange={event=>void upload(event.target.files)}
        />
      </div>
    </div>

    {inputs.length?<div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {inputs.map(input=><div key={input.id} className="rounded-lg border bg-muted/20 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{input.label||input.artifact?.original_name||input.artifactId}</span>
          <span className="rounded border px-1.5 py-0.5 uppercase text-[10px]">{input.role.replace('_',' ')}</span>
        </div>
        <p className="mt-1 text-muted-foreground">{input.artifact?.detected_mime_type??'artifact'} · {input.artifactId}</p>
        {input.role==='script'&&input.artifact?.extracted_text_ref?<p className="mt-1">Text extracted and ready for screenplay reasoning.</p>:null}
      </div>)}
    </div>:<p className="mt-3 text-xs text-muted-foreground">No project inputs yet. Add a script, references, source footage, audio, B-roll or notes.</p>}
    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}

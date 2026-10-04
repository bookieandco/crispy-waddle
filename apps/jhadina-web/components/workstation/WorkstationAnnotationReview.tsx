'use client'

import {useCallback,useEffect,useState} from 'react'

type ImportRow={
  id:string
  imported_at:string
  shape_count:number
  review_status:'pending'|'accepted'|'rejected'
  reviewed_at?:string|null
  review_note?:string|null
  raw_summary?:{
    labels?:string[]
    annotationKinds?:string[]
  }
}

type TaskRow={
  id:string
  scope:'director'|'sports'|'watch'
  project_id?:string|null
  asset_id?:string|null
  title:string
  provider:string
  provider_task_id?:string|null
  provider_web_url?:string|null
  provider_status:string
  error?:string|null
  updated_at:string
  imports?:ImportRow[]
}

export function WorkstationAnnotationReview({projectId}:{projectId:string}){
  const [tasks,setTasks]=useState<TaskRow[]>([])
  const [busy,setBusy]=useState<string|null>(null)
  const [status,setStatus]=useState<string|null>(null)

  const load=useCallback(async()=>{
    const response=await fetch('/api/director/annotations?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
    const data=await response.json() as {ok?:boolean;tasks?:TaskRow[];error?:string}
    if(!response.ok||!data.ok)throw new Error(data.error??'Unable to load annotation review tasks')
    setTasks(data.tasks??[])
  },[projectId])

  useEffect(()=>{
    void load().catch(error=>setStatus(error instanceof Error?error.message:'Unable to load annotation review tasks'))
  },[load])

  async function action(body:Record<string,unknown>,busyId:string){
    setBusy(busyId);setStatus(null)
    try{
      const response=await fetch('/api/director/annotations',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(body),
      })
      const data=await response.json() as {ok?:boolean;error?:string}
      if(!response.ok||!data.ok)throw new Error(data.error??'Annotation action failed')
      await load()
      setStatus(
        body.action==='refresh'?'CVAT task refreshed.':
        body.action==='import'?'Reviewed CVAT annotations imported as candidate evidence.':
        body.action==='review'&&body.decision==='accepted'
          ?'Annotation evidence accepted for this Director project.'
          :'Annotation evidence rejected; it will not become accepted project evidence.'
      )
    }catch(error){
      setStatus(error instanceof Error?error.message:'Annotation action failed')
    }finally{
      setBusy(null)
    }
  }

  if(!tasks.length&&!status)return null

  return <section className="rounded-xl border bg-background p-4">
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Visual ground truth</p>
      <h2 className="font-semibold">CVAT annotation review</h2>
      <p className="text-xs text-muted-foreground">
        Automatic detections and CVAT imports stay candidate evidence until you explicitly accept them. They cannot publish, edit the timeline, or establish official sports reality.
      </p>
    </div>

    {tasks.length?<div className="mt-3 grid gap-3">
      {tasks.map(task=><article key={task.id} className="rounded-lg border p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{task.title}</p>
            <p className="text-xs text-muted-foreground">
              {task.provider} · {task.provider_status} · {task.asset_id??'project evidence'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {task.provider_web_url?<a
              className="rounded border px-2 py-1 text-xs"
              href={task.provider_web_url}
              target="_blank"
              rel="noreferrer"
            >Open CVAT</a>:null}
            <button
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              disabled={busy!==null||!task.provider_task_id}
              onClick={()=>void action({action:'refresh',taskId:task.id},'refresh:'+task.id)}
            >{busy==='refresh:'+task.id?'Refreshing…':'Refresh'}</button>
            <button
              className="rounded border px-2 py-1 text-xs disabled:opacity-40"
              disabled={busy!==null||!task.provider_task_id}
              onClick={()=>void action({action:'import',taskId:task.id},'import:'+task.id)}
            >{busy==='import:'+task.id?'Importing…':'Import reviewed labels'}</button>
          </div>
        </div>

        {task.error?<p className="mt-2 text-xs text-destructive">{task.error}</p>:null}

        {(task.imports??[]).length?<div className="mt-3 grid gap-2">
          {(task.imports??[]).map(item=><div key={item.id} className="rounded border bg-muted/20 p-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {item.shape_count} annotation{item.shape_count===1?'':'s'} · {item.review_status}
                {item.raw_summary?.labels?.length?' · '+item.raw_summary.labels.join(', '):''}
              </span>
              {item.review_status==='pending'?<div className="flex gap-2">
                <button
                  className="rounded border px-2 py-1 disabled:opacity-40"
                  disabled={busy!==null}
                  onClick={()=>void action({action:'review',importId:item.id,decision:'rejected'},'reject:'+item.id)}
                >Reject</button>
                <button
                  className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-40"
                  disabled={busy!==null}
                  onClick={()=>void action({action:'review',importId:item.id,decision:'accepted'},'accept:'+item.id)}
                >{busy==='accept:'+item.id?'Accepting…':'Accept evidence'}</button>
              </div>:null}
            </div>
          </div>)}
        </div>:null}
      </article>)}
    </div>:<p className="mt-3 text-xs text-muted-foreground">No CVAT review tasks are attached to this project yet.</p>}

    {status?<p className="mt-3 text-xs text-muted-foreground" role="status">{status}</p>:null}
  </section>
}

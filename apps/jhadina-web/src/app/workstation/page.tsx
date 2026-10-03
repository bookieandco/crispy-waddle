'use client';

import {useEffect,useRef,useState} from 'react';
import type {EditingAssetManifestEntry} from '@jhadina/director-core';
import {LiveGeneratedEditingAssetShelf} from '../../../components/workstation/LiveGeneratedEditingAssetShelf';
import {WorkstationTimeline} from '../../../components/workstation/WorkstationTimeline';
import {ReferenceCharacterVideoPanel} from '../../../components/workstation/ReferenceCharacterVideoPanel';
import type {EditableTimeline,TimelineClip} from '@jhadina/director-core/timeline-model';
import type {TimelineCommand} from '@jhadina/director-core/timeline-command';

type WorkstationPageProps={searchParams:{projectId?:string}};
type WorkstationClip=TimelineClip&{name:string;kind:'video'|'audio'};

function normalizeTimeline(timeline:EditableTimeline):EditableTimeline{
  return {
    ...timeline,
    tracks:timeline.tracks.map(track=>({
      ...track,
      clips:track.clips.map(clip=>({
        ...clip,
        name:clip.name?.trim()||(
          clip.id.startsWith('generated:')
            ?`Generated asset ${clip.assetId}`
            :clip.id
        ),
      })),
    })),
  };
}

export default function WorkstationPage({searchParams}:WorkstationPageProps){
  const requestedProjectId=searchParams.projectId?.trim()||'';
  const [projectId,setProjectId]=useState(requestedProjectId);
  const [projectError,setProjectError]=useState<string|null>(null);
  const [timeline,setTimeline]=useState<EditableTimeline|null>(null);
  const [snapshotVersion,setSnapshotVersion]=useState(0);
  const [timelineKey,setTimelineKey]=useState(0);
  const [selectedAsset,setSelectedAsset]=useState<EditingAssetManifestEntry|null>(null);
  const [inserting,setInserting]=useState(false);
  const [insertError,setInsertError]=useState<string|null>(null);
  const timelineRef=useRef<EditableTimeline|null>(null);
  const snapshotVersionRef=useRef(0);

  useEffect(()=>{
    let cancelled=false;
    void(async()=>{
      try{
        let resolvedProjectId=requestedProjectId;
        if(!resolvedProjectId){
          const projectResponse=await fetch('/api/workstation/projects',{
            method:'POST',
            headers:{'content-type':'application/json'},
            body:JSON.stringify({defaultProject:true}),
          });
          const projectData=await projectResponse.json() as {ok?:boolean;projectId?:string;error?:string};
          if(!projectResponse.ok||!projectData.ok||!projectData.projectId){
            throw new Error(projectData.error??'Unable to create Director project');
          }
          resolvedProjectId=projectData.projectId;
        }

        const timelineResponse=await fetch(
          `/api/workstation/timeline?projectId=${encodeURIComponent(resolvedProjectId)}`,
          {cache:'no-store'},
        );
        const timelineData=await timelineResponse.json() as {
          ok?:boolean;
          timeline?:EditableTimeline;
          snapshotVersion?:number;
          error?:string;
        };
        if(
          !timelineResponse.ok
          ||!timelineData.ok
          ||!timelineData.timeline
          ||!Number.isInteger(timelineData.snapshotVersion)
        ){
          throw new Error(timelineData.error??'Unable to load Director timeline');
        }

        if(cancelled) return;
        const canonical=normalizeTimeline(timelineData.timeline);
        timelineRef.current=canonical;
        snapshotVersionRef.current=Number(timelineData.snapshotVersion);
        setProjectId(resolvedProjectId);
        setTimeline(canonical);
        setSnapshotVersion(Number(timelineData.snapshotVersion));
        setProjectError(null);
      }catch(error){
        if(!cancelled) setProjectError(error instanceof Error?error.message:'Unable to prepare Director project');
      }
    })();
    return()=>{cancelled=true};
  },[requestedProjectId]);

  function handleTimelineChange(change:{timeline:EditableTimeline;snapshotVersion:number}){
    const canonical=normalizeTimeline(change.timeline);
    timelineRef.current=canonical;
    snapshotVersionRef.current=change.snapshotVersion;
    setTimeline(canonical);
    setSnapshotVersion(change.snapshotVersion);
  }

  async function insertSelectedAsset(){
    const current=timelineRef.current;
    if(!selectedAsset||!current||inserting||!projectId) return;
    setInserting(true);
    setInsertError(null);

    try{
      const startSeconds=typeof selectedAsset.startSeconds==='number'
        ?selectedAsset.startSeconds
        :current.playheadSeconds;
      const requestedEnd=typeof selectedAsset.endSeconds==='number'
        ?selectedAsset.endSeconds
        :startSeconds+5;
      const endSeconds=Math.min(
        current.durationSeconds,
        Math.max(startSeconds+0.1,requestedEnd),
      );
      if(startSeconds>=current.durationSeconds){
        throw new Error('The selected asset starts at the end of the timeline.');
      }

      const command:TimelineCommand={
        type:'insert-generated-asset',
        asset:{
          assetId:selectedAsset.assetId,
          generationJobId:selectedAsset.generationJobId,
          uri:selectedAsset.uri,
          mimeType:selectedAsset.mimeType,
          mediaType:selectedAsset.kind,
          operationId:selectedAsset.operationId,
          sourceId:selectedAsset.sourceId,
          startSeconds,
          endSeconds,
          metadata:{
            manifestEntryId:selectedAsset.assetId,
            ...selectedAsset.metadata,
          },
        },
      };

      const response=await fetch('/api/workstation/timeline/command',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          projectId,
          expectedVersion:snapshotVersionRef.current,
          command,
        }),
      });
      const data=await response.json() as {
        ok?:boolean;
        error?:string;
        reason?:string;
        timeline?:EditableTimeline;
        snapshotVersion?:number;
        currentVersion?:number;
      };
      if(!response.ok||!data.ok||!data.timeline||!Number.isInteger(data.snapshotVersion)){
        if(response.status===409&&data.timeline&&Number.isInteger(data.currentVersion)){
          const refreshed=normalizeTimeline(data.timeline);
          timelineRef.current=refreshed;
          snapshotVersionRef.current=Number(data.currentVersion);
          setTimeline(refreshed);
          setSnapshotVersion(Number(data.currentVersion));
          setTimelineKey(key=>key+1);
        }
        throw new Error(data.error??data.reason??'Generated asset insertion failed.');
      }

      const next=normalizeTimeline(data.timeline);
      timelineRef.current=next;
      snapshotVersionRef.current=Number(data.snapshotVersion);
      setTimeline(next);
      setSnapshotVersion(Number(data.snapshotVersion));
      setTimelineKey(key=>key+1);
    }catch(error){
      setInsertError(error instanceof Error?error.message:'Unable to insert generated asset.');
    }finally{
      setInserting(false);
    }
  }

  if(!projectId||!timeline){
    return(
      <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4">
        <header className="rounded-xl border bg-background p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">DirectorOS Workstation</p>
          <h1 className="text-2xl font-semibold">Preparing project</h1>
          <p className={projectError?'text-sm text-destructive':'text-sm text-muted-foreground'}>
            {projectError??'Loading your owner-scoped canonical Director timeline…'}
          </p>
        </header>
      </main>
    );
  }

  return(
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 p-4">
      <header className="rounded-xl border bg-background p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">DirectorOS Workstation</p>
        <h1 className="text-2xl font-semibold">Edit project</h1>
        <p className="text-sm text-muted-foreground">
          Project: {projectId} · canonical snapshot v{snapshotVersion}
        </p>
      </header>

      <ReferenceCharacterVideoPanel projectId={projectId}/>

      <section className="rounded-xl border bg-background p-4">
        <div className="mb-3">
          <h2 className="font-semibold">Generated editing assets</h2>
          <p className="text-xs text-muted-foreground">
            Persisted assets are retrieved by project and require explicit approval before use.
          </p>
        </div>
        <LiveGeneratedEditingAssetShelf projectId={projectId} onUseAsset={setSelectedAsset}/>
        {selectedAsset?(
          <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
            <p className="font-medium">Selected for edit</p>
            <p>Job: {selectedAsset.generationJobId}</p>
            <p>Operation: {selectedAsset.operationId??'—'}</p>
            <p>URI: {selectedAsset.uri}</p>
            <p>MIME: {selectedAsset.mimeType}</p>
            <button
              className="mt-3 rounded bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
              disabled={inserting}
              onClick={()=>void insertSelectedAsset()}
            >
              {inserting?'Inserting…':'Insert into timeline'}
            </button>
            {insertError?<p className="mt-2 text-destructive">{insertError}</p>:null}
          </div>
        ):null}
      </section>

      <WorkstationTimeline
        key={timelineKey}
        initialTimeline={timeline}
        snapshotVersion={snapshotVersion}
        onTimelineChange={handleTimelineChange}
      />
    </main>
  );
}

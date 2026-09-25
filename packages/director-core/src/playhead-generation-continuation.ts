import type { GenerationReferenceManifest } from './generation-reference-manifest.js';
import type { EditableTimeline, TimelineClip, TimelineTrack } from './timeline-model.js';

export interface CurrentFrameExtractionPlan {
  id: string;
  projectId: string;
  timelineVersionId: string;
  sourceClipId: string;
  sourceAssetId: string;
  playheadSeconds: number;
  timelineFrameIndex: number;
  sourceTimeSeconds: number;
  outputFrameAssetId: string;
  purpose: 'continue-motion' | 'variation' | 'first-frame';
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_CURRENT_FRAME_EXTRACTION';
}

export interface ExtractedCurrentFrameArtifact {
  planId: string;
  assetId: string;
  sha256: string;
  width: number;
  height: number;
  evidenceIds: readonly string[];
}

export function planCurrentFrameExtraction(input: {
  id: string;
  timeline: EditableTimeline;
  timelineVersionId: string;
  selectedClipId?: string;
  purpose?: CurrentFrameExtractionPlan['purpose'];
  evidenceIds: readonly string[];
}): CurrentFrameExtractionPlan {
  if (!input.id.trim() || !input.timelineVersionId.trim()) {
    throw new Error('DIRECTOR_CURRENT_FRAME_IDENTITY_REQUIRED');
  }
  if (!input.evidenceIds.length) throw new Error('DIRECTOR_CURRENT_FRAME_EVIDENCE_REQUIRED');
  const candidate=resolveVisualClipAtPlayhead(input.timeline,input.selectedClipId);
  if (!candidate) throw new Error('DIRECTOR_CURRENT_FRAME_VISUAL_CLIP_REQUIRED');

  const {clip}=candidate;
  const localSeconds=input.timeline.playheadSeconds-clip.startSeconds;
  const speed=clip.speed ?? 1;
  if (!Number.isFinite(speed)||speed<=0) throw new Error('DIRECTOR_CURRENT_FRAME_CLIP_SPEED_INVALID');
  const sourceIn=clip.sourceInSeconds ?? 0;
  const inferredOut=sourceIn+clip.durationSeconds*speed;
  const sourceOut=clip.sourceOutSeconds ?? inferredOut;
  const sourceTime=clip.reverse
    ? sourceOut-localSeconds*speed
    : sourceIn+localSeconds*speed;
  if (!Number.isFinite(sourceTime)||sourceTime<0) throw new Error('DIRECTOR_CURRENT_FRAME_SOURCE_TIME_INVALID');

  const frameIndex=Math.floor(input.timeline.playheadSeconds*input.timeline.fps+1e-9);
  const frameAssetId=`${clip.assetId}:frame:${sourceTime.toFixed(6)}`;
  return Object.freeze({
    id:input.id,
    projectId:input.timeline.projectId,
    timelineVersionId:input.timelineVersionId,
    sourceClipId:clip.id,
    sourceAssetId:clip.assetId,
    playheadSeconds:input.timeline.playheadSeconds,
    timelineFrameIndex:frameIndex,
    sourceTimeSeconds:sourceTime,
    outputFrameAssetId:frameAssetId,
    purpose:input.purpose ?? 'continue-motion',
    evidenceIds:Object.freeze([...input.evidenceIds]),
    authority:'DIRECTOR_CURRENT_FRAME_EXTRACTION',
  });
}

export function buildCurrentFrameGenerationManifest(input: {
  id: string;
  shotId: string;
  extraction: CurrentFrameExtractionPlan;
  frame: ExtractedCurrentFrameArtifact;
}): GenerationReferenceManifest {
  if (!input.id.trim()||!input.shotId.trim()) throw new Error('DIRECTOR_CURRENT_FRAME_MANIFEST_IDENTITY_REQUIRED');
  if (input.frame.planId!==input.extraction.id) throw new Error('DIRECTOR_CURRENT_FRAME_ARTIFACT_PLAN_MISMATCH');
  if (input.frame.assetId!==input.extraction.outputFrameAssetId) throw new Error('DIRECTOR_CURRENT_FRAME_ARTIFACT_ID_MISMATCH');
  if (!input.frame.sha256.trim()||!input.frame.evidenceIds.length) throw new Error('DIRECTOR_CURRENT_FRAME_ARTIFACT_PROVENANCE_REQUIRED');
  if (
    !Number.isInteger(input.frame.width)||input.frame.width<=0||
    !Number.isInteger(input.frame.height)||input.frame.height<=0
  ) throw new Error('DIRECTOR_CURRENT_FRAME_ARTIFACT_DIMENSIONS_INVALID');

  return Object.freeze({
    id:input.id,
    projectId:input.extraction.projectId,
    shotId:input.shotId,
    references:Object.freeze([
      Object.freeze({
        slot:1,
        assetId:input.frame.assetId,
        sha256:input.frame.sha256,
        media:'image' as const,
        role:'first-frame' as const,
        semanticLabel:`Exact timeline frame at ${input.extraction.playheadSeconds.toFixed(3)}s; use as continuation start frame`,
        promptToken:'CURRENT_FRAME',
        required:true,
        evidenceIds:Object.freeze([
          ...input.extraction.evidenceIds,
          ...input.frame.evidenceIds,
          `timeline-version:${input.extraction.timelineVersionId}`,
          `source-time:${input.extraction.sourceTimeSeconds.toFixed(6)}`,
        ]),
      }),
      Object.freeze({
        slot:2,
        assetId:input.extraction.sourceAssetId,
        media:'video' as const,
        role:'source-video' as const,
        semanticLabel:'Source timeline video containing the extracted continuation frame',
        promptToken:'SOURCE_VIDEO',
        required:false,
        evidenceIds:Object.freeze([
          ...input.extraction.evidenceIds,
          `source-clip:${input.extraction.sourceClipId}`,
        ]),
      }),
    ]),
    authority:'DIRECTOR_REFERENCE_MANIFEST',
  });
}

function resolveVisualClipAtPlayhead(
  timeline:EditableTimeline,
  selectedClipId?:string,
):{track:TimelineTrack;clip:TimelineClip}|undefined{
  const visuals=timeline.tracks
    .filter(track=>(track.kind==='video'||track.kind==='overlay')&&!track.hidden)
    .flatMap(track=>track.clips
      .filter(clip=>isActiveAt(timeline.playheadSeconds,clip)&&(clip.opacity ?? 1)>0)
      .map(clip=>({track,clip})));

  if(selectedClipId){
    const selected=visuals.find(item=>item.clip.id===selectedClipId);
    if(!selected) throw new Error('DIRECTOR_CURRENT_FRAME_SELECTED_CLIP_NOT_ACTIVE');
    return selected;
  }

  return visuals.sort((a,b)=>
    b.track.index-a.track.index ||
    b.clip.startSeconds-a.clip.startSeconds ||
    a.clip.id.localeCompare(b.clip.id)
  )[0];
}

function isActiveAt(playhead:number,clip:TimelineClip):boolean{
  return playhead>=clip.startSeconds && playhead<clip.startSeconds+clip.durationSeconds;
}

import type { EditableTimeline, TimelineClip, TimelineTrack } from './timeline-model.js';

export type DirectorNleFormat = 'otio' | 'fcpxml';

export interface DirectorTimelineRoundTripPolicy {
  timingToleranceSeconds: number;
  requireTrackKinds: readonly TimelineTrack['kind'][];
  requireSourceRanges: boolean;
  requireTakeMetadata: boolean;
  requireTransforms: boolean;
}

export interface DirectorTimelineRoundTripDecision {
  admissible: boolean;
  reasons: readonly string[];
  authority: 'DIRECTOR_NLE_ROUND_TRIP_QC';
}

function clipName(clip:TimelineClip):string {
  return clip.name?.trim() || clip.id;
}

function externalReference(clip:TimelineClip){
  return {
    OTIO_SCHEMA:'ExternalReference.1',
    target_url:`jhadina-asset://${encodeURIComponent(clip.assetId)}`,
    metadata:{
      jhadinaAssetId:clip.assetId,
      takeGroupId:clip.takeGroupId,
      takeId:clip.takeId,
      audioRole:clip.audioRole,
    },
  };
}

function rationalTime(seconds:number,fps:number){
  return {OTIO_SCHEMA:'RationalTime.1',value:seconds*fps,rate:fps};
}

function timeRange(clip:TimelineClip,fps:number){
  return {
    OTIO_SCHEMA:'TimeRange.1',
    start_time:rationalTime(clip.sourceInSeconds??0,fps),
    duration:rationalTime(clip.durationSeconds,fps),
  };
}

export function serializeDirectorTimelineToOtio(
  timeline:EditableTimeline,
  timelineVersionId:string,
):string{
  if(!timelineVersionId.trim()) throw new Error('DIRECTOR_NLE_TIMELINE_VERSION_REQUIRED');
  const payload={
    OTIO_SCHEMA:'Timeline.1',
    name:`Jhadina ${timeline.projectId}`,
    metadata:{
      jhadinaProjectId:timeline.projectId,
      jhadinaTimelineVersionId:timelineVersionId,
      fps:timeline.fps,
      width:timeline.width,
      height:timeline.height,
    },
    tracks:{
      OTIO_SCHEMA:'Stack.1',
      name:'tracks',
      children:timeline.tracks
        .slice()
        .sort((a,b)=>a.index-b.index)
        .map((track)=>({
          OTIO_SCHEMA:'Track.1',
          name:track.name,
          kind:track.kind==='audio'?'Audio':'Video',
          metadata:{
            jhadinaTrackId:track.id,
            jhadinaTrackKind:track.kind,
            relationship:track.relationship,
            role:track.role,
            locked:track.locked??false,
          },
          children:track.clips
            .slice()
            .sort((a,b)=>a.startSeconds-b.startSeconds)
            .map((clip)=>({
              OTIO_SCHEMA:'Clip.2',
              name:clipName(clip),
              source_range:timeRange(clip,timeline.fps),
              media_reference:externalReference(clip),
              metadata:{
                jhadinaClipId:clip.id,
                timelineStartSeconds:clip.startSeconds,
                sourceOutSeconds:clip.sourceOutSeconds,
                speed:clip.speed??1,
                reverse:clip.reverse??false,
                transform:clip.transform,
                crop:clip.crop,
                opacity:clip.opacity,
                blendMode:clip.blendMode,
                keyframes:clip.keyframes??[],
                effects:clip.effects,
                generativeRegions:clip.generativeRegions,
              },
            })),
        })),
    },
  };
  return JSON.stringify(payload,null,2);
}

function xmlEscape(value:string):string{
  return value
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

function sec(value:number):string{
  const micros=Math.round(value*1_000_000);
  return `${micros}/1000000s`;
}

export function serializeDirectorTimelineToFcpxml(
  timeline:EditableTimeline,
  timelineVersionId:string,
):string{
  if(!timelineVersionId.trim()) throw new Error('DIRECTOR_NLE_TIMELINE_VERSION_REQUIRED');
  const clips=timeline.tracks.flatMap((track)=>track.clips.map((clip)=>({track,clip})));
  const resources=clips.map(({clip},index)=>
    `    <asset id="r${index+2}" name="${xmlEscape(clipName(clip))}" src="jhadina-asset://${encodeURIComponent(clip.assetId)}" start="${sec(clip.sourceInSeconds??0)}" duration="${sec(clip.sourceDurationSeconds??clip.durationSeconds)}" hasVideo="1" hasAudio="${clip.audioRole?'1':'0'}"/>`
  ).join('\n');
  const spine=clips
    .sort((a,b)=>a.clip.startSeconds-b.clip.startSeconds || a.track.index-b.track.index)
    .map(({track,clip},index)=>{
      const lane=track.index===0?'':` lane="${track.index}"`;
      const attrs=[
        `ref="r${index+2}"`,
        `name="${xmlEscape(clipName(clip))}"`,
        `offset="${sec(clip.startSeconds)}"`,
        `start="${sec(clip.sourceInSeconds??0)}"`,
        `duration="${sec(clip.durationSeconds)}"`,
        `data-jhadina-clip-id="${xmlEscape(clip.id)}"`,
        `data-jhadina-asset-id="${xmlEscape(clip.assetId)}"`,
      ].join(' ');
      return `              <asset-clip ${attrs}${lane}/>`;
    }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<fcpxml version="1.11">
  <resources>
    <format id="r1" name="Jhadina" frameDuration="${sec(1/timeline.fps)}" width="${timeline.width}" height="${timeline.height}"/>
${resources}
  </resources>
  <library>
    <event name="Jhadina">
      <project name="${xmlEscape(timeline.projectId)}">
        <sequence format="r1" duration="${sec(timeline.durationSeconds)}" tcStart="0s" tcFormat="NDF">
          <metadata>
            <md key="com.jhadina.projectId" value="${xmlEscape(timeline.projectId)}"/>
            <md key="com.jhadina.timelineVersionId" value="${xmlEscape(timelineVersionId)}"/>
          </metadata>
          <spine>
${spine}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

function clipMap(timeline:EditableTimeline):Map<string,{track:TimelineTrack;clip:TimelineClip}>{
  return new Map(timeline.tracks.flatMap((track)=>track.clips.map((clip)=>[clip.id,{track,clip}] as const)));
}

function near(a:number|undefined,b:number|undefined,tolerance:number):boolean{
  if(a===undefined||b===undefined) return a===b;
  return Math.abs(a-b)<=tolerance;
}

function sameTransform(a:TimelineClip['transform'],b:TimelineClip['transform']):boolean{
  return JSON.stringify(a??null)===JSON.stringify(b??null);
}

export function evaluateDirectorTimelineRoundTrip(
  original:EditableTimeline,
  imported:EditableTimeline,
  policy:DirectorTimelineRoundTripPolicy,
):DirectorTimelineRoundTripDecision{
  const reasons:string[]=[];
  if(original.projectId!==imported.projectId) reasons.push('DIRECTOR_NLE_PROJECT_MISMATCH');
  if(original.fps!==imported.fps) reasons.push('DIRECTOR_NLE_FPS_MISMATCH');
  if(original.width!==imported.width||original.height!==imported.height) reasons.push('DIRECTOR_NLE_FRAME_SIZE_MISMATCH');
  if(!near(original.durationSeconds,imported.durationSeconds,policy.timingToleranceSeconds)) reasons.push('DIRECTOR_NLE_DURATION_MISMATCH');

  const importedKinds=new Set(imported.tracks.map((track)=>track.kind));
  for(const kind of policy.requireTrackKinds){
    if(!importedKinds.has(kind)) reasons.push(`DIRECTOR_NLE_TRACK_KIND_MISSING:${kind}`);
  }

  const before=clipMap(original);
  const after=clipMap(imported);
  for(const [id,{track,clip}] of before){
    const candidate=after.get(id);
    if(!candidate){
      reasons.push(`DIRECTOR_NLE_CLIP_MISSING:${id}`);
      continue;
    }
    if(candidate.clip.assetId!==clip.assetId) reasons.push(`DIRECTOR_NLE_ASSET_CHANGED:${id}`);
    if(candidate.track.kind!==track.kind) reasons.push(`DIRECTOR_NLE_TRACK_KIND_CHANGED:${id}`);
    if(!near(candidate.clip.startSeconds,clip.startSeconds,policy.timingToleranceSeconds)) reasons.push(`DIRECTOR_NLE_START_CHANGED:${id}`);
    if(!near(candidate.clip.durationSeconds,clip.durationSeconds,policy.timingToleranceSeconds)) reasons.push(`DIRECTOR_NLE_CLIP_DURATION_CHANGED:${id}`);
    if(policy.requireSourceRanges){
      if(!near(candidate.clip.sourceInSeconds,clip.sourceInSeconds,policy.timingToleranceSeconds)) reasons.push(`DIRECTOR_NLE_SOURCE_IN_CHANGED:${id}`);
      if(!near(candidate.clip.sourceOutSeconds,clip.sourceOutSeconds,policy.timingToleranceSeconds)) reasons.push(`DIRECTOR_NLE_SOURCE_OUT_CHANGED:${id}`);
    }
    if(policy.requireTakeMetadata&&(candidate.clip.takeId!==clip.takeId||candidate.clip.takeGroupId!==clip.takeGroupId)){
      reasons.push(`DIRECTOR_NLE_TAKE_METADATA_CHANGED:${id}`);
    }
    if(policy.requireTransforms&&!sameTransform(candidate.clip.transform,clip.transform)){
      reasons.push(`DIRECTOR_NLE_TRANSFORM_CHANGED:${id}`);
    }
  }

  return Object.freeze({
    admissible:reasons.length===0,
    reasons:Object.freeze([...new Set(reasons)]),
    authority:'DIRECTOR_NLE_ROUND_TRIP_QC',
  });
}

export const DIRECTOR_FEATURE_NLE_ROUND_TRIP_POLICY:DirectorTimelineRoundTripPolicy=Object.freeze({
  timingToleranceSeconds:1/120,
  requireTrackKinds:Object.freeze(['video','audio'] as TimelineTrack['kind'][]),
  requireSourceRanges:true,
  requireTakeMetadata:true,
  requireTransforms:true,
});

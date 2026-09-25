import type { EditableTimeline, TimelineClip, TimelineTrack } from './timeline-model.js';

export type QuickCutVideoType = 'dialogue-driven' | 'visual-only';
export type QuickCutMediaScope = 'current-project' | 'current-timeline' | 'current-selection';
export type QuickCutMediaRole = 'a-roll' | 'b-roll' | 'unknown';

export type QuickCutSpeechKind = 'dialogue' | 'production-direction' | 'filler' | 'other';

export interface QuickCutTranscriptSpan {
  id: string;
  startSeconds: number;
  endSeconds: number;
  text: string;
  speakerId?: string;
  speechKind?: QuickCutSpeechKind;
  themeTags: readonly string[];
  importance: number;
  evidenceIds: readonly string[];
}

export interface QuickCutMediaItem {
  assetId: string;
  durationSeconds: number;
  hasDecipherableSpeech: boolean;
  scopes: readonly QuickCutMediaScope[];
  manualRole?: QuickCutMediaRole;
  transcriptSpans?: readonly QuickCutTranscriptSpan[];
  visualTags?: readonly string[];
  evidenceIds: readonly string[];
}

export interface QuickCutRequest {
  id: string;
  projectId: string;
  fps: number;
  width: number;
  height: number;
  videoType: QuickCutVideoType;
  mediaScope: QuickCutMediaScope;
  prompt?: string;
  focusThemes?: readonly string[];
  brollThemes?: readonly string[];
  minimumDistinctSpeakers?: number;
  targetDurationSeconds: number;
  createBrollTrack: boolean;
  minimumThemeSupport?: number;
  sourceMedia: readonly QuickCutMediaItem[];
  baseTimelineVersionId?: string;
  iteration?: number;
}

export interface QuickCutSelection {
  id: string;
  assetId: string;
  role: 'a-roll' | 'b-roll';
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  themeTags: readonly string[];
  score: number;
  evidenceIds: readonly string[];
  transcriptText?: string;
  speakerId?: string;
}

export interface QuickCutProposal {
  id: string;
  projectId: string;
  iteration: number;
  videoType: QuickCutVideoType;
  mediaScope: QuickCutMediaScope;
  prompt?: string;
  focusThemes: readonly string[];
  brollThemes: readonly string[];
  baseTimelineVersionId?: string;
  targetDurationSeconds: number;
  estimatedDurationSeconds: number;
  selections: readonly QuickCutSelection[];
  unsupportedThemes: readonly string[];
  timeline: EditableTimeline;
  limitations: readonly string[];
  authority: 'PROPOSAL_ONLY';
}

export function planQuickCut(request: QuickCutRequest): QuickCutProposal {
  const reasons=validateRequest(request);
  if (reasons.length) throw new Error(`DIRECTOR_QUICK_CUT_INVALID: ${reasons.join(', ')}`);

  const focusThemes=normalizeThemes(request.focusThemes ?? promptThemes(request.prompt ?? ''));
  const brollThemes=normalizeThemes(request.brollThemes ?? focusThemes);
  const eligible=request.sourceMedia.filter(item=>item.scopes.includes(request.mediaScope));
  if (!eligible.length) throw new Error('DIRECTOR_QUICK_CUT_SCOPE_EMPTY');

  const aCandidates=request.videoType === 'dialogue-driven'
    ? dialogueCandidates(eligible,focusThemes)
    : visualCandidates(eligible,focusThemes,'a-roll');

  const selectedA=selectToDuration(
    aCandidates,
    request.targetDurationSeconds,
    request.videoType === 'dialogue-driven' ? request.minimumDistinctSpeakers ?? 1 : 0,
    focusThemes,
  );
  if (!selectedA.length) {
    throw new Error(request.videoType === 'dialogue-driven'
      ? 'DIRECTOR_QUICK_CUT_DIALOGUE_EVIDENCE_REQUIRED'
      : 'DIRECTOR_QUICK_CUT_VISUAL_EVIDENCE_REQUIRED');
  }

  const selectedThemeSet=new Set(selectedA.flatMap(item=>item.themeTags.map(normalizeTheme)));
  const unsupportedThemes=focusThemes.filter(theme=>!selectedThemeSet.has(normalizeTheme(theme)));
  const minimumThemeSupport=request.minimumThemeSupport ?? 0;
  if (focusThemes.length && (focusThemes.length-unsupportedThemes.length)/focusThemes.length < minimumThemeSupport) {
    throw new Error('DIRECTOR_QUICK_CUT_THEME_SUPPORT_INSUFFICIENT');
  }

  const aTrack=buildARollTrack(selectedA);
  const bSelections=request.createBrollTrack
    ? selectBroll(eligible,selectedA,brollThemes,request.targetDurationSeconds)
    : [];
  const tracks:TimelineTrack[]=[aTrack];
  if (bSelections.length) tracks.push(buildBrollTrack(bSelections,selectedA));

  const estimatedDurationSeconds=aTrack.clips.reduce(
    (max,clip)=>Math.max(max,clip.startSeconds+clip.durationSeconds),
    0,
  );
  const limitations:string[]=[];
  if (unsupportedThemes.length) limitations.push(`unsupported-themes:${unsupportedThemes.join('|')}`);
  if (!bSelections.length && request.createBrollTrack) limitations.push('no-admissible-broll');
  if (Math.abs(estimatedDurationSeconds-request.targetDurationSeconds)>Math.max(5,request.targetDurationSeconds*.2)) {
    limitations.push('target-duration-approximate');
  }

  const timeline:EditableTimeline={
    version:1,
    projectId:request.projectId,
    fps:request.fps,
    width:request.width,
    height:request.height,
    durationSeconds:estimatedDurationSeconds,
    playheadSeconds:0,
    tracks,
    transitions:[],
    markers:unsupportedThemes.map((theme,index)=>({
      id:`${request.id}:unsupported:${index+1}`,
      timeSeconds:0,
      label:`Requested theme not supported by selected media: ${theme}`,
      notes:'Quick Cut does not invent missing dialogue/visual evidence.',
    })),
    versions:[],
  };

  return Object.freeze({
    id:request.id,
    projectId:request.projectId,
    iteration:request.iteration ?? 1,
    videoType:request.videoType,
    mediaScope:request.mediaScope,
    prompt:request.prompt,
    focusThemes:Object.freeze(focusThemes),
    brollThemes:Object.freeze(brollThemes),
    baseTimelineVersionId:request.baseTimelineVersionId,
    targetDurationSeconds:request.targetDurationSeconds,
    estimatedDurationSeconds,
    selections:Object.freeze([...selectedA,...bSelections]),
    unsupportedThemes:Object.freeze(unsupportedThemes),
    timeline,
    limitations:Object.freeze(limitations),
    authority:'PROPOSAL_ONLY',
  });
}

export function classifyQuickCutRole(item:QuickCutMediaItem):QuickCutMediaRole {
  if (item.manualRole && item.manualRole!=='unknown') return item.manualRole;
  if (item.hasDecipherableSpeech) return 'a-roll';
  if (!item.hasDecipherableSpeech) return 'b-roll';
  return 'unknown';
}

function validateRequest(request:QuickCutRequest):string[] {
  const reasons:string[]=[];
  if (!request.id.trim()||!request.projectId.trim()) reasons.push('DIRECTOR_QUICK_CUT_IDENTITY_REQUIRED');
  if (!Number.isFinite(request.fps)||request.fps<=0) reasons.push('DIRECTOR_QUICK_CUT_FPS_INVALID');
  if (!Number.isInteger(request.width)||request.width<=0||!Number.isInteger(request.height)||request.height<=0) {
    reasons.push('DIRECTOR_QUICK_CUT_DIMENSIONS_INVALID');
  }
  if (!Number.isFinite(request.targetDurationSeconds)||request.targetDurationSeconds<=0) {
    reasons.push('DIRECTOR_QUICK_CUT_DURATION_INVALID');
  }
  if (
    request.mediaScope !== 'current-project' &&
    !request.baseTimelineVersionId?.trim()
  ) reasons.push('DIRECTOR_QUICK_CUT_BASE_TIMELINE_VERSION_REQUIRED');
  if (
    request.minimumDistinctSpeakers!==undefined &&
    (!Number.isInteger(request.minimumDistinctSpeakers)||request.minimumDistinctSpeakers<1)
  ) reasons.push('DIRECTOR_QUICK_CUT_SPEAKER_COUNT_INVALID');
  if (
    request.minimumThemeSupport!==undefined &&
    (!Number.isFinite(request.minimumThemeSupport)||request.minimumThemeSupport<0||request.minimumThemeSupport>1)
  ) reasons.push('DIRECTOR_QUICK_CUT_THEME_SUPPORT_INVALID');
  for (const item of request.sourceMedia) {
    if (!item.assetId.trim()||!Number.isFinite(item.durationSeconds)||item.durationSeconds<=0||!item.evidenceIds.length) {
      reasons.push(`DIRECTOR_QUICK_CUT_MEDIA_INVALID:${item.assetId||'unknown'}`);
    }
    for (const span of item.transcriptSpans ?? []) {
      if (
        !span.id.trim()||
        !span.text.trim()||
        span.startSeconds<0||
        span.endSeconds<=span.startSeconds||
        span.endSeconds>item.durationSeconds||
        !Number.isFinite(span.importance)||
        span.importance<0||
        span.importance>1||
        !span.evidenceIds.length
      ) reasons.push(`DIRECTOR_QUICK_CUT_TRANSCRIPT_INVALID:${span.id||item.assetId}`);
    }
  }
  return [...new Set(reasons)];
}

function dialogueCandidates(media:readonly QuickCutMediaItem[],themes:readonly string[]):QuickCutSelection[] {
  return media.flatMap(item=>{
    if (classifyQuickCutRole(item)!=='a-roll') return [];
    return (item.transcriptSpans ?? [])
      .filter(span=>span.speechKind !== 'production-direction' && span.speechKind !== 'filler')
      .map(span=>{
      const semantic=themeOverlap(span.themeTags,themes);
      return {
        id:`quickcut:a:${span.id}`,
        assetId:item.assetId,
        role:'a-roll' as const,
        sourceStartSeconds:span.startSeconds,
        sourceEndSeconds:span.endSeconds,
        themeTags:Object.freeze([...span.themeTags]),
        score:score(span.importance,semantic,themes.length),
        evidenceIds:Object.freeze([...new Set([...item.evidenceIds,...span.evidenceIds])]),
        transcriptText:span.text,
        speakerId:span.speakerId,
      };
    });
  }).filter(item=>item.score>0 || themes.length===0);
}

function visualCandidates(
  media:readonly QuickCutMediaItem[],
  themes:readonly string[],
  role:'a-roll'|'b-roll',
):QuickCutSelection[] {
  return media.flatMap((item,index)=>{
    const classified=classifyQuickCutRole(item);
    if (role==='b-roll' && classified!=='b-roll') return [];
    const tags=item.visualTags ?? [];
    const semantic=themeOverlap(tags,themes);
    if (themes.length && semantic===0) return [];
    return [{
      id:`quickcut:${role==='a-roll'?'a':'b'}:${item.assetId}:${index}`,
      assetId:item.assetId,
      role,
      sourceStartSeconds:0,
      sourceEndSeconds:item.durationSeconds,
      themeTags:Object.freeze([...tags]),
      score:themes.length?semantic:0.5,
      evidenceIds:Object.freeze([...item.evidenceIds]),
    }];
  });
}

function selectToDuration(
  candidates:readonly QuickCutSelection[],
  target:number,
  minimumDistinctSpeakers=0,
  requiredThemes:readonly string[]=[],
):QuickCutSelection[] {
  const ordered=[...candidates].sort((a,b)=>b.score-a.score || a.sourceStartSeconds-b.sourceStartSeconds || a.id.localeCompare(b.id));
  const selected:QuickCutSelection[]=[];
  let duration=0;

  const addCandidate=(candidate:QuickCutSelection,maximumSeconds:number):boolean=>{
    if (selected.some(item=>item.id===candidate.id)) return false;
    const available=candidate.sourceEndSeconds-candidate.sourceStartSeconds;
    const remaining=target-duration;
    const used=Math.min(available,remaining,maximumSeconds);
    if (used<0.1) return false;
    selected.push(Object.freeze({
      ...candidate,
      sourceEndSeconds:candidate.sourceStartSeconds+used,
    }));
    duration+=used;
    return true;
  };

  if (minimumDistinctSpeakers>1) {
    const bySpeaker=new Map<string,QuickCutSelection[]>();
    for (const candidate of ordered) {
      if (!candidate.speakerId?.trim()) continue;
      const bucket=bySpeaker.get(candidate.speakerId) ?? [];
      bucket.push(candidate);
      bySpeaker.set(candidate.speakerId,bucket);
    }
    if (bySpeaker.size<minimumDistinctSpeakers) {
      throw new Error('DIRECTOR_QUICK_CUT_SPEAKER_DIVERSITY_INSUFFICIENT');
    }
    const speakers=[...bySpeaker.entries()].slice(0,minimumDistinctSpeakers);
    for (let index=0;index<speakers.length;index++) {
      const candidate=speakers[index]![1][0]!;
      const remainingSpeakers=speakers.length-index;
      addCandidate(candidate,Math.max(.1,(target-duration)/remainingSpeakers));
    }
  }

  const normalizedThemes=normalizeThemes(requiredThemes);
  for (let index=0;index<normalizedThemes.length;index++) {
    const theme=normalizedThemes[index]!;
    const alreadyCovered=selected.some(item=>item.themeTags.map(normalizeTheme).includes(theme));
    if (alreadyCovered) continue;
    const candidate=ordered.find(item=>
      !selected.some(chosen=>chosen.id===item.id) &&
      item.themeTags.map(normalizeTheme).includes(theme)
    );
    if (!candidate) continue;
    const remainingThemes=normalizedThemes
      .slice(index)
      .filter(value=>!selected.some(item=>item.themeTags.map(normalizeTheme).includes(value)))
      .length;
    addCandidate(candidate,Math.max(.1,(target-duration)/Math.max(1,remainingThemes)));
  }

  for (const candidate of ordered) {
    if (duration>=target) break;
    addCandidate(candidate,target-duration);
  }
  return selected;
}

function selectBroll(
  media:readonly QuickCutMediaItem[],
  aRoll:readonly QuickCutSelection[],
  themes:readonly string[],
  targetDuration:number,
):QuickCutSelection[] {
  const candidates=visualCandidates(media,themes,'b-roll');
  if (!candidates.length) return [];
  const selected:QuickCutSelection[]=[];
  const maxBroll=Math.min(targetDuration*.65,targetDuration);
  let used=0;
  for (const a of aRoll) {
    if (used>=maxBroll) break;
    const contextual=candidates
      .filter(b=>!selected.some(s=>s.assetId===b.assetId&&s.sourceStartSeconds===b.sourceStartSeconds))
      .map(b=>({...b,score:b.score+themeOverlap(b.themeTags,a.themeTags)}))
      .sort((x,y)=>y.score-x.score||x.id.localeCompare(y.id))[0];
    if (!contextual) continue;
    const duration=Math.min(contextual.sourceEndSeconds-contextual.sourceStartSeconds,Math.max(1,Math.min(5,a.sourceEndSeconds-a.sourceStartSeconds)),maxBroll-used);
    if (duration<.1) continue;
    selected.push(Object.freeze({...contextual,sourceEndSeconds:contextual.sourceStartSeconds+duration}));
    used+=duration;
  }
  return selected;
}

function buildARollTrack(selections:readonly QuickCutSelection[]):TimelineTrack {
  let cursor=0;
  const clips:TimelineClip[]=selections.map(selection=>{
    const duration=selection.sourceEndSeconds-selection.sourceStartSeconds;
    const clip:TimelineClip={
      id:`${selection.id}:clip`,
      name:selection.transcriptText?.slice(0,80)||'Quick Cut A-roll',
      assetId:selection.assetId,
      trackId:'quickcut-a-roll',
      startSeconds:cursor,
      durationSeconds:duration,
      sourceInSeconds:selection.sourceStartSeconds,
      sourceOutSeconds:selection.sourceEndSeconds,
      effects:[],
      generativeRegions:[],
    };
    cursor+=duration;
    return clip;
  });
  return {
    id:'quickcut-a-roll',
    name:'Quick Cut A-roll',
    kind:'video',
    index:0,
    relationship:'primary',
    clips,
  };
}

function buildBrollTrack(
  selections:readonly QuickCutSelection[],
  aRoll:readonly QuickCutSelection[],
):TimelineTrack {
  let cursor=0;
  const clips:TimelineClip[]=selections.map((selection,index)=>{
    const a=aRoll[Math.min(index,aRoll.length-1)];
    const start=cursor;
    const duration=selection.sourceEndSeconds-selection.sourceStartSeconds;
    cursor+=a?Math.max(duration,(a.sourceEndSeconds-a.sourceStartSeconds)):duration;
    return {
      id:`${selection.id}:clip`,
      name:'Quick Cut B-roll',
      assetId:selection.assetId,
      trackId:'quickcut-b-roll',
      startSeconds:start,
      durationSeconds:duration,
      sourceInSeconds:selection.sourceStartSeconds,
      sourceOutSeconds:selection.sourceEndSeconds,
      muted:true,
      effects:[],
      generativeRegions:[],
    };
  });
  return {
    id:'quickcut-b-roll',
    name:'Quick Cut B-roll',
    kind:'overlay',
    index:1,
    relationship:'connected',
    clips,
  };
}

function score(importance:number,semantic:number,themeCount:number):number {
  return themeCount?importance*.55+semantic*.45:importance;
}

function themeOverlap(tags:readonly string[],themes:readonly string[]):number {
  if (!themes.length) return 0;
  const set=new Set(tags.map(normalizeTheme));
  const hits=themes.map(normalizeTheme).filter(theme=>set.has(theme)).length;
  return hits/themes.length;
}

function normalizeThemes(values:readonly string[]):string[] {
  return [...new Set(values.map(normalizeTheme).filter(Boolean))];
}

function normalizeTheme(value:string):string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

function promptThemes(prompt:string):string[] {
  const stop=new Set(['a','an','and','are','as','at','be','by','for','from','in','is','it','of','on','or','that','the','this','to','with','video','show','make','create','short']);
  return normalizeThemes(prompt.split(/[,.;:\n]+|\band\b/gi)
    .flatMap(part=>part.split(/\s+/))
    .filter(token=>token.length>=3&&!stop.has(token.toLowerCase()))
  );
}

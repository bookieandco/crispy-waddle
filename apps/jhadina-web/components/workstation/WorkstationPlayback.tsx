'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {directorPlaybackSourceTime,type DirectorPlaybackSegment} from '@jhadina/director-core/timeline-playback-plan'

type MediaSegment=DirectorPlaybackSegment & {url:string}
type PreviewResponse={ok?:boolean;revision?:number;durationSeconds?:number;segments?:MediaSegment[];notices?:string[];error?:string}

/**
 * Native iPhone-compatible A/V playback of approved source clips.
 * This deliberately does not flatten effects, transitions, overlays or final QC.
 */
export function WorkstationPlayback({projectId,revision,playheadSeconds,sliderDuration,onSeek}:{
  projectId:string;revision:number;playheadSeconds:number;sliderDuration:number;onSeek:(time:number)=>void
}){
  const [segments,setSegments]=useState<MediaSegment[]>([])
  const [notices,setNotices]=useState<string[]>([])
  const [error,setError]=useState<string|null>(null)
  const [playing,setPlaying]=useState(false)
  const [clock,setClock]=useState(playheadSeconds)
  const clockRef=useRef(playheadSeconds)
  const playingRef=useRef(false)
  const videoRef=useRef<HTMLVideoElement|null>(null)
  const audioRefs=useRef<Map<string,HTMLAudioElement>>(new Map())

  useEffect(()=>{
    let cancelled=false
    setPlaying(false)
    playingRef.current=false
    setSegments([])
    void (async()=>{
      try{
        const response=await fetch('/api/workstation/timeline/preview?projectId='+encodeURIComponent(projectId),{cache:'no-store'})
        const data=await response.json() as PreviewResponse
        if(!response.ok||!data.ok||data.revision!==revision)throw new Error(data.error??'Preview changed; reload timeline')
        if(cancelled)return
        setSegments(data.segments??[])
        setNotices(data.notices??[])
        setError(null)
      }catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:'Preview unavailable')}
    })()
    return()=>{cancelled=true}
  },[projectId,revision])

  useEffect(()=>{
    if(playingRef.current)return
    clockRef.current=playheadSeconds
    setClock(playheadSeconds)
  },[playheadSeconds])

  useEffect(()=>{
    if(!playing)return
    let frame=0
    let last=performance.now()
    const tick=(now:number)=>{
      const delta=Math.min(0.1,(now-last)/1000)
      last=now
      const next=Math.min(sliderDuration,clockRef.current+Math.max(0,delta))
      clockRef.current=next
      setClock(next)
      if(next>=sliderDuration){setPlaying(false);playingRef.current=false;return}
      frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(frame)
  },[playing,sliderDuration])

  const visible=useMemo(()=>segments.filter(clip=>clip.startSeconds<=clock&&clip.endSeconds>clock),[segments,clock])
  const video=visible.filter(clip=>clip.kind==='video').at(-1)
  const audio=visible.filter(clip=>clip.kind==='audio')
  const sync=useCallback((element:HTMLMediaElement|null,clip:MediaSegment)=>{
    if(!element)return
    const expected=directorPlaybackSourceTime(clip,clockRef.current)
    if(!Number.isFinite(element.currentTime)||Math.abs(element.currentTime-expected)>.24){
      try{element.currentTime=expected}catch{/* Safari metadata not loaded yet */}
    }
    element.playbackRate=clip.speed
    element.volume=clip.volume
    if(playingRef.current){
      if(element.paused)void element.play().catch(()=>{setPlaying(false);playingRef.current=false;setError('Tap Play to authorize media playback')})
    }else if(!element.paused)element.pause()
  },[])

  useEffect(()=>{
    if(video)sync(videoRef.current,video)
    for(const clip of audio)sync(audioRefs.current.get(clip.clipId)??null,clip)
  },[video,audio,sync,clock,playing])

  const seek=(seconds:number)=>{
    const next=Math.max(0,Math.min(sliderDuration,seconds))
    clockRef.current=next
    setClock(next)
    onSeek(next)
  }
  const toggle=()=>{
    if(playingRef.current){playingRef.current=false;setPlaying(false);return}
    if(!segments.length){setError('No approved project media available for preview');return}
    playingRef.current=true
    setPlaying(true)
    setError(null)
  }
  return <section aria-label="Director synchronized preview" className="space-y-2 rounded-xl border bg-background p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Synchronized edit preview</h3>
      <span className="text-xs text-muted-foreground">Source playback only · not a final MP4</span>
    </div>
    <div className="relative mx-auto aspect-video max-h-[55vh] w-full overflow-hidden rounded-lg bg-black">
      {video?<video key={video.clipId} ref={videoRef} src={video.url} playsInline preload="auto" className="h-full w-full object-contain" onLoadedMetadata={event=>sync(event.currentTarget,video)}/>:<div className="flex h-full items-center justify-center text-sm text-white/80">No video at this position</div>}
    </div>
    {audio.map(clip=><audio key={clip.clipId} src={clip.url} preload="auto"
      ref={element=>{if(element)audioRefs.current.set(clip.clipId,element);else audioRefs.current.delete(clip.clipId)}}
      onLoadedMetadata={event=>sync(event.currentTarget,clip)} />)}
    <div className="flex items-center gap-3">
      <button type="button" onClick={toggle} className="min-h-11 rounded bg-primary px-5 py-2 text-sm text-primary-foreground">{playing?'Pause':'Play'}</button>
      <input aria-label="Scrub Director preview" className="min-w-0 flex-1" type="range" min={0} max={sliderDuration} step=".05" value={clock} onChange={event=>seek(Number(event.target.value))} />
      <output className="whitespace-nowrap text-xs tabular-nums">{clock.toFixed(1)} / {sliderDuration.toFixed(1)}s</output>
    </div>
    {error?<p role="alert" className="text-xs text-destructive">{error}</p>:null}
    {notices.length?<p className="text-xs text-muted-foreground">{notices.length} clip(s) unavailable: unapproved, missing, unsupported or unsigned.</p>:null}
    <p className="text-xs text-muted-foreground">Playback uses native iPhone video and audio. Browser preview does not apply final transitions, effects, or mastering; the separate offline final-render path is required.</p>
  </section>
}

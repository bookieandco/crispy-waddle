"use client"

import { useEffect, useRef, useState } from "react"

export type JhadinaConversationSignals = {
  source: "live-microphone"
  observedAt: string
  language: string
  utteranceDurationMs?: number
  speakingRateWpm?: number
  pauseRatio?: number
  rmsMean?: number
  rmsPeak?: number
  energyVariance?: number
  pitchMeanHz?: number
  pitchVariance?: number
}

export type JhadinaEphemeralArtifact = {
  id: string
  kind: "screen" | "image" | "text"
  mimeType: string
  source: "screen-share" | "file-picker" | "clipboard"
  name?: string
  observedAt: string
  text?: string
  base64?: string
}

type Props = {
  busy: boolean
  onArtifactsChange: (artifacts: JhadinaEphemeralArtifact[]) => void
  onVoiceCommand: (command: string, signals?: JhadinaConversationSignals) => void
  onLanguageChange?: (language: string) => void
  onStatus?: (message: string) => void
}

const LANGUAGES = [
  ["en-US", "English (US)"],
  ["es-US", "Español"],
  ["fr-FR", "Français"],
  ["de-DE", "Deutsch"],
  ["pt-BR", "Português"],
  ["it-IT", "Italiano"],
  ["ar-SA", "العربية"],
  ["hi-IN", "हिन्दी"],
  ["ja-JP", "日本語"],
  ["ko-KR", "한국어"],
  ["zh-CN", "中文"],
  ["ru-RU", "Русский"],
  ["vi-VN", "Tiếng Việt"],
] as const

export function JhadinaLiveInput({ busy, onArtifactsChange, onVoiceCommand, onLanguageChange, onStatus }: Props) {
  const [wakeEnabled, setWakeEnabled] = useState(false)
  const [language, setLanguage] = useState("en-US")
  const [voiceState, setVoiceState] = useState<"off"|"listening"|"unsupported"|"error">("off")
  const [screenActive, setScreenActive] = useState(false)
  const [artifacts, setArtifacts] = useState<JhadinaEphemeralArtifact[]>([])
  const recognitionRef = useRef<any>(null)
  const shouldWakeRef = useRef(false)
  const streamRef = useRef<MediaStream|null>(null)
  const micStreamRef = useRef<MediaStream|null>(null)
  const audioContextRef = useRef<AudioContext|null>(null)
  const analyserRef = useRef<AnalyserNode|null>(null)
  const acousticTimerRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const acousticSamplesRef = useRef<Array<{at:number;rms:number;pitch?:number}>>([])
  const videoRef = useRef<HTMLVideoElement|null>(null)
  const captureTimerRef = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => { onArtifactsChange(artifacts) }, [artifacts, onArtifactsChange])

  useEffect(() => () => {
    recognitionRef.current?.stop?.()
    if (captureTimerRef.current) clearInterval(captureTimerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioContextRef.current?.close().catch(()=>{})
    if (acousticTimerRef.current) clearInterval(acousticTimerRef.current)
  }, [])

  async function startAcousticMonitor() {
    if (!navigator.mediaDevices?.getUserMedia || audioContextRef.current) return
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}})
    micStreamRef.current=stream
    const AudioContextCtor=window.AudioContext || (window as any).webkitAudioContext
    if(!AudioContextCtor)return
    const context=new AudioContextCtor()
    const analyser=context.createAnalyser()
    analyser.fftSize=2048
    context.createMediaStreamSource(stream).connect(analyser)
    audioContextRef.current=context
    analyserRef.current=analyser
    acousticSamplesRef.current=[]
    acousticTimerRef.current=setInterval(()=>{
      const a=analyserRef.current,c=audioContextRef.current
      if(!a||!c)return
      const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data)
      let sum=0;for(const v of data)sum+=v*v
      const rms=Math.sqrt(sum/data.length)
      const pitch=estimatePitchHz(data,c.sampleRate)
      const now=Date.now()
      acousticSamplesRef.current.push({at:now,rms,...(pitch?{pitch}:{})})
      const cutoff=now-12000
      while(acousticSamplesRef.current[0]?.at<cutoff)acousticSamplesRef.current.shift()
    },100)
  }

  function summarizeAcoustics(transcript:string):JhadinaConversationSignals|undefined{
    const samples=acousticSamplesRef.current
    if(!samples.length)return undefined
    const now=Date.now(),start=samples[0]!.at,duration=Math.max(1,now-start)
    const rms=samples.map(x=>x.rms),mean=rms.reduce((a,b)=>a+b,0)/rms.length,peak=Math.max(...rms)
    const variance=rms.reduce((sum,v)=>sum+((v-mean)**2),0)/rms.length
    const pauseRatio=rms.filter(v=>v<Math.max(.008,mean*.35)).length/rms.length
    const pitches=samples.map(x=>x.pitch).filter((v):v is number=>typeof v==="number"&&Number.isFinite(v))
    const pitchMean=pitches.length?pitches.reduce((a,b)=>a+b,0)/pitches.length:undefined
    const pitchVariance=pitches.length&&pitchMean!==undefined?pitches.reduce((sum,v)=>sum+((v-pitchMean)**2),0)/pitches.length:undefined
    const words=transcript.trim().split(/\s+/).filter(Boolean).length
    return{source:"live-microphone",observedAt:new Date().toISOString(),language,utteranceDurationMs:duration,speakingRateWpm:words/(duration/60000),pauseRatio,rmsMean:mean,rmsPeak:peak,energyVariance:variance,...(pitchMean?{pitchMeanHz:pitchMean}:{}),...(pitchVariance!==undefined?{pitchVariance}: {})}
  }

  function stopAcousticMonitor(){
    if(acousticTimerRef.current)clearInterval(acousticTimerRef.current)
    acousticTimerRef.current=null;analyserRef.current=null
    micStreamRef.current?.getTracks().forEach(track=>track.stop());micStreamRef.current=null
    audioContextRef.current?.close().catch(()=>{});audioContextRef.current=null
    acousticSamplesRef.current=[]
  }

  function stopWake() {
    shouldWakeRef.current = false
    recognitionRef.current?.stop?.()
    recognitionRef.current = null
    setWakeEnabled(false)
    setVoiceState("off")
    stopAcousticMonitor()
  }

  function startWake() {
    if (busy) return
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) {
      setVoiceState("unsupported")
      onStatus?.("This browser does not expose continuous speech recognition. You can still type, share your screen, and attach files.")
      return
    }
    stopWake()
    void startAcousticMonitor().catch(()=>onStatus?.("Wake word is active, but acoustic nuance analysis could not access the microphone."))
    const recognition = new Recognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    shouldWakeRef.current = true
    recognition.onstart = () => { setWakeEnabled(true); setVoiceState("listening") }
    recognition.onerror = () => setVoiceState("error")
    recognition.onend = () => {
      if (recognitionRef.current === recognition && shouldWakeRef.current) {
        try { recognition.start() } catch {}
      }
    }
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (!event.results[i]?.isFinal) continue
        const transcript = String(event.results[i][0]?.transcript ?? "").trim()
        const match = transcript.match(/(?:^|\s)(?:hey\s+)?jhadina[,.!]?\s*(.*)$/i)
        if (!match) continue
        const command = (match[1] ?? "").trim()
        if (!command) {
          onStatus?.("Jhadina is listening.")
          continue
        }
        onStatus?.(`Heard: ${command}`)
        onVoiceCommand(command, summarizeAcoustics(command))
      }
    }
    recognitionRef.current = recognition
    try { recognition.start() } catch { setVoiceState("error") }
  }

  useEffect(() => {
    onLanguageChange?.(language)
    if (!wakeEnabled || !recognitionRef.current) return
    const recognition = recognitionRef.current
    recognition.lang = language
  }, [language, wakeEnabled])

  async function startScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      onStatus?.("Screen sharing is not available in this browser.")
      return
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false })
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    }
    setScreenActive(true)
    const end = () => stopScreenShare()
    stream.getVideoTracks()[0]?.addEventListener("ended", end, { once: true })
    await captureScreen()
    if (captureTimerRef.current) clearInterval(captureTimerRef.current)
    captureTimerRef.current = setInterval(() => { void captureScreen() }, 3000)
    onStatus?.("Screen awareness is active. Jhadina receives a refreshed still frame about every 3 seconds while sharing.")
  }

  function stopScreenShare() {
    if (captureTimerRef.current) clearInterval(captureTimerRef.current)
    captureTimerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScreenActive(false)
    setArtifacts((current) => current.filter((artifact) => artifact.kind !== "screen"))
    onStatus?.("Screen awareness stopped.")
  }

  async function captureScreen() {
    const video = videoRef.current
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
    const maxWidth = 1280
    const scale = Math.min(1, maxWidth / video.videoWidth)
    const width = Math.max(1, Math.round(video.videoWidth * scale))
    const height = Math.max(1, Math.round(video.videoHeight * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height)
    const dataUrl = canvas.toDataURL("image/jpeg", 0.78)
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
    const artifact: JhadinaEphemeralArtifact = {
      id: "screen:current",
      kind: "screen",
      mimeType: "image/jpeg",
      source: "screen-share",
      name: "Current shared screen",
      observedAt: new Date().toISOString(),
      base64,
    }
    setArtifacts((current) => [artifact, ...current.filter((item) => item.kind !== "screen")].slice(0, 4))
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const next: JhadinaEphemeralArtifact[] = []
    for (const file of Array.from(files).slice(0, 4)) {
      const id = `file:${crypto.randomUUID()}`
      const observedAt = new Date().toISOString()
      if (file.type.startsWith("image/")) {
        if (file.size > 4_000_000) { onStatus?.(`${file.name} is larger than the 4 MB ephemeral image limit.`); continue }
        const dataUrl = await readAsDataUrl(file)
        next.push({ id, kind:"image", mimeType:file.type || "image/jpeg", source:"file-picker", name:file.name, observedAt, base64:dataUrl.slice(dataUrl.indexOf(",")+1) })
        continue
      }
      const textLike = file.type.startsWith("text/") || file.type === "application/json" || /\.(txt|md|json|csv)$/i.test(file.name)
      if (textLike) {
        const text = (await file.text()).slice(0, 20_000)
        next.push({ id, kind:"text", mimeType:file.type || "text/plain", source:"file-picker", name:file.name, observedAt, text })
        continue
      }
      onStatus?.(`${file.name} is not yet supported in this direct Ask lane. Video/audio continue through Director while the universal artifact pipeline is completed.`)
    }
    if (next.length) setArtifacts((current) => [...current.filter((item) => item.kind === "screen"), ...next].slice(0, 4))
  }

  return <div style={{marginTop:12}}>
    <video ref={videoRef} muted playsInline style={{display:"none"}} />
    <div className="jh-row">
      <button type="button" className="jh-button" disabled={busy} onClick={wakeEnabled?stopWake:startWake}>
        {wakeEnabled ? "Stop wake word" : "Wake: Jhadina"}
      </button>
      <select className="jh-input" value={language} onChange={(event)=>setLanguage(event.target.value)} aria-label="Voice language" style={{maxWidth:180}}>
        {LANGUAGES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select>
      <button type="button" className="jh-button" disabled={busy} onClick={()=>void (screenActive?Promise.resolve(stopScreenShare()):startScreenShare())}>
        {screenActive ? "Stop screen" : "Share screen"}
      </button>
      <label className="jh-button" style={{cursor:"pointer"}}>
        Attach
        <input type="file" multiple accept="image/*,.txt,.md,.json,.csv,text/plain,application/json" style={{display:"none"}} onChange={(event)=>void addFiles(event.target.files)} />
      </label>
    </div>
    <p className="jh-meta" style={{marginTop:8}}>
      Wake {voiceState==="listening"?"listening":voiceState==="unsupported"?"unsupported in this browser":voiceState==="error"?"needs microphone permission":"off"} · screen {screenActive?"live":"off"} · {artifacts.length} ephemeral artifact{artifacts.length===1?"":"s"}
    </p>
    {artifacts.length?<div className="jh-row" style={{marginTop:8}}>
      {artifacts.map((artifact)=><span key={artifact.id} className="jh-status"><span className="jh-dot"/>{artifact.kind==="screen"?"Screen":artifact.name??artifact.kind}</span>)}
      <button type="button" className="jh-button" onClick={()=>setArtifacts((current)=>current.filter((item)=>item.kind==="screen"))}>Clear files</button>
    </div>:null}
  </div>
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}


function estimatePitchHz(buffer:Float32Array,sampleRate:number):number|undefined{
  let rms=0;for(const v of buffer)rms+=v*v;rms=Math.sqrt(rms/buffer.length)
  if(rms<0.01)return undefined
  const minLag=Math.floor(sampleRate/500),maxLag=Math.min(buffer.length-1,Math.floor(sampleRate/70))
  let bestLag=0,best=0
  for(let lag=minLag;lag<=maxLag;lag++){
    let corr=0,normA=0,normB=0
    for(let i=0;i<buffer.length-lag;i++){const a=buffer[i]!,b=buffer[i+lag]!;corr+=a*b;normA+=a*a;normB+=b*b}
    const score=corr/Math.sqrt((normA*normB)||1)
    if(score>best){best=score;bestLag=lag}
  }
  return best>.55&&bestLag?sampleRate/bestLag:undefined
}

"use client"

import { useEffect, useRef, useState } from "react"
import { getCurrentUserId } from "@/lib/auth/current-user"

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

type DurableArtifactDisplay = { id:string; name:string; mimeType:string; sizeBytes:number; status:"quarantine"|"clean"|"rejected"|"needs_review"; contextReady:boolean; extractionStatus:"not_required"|"pending"|"ready"|"unsupported" }

type Props = {
  busy: boolean
  onArtifactsChange: (artifacts: JhadinaEphemeralArtifact[]) => void
  onVoiceCommand: (command: string, signals?: JhadinaConversationSignals) => void
  onBargeIn?: () => void
  onArtifactRefsChange?: (artifactRefs: string[]) => void
  onLanguageChange?: (language: string) => void
  onConversationActiveChange?: (active: boolean) => void
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

export function JhadinaLiveInput({ busy, onArtifactsChange, onVoiceCommand, onBargeIn, onArtifactRefsChange, onLanguageChange, onConversationActiveChange, onStatus }: Props) {
  const [wakeEnabled, setWakeEnabled] = useState(false)
  const [conversationActive, setConversationActive] = useState(false)
  const [language, setLanguage] = useState("en-US")
  const [voiceState, setVoiceState] = useState<"off"|"listening"|"unsupported"|"error">("off")
  const [screenActive, setScreenActive] = useState(false)
  const [artifacts, setArtifacts] = useState<JhadinaEphemeralArtifact[]>([])
  const [durableArtifacts, setDurableArtifacts] = useState<DurableArtifactDisplay[]>([])
  const [uploading, setUploading] = useState(false)
  const [retryingId, setRetryingId] = useState<string|null>(null)
  const [nativeRecording,setNativeRecording]=useState(false)
  const recognitionRef = useRef<any>(null)
  const shouldWakeRef = useRef(false)
  const conversationActiveRef = useRef(false)
  const streamRef = useRef<MediaStream|null>(null)
  const micStreamRef = useRef<MediaStream|null>(null)
  const audioContextRef = useRef<AudioContext|null>(null)
  const analyserRef = useRef<AnalyserNode|null>(null)
  const acousticTimerRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const acousticSamplesRef = useRef<Array<{at:number;rms:number;pitch?:number}>>([])
  const videoRef = useRef<HTMLVideoElement|null>(null)
  const captureTimerRef = useRef<ReturnType<typeof setInterval>|null>(null)
  const nativeRecorderRef=useRef<MediaRecorder|null>(null)
  const nativeStreamRef=useRef<MediaStream|null>(null)
  const nativeChunksRef=useRef<Blob[]>([])

  useEffect(() => { onArtifactsChange(artifacts) }, [artifacts, onArtifactsChange])
  useEffect(() => { onArtifactRefsChange?.(durableArtifacts.filter((artifact)=>artifact.status==="clean"&&artifact.contextReady).map((artifact)=>artifact.id)) }, [durableArtifacts, onArtifactRefsChange])
  useEffect(() => {
    conversationActiveRef.current=conversationActive
    onConversationActiveChange?.(conversationActive)
  }, [conversationActive, onConversationActiveChange])

  useEffect(() => () => {
    recognitionRef.current?.stop?.()
    if (captureTimerRef.current) clearInterval(captureTimerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioContextRef.current?.close().catch(()=>{})
    if (acousticTimerRef.current) clearInterval(acousticTimerRef.current)
    nativeRecorderRef.current?.stop?.()
    nativeStreamRef.current?.getTracks().forEach((track)=>track.stop())
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
    setConversationActive(false)
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
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    shouldWakeRef.current = true
    recognition.onstart = () => { setWakeEnabled(true); setVoiceState("listening") }
    recognition.onerror = () => setVoiceState("error")
    recognition.onspeechstart = () => onBargeIn?.()
    recognition.onend = () => {
      if (recognitionRef.current === recognition && shouldWakeRef.current) {
        try { recognition.start() } catch {}
      }
    }
    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = String(event.results[i][0]?.transcript ?? "").trim()
        if (!transcript) continue
        const wakeMatch = transcript.match(/(?:^|\s)(?:hey\s+)?jhadina[,.!]?\s*(.*)$/i)

        if (!event.results[i]?.isFinal) {
          if (wakeMatch || conversationActiveRef.current) {
            onStatus?.(`Listening: ${wakeMatch ? (wakeMatch[1] ?? "").trim() || "…" : transcript}`)
          }
          continue
        }

        if (conversationActiveRef.current && /^(?:(?:hey\s+)?jhadina[,.!]?\s*)?(?:stop listening|go to sleep|goodbye|that's all)[.!]?$/i.test(transcript)) {
          setConversationActive(false)
          onStatus?.("Conversation paused. Say “Jhadina” to wake me again.")
          continue
        }

        let command=""
        if (wakeMatch) {
          setConversationActive(true)
          command=(wakeMatch[1] ?? "").trim()
          if (!command) {
            onStatus?.("I’m listening. You can keep talking without repeating my name.")
            continue
          }
        } else if (conversationActiveRef.current) {
          command=transcript
        } else {
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

  async function toggleNativeRecording(){
    if(nativeRecording){
      nativeRecorderRef.current?.stop()
      return
    }
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){
      onStatus?.("Native microphone capture is unavailable in this browser.")
      return
    }
    const userId=await getCurrentUserId()
    if(!userId){onStatus?.("Sign in before using native voice.");return}
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}})
    nativeStreamRef.current=stream
    const candidates=["audio/webm;codecs=opus","audio/mp4","audio/webm"]
    const mime=candidates.find(value=>MediaRecorder.isTypeSupported(value))??""
    const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)
    nativeRecorderRef.current=recorder
    nativeChunksRef.current=[]
    recorder.ondataavailable=(event)=>{if(event.data.size)nativeChunksRef.current.push(event.data)}
    recorder.onstart=()=>{setNativeRecording(true);setConversationActive(true);onBargeIn?.();onStatus?.("Native Whisper microphone recording… tap again to transcribe.")}
    recorder.onstop=()=>{
      void (async()=>{
        setNativeRecording(false)
        stream.getTracks().forEach(track=>track.stop())
        nativeStreamRef.current=null
        const blob=new Blob(nativeChunksRef.current,{type:recorder.mimeType||nativeChunksRef.current[0]?.type||"audio/webm"})
        nativeChunksRef.current=[]
        if(!blob.size)return
        const base64=await blobToBase64(blob)
        const mimeType=(blob.type||"audio/webm").split(";")[0]!
        const response=await fetch("/api/jhadina/voice/listen",{
          method:"POST",
          headers:{"content-type":"application/json","x-jhadina-user-id":userId},
          body:JSON.stringify({mimeType,audioBase64:base64,languageHint:language}),
        })
        const json=await response.json()
        if(!response.ok){onStatus?.(json.detail??json.error??"Native transcription failed.");return}
        const transcript=String(json.text??"").trim()
        if(!transcript){onStatus?.("Native Whisper returned no speech.");return}
        onStatus?.(`Native Whisper heard: ${transcript}`)
        onVoiceCommand(transcript,{source:"live-microphone",observedAt:new Date().toISOString(),language:String(json.language??language)})
      })().catch(cause=>onStatus?.(cause instanceof Error?cause.message:"Native transcription failed."))
    }
    recorder.start()
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length || uploading) return
    const userId=await getCurrentUserId()
    if(!userId){onStatus?.("Sign in before attaching durable files.");return}
    setUploading(true)
    try{
      for(const file of Array.from(files).slice(0,4)){
        onStatus?.(`Uploading ${file.name} to Jhadina's private quarantine…`)
        const form=new FormData();form.append("file",file)
        const response=await fetch("/api/jhadina/artifacts",{method:"POST",headers:{"x-jhadina-user-id":userId},body:form})
        const json=await response.json()
        if(!response.ok){onStatus?.(`${file.name}: ${json.error??"upload failed"}`);continue}
        const artifact=json.artifact as DurableArtifactDisplay
        setDurableArtifacts(current=>[...current.filter(item=>item.id!==artifact.id),artifact].slice(-4))
        onStatus?.(artifact.status==="clean"?(artifact.contextReady?`${file.name} passed scanning${artifact.extractionStatus==="ready"?" and extraction":""} and is ready for Jhadina.`:`${file.name} passed scanning; extraction is still pending before Jhadina can reason over it.`):`${file.name} is ${artifact.status}; it will not enter Jhadina\'s reasoning context.`)
      }
    }finally{setUploading(false)}
  }

  async function retryExtraction(artifact:DurableArtifactDisplay){
    if(retryingId)return
    const userId=await getCurrentUserId()
    if(!userId){onStatus?.("Sign in before retrying extraction.");return}
    setRetryingId(artifact.id)
    onStatus?.(`Retrying extraction for ${artifact.name}…`)
    try{
      const response=await fetch(`/api/jhadina/artifacts/${encodeURIComponent(artifact.id)}`,{
        method:"POST",
        headers:{"x-jhadina-user-id":userId},
      })
      const json=await response.json()
      if(!response.ok){onStatus?.(`${artifact.name}: ${json.error??"extraction retry failed"}`);return}
      const updated=json.artifact as DurableArtifactDisplay
      setDurableArtifacts(current=>current.map(item=>item.id===updated.id?updated:item))
      onStatus?.(updated.contextReady?`${artifact.name} extraction completed and is ready for Jhadina.`:`${artifact.name} is still not context-ready.`)
    }finally{setRetryingId(null)}
  }

  return <div style={{marginTop:12}}>
    <video ref={videoRef} muted playsInline style={{display:"none"}} />
    <div className="jh-row">
      <button type="button" className="jh-button" disabled={!wakeEnabled&&busy} onClick={wakeEnabled?stopWake:startWake}>
        {wakeEnabled ? (conversationActive ? "Pause conversation" : "Stop wake word") : "Wake: Jhadina"}
      </button>
      <select className="jh-input" value={language} onChange={(event)=>setLanguage(event.target.value)} aria-label="Voice language" style={{maxWidth:180}}>
        {LANGUAGES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select>
      <button type="button" className="jh-button" onClick={()=>void toggleNativeRecording()}>
        {nativeRecording?"Stop native mic":"Native mic"}
      </button>
      <button type="button" className="jh-button" disabled={busy} onClick={()=>void (screenActive?Promise.resolve(stopScreenShare()):startScreenShare())}>
        {screenActive ? "Stop screen" : "Share screen"}
      </button>
      <label className="jh-button" style={{cursor:"pointer"}}>
        Attach
        <input type="file" multiple disabled={busy||uploading} accept="image/png,image/jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/json,audio/wav,audio/mpeg,audio/mp4,audio/webm,video/mp4,video/webm,.png,.jpg,.jpeg,.pdf,.docx,.xlsx,.txt,.csv,.json,.wav,.mp3,.m4a,.webm,.mp4" style={{display:"none"}} onChange={(event)=>void addFiles(event.target.files)} />
      </label>
    </div>
    <p className="jh-meta" style={{marginTop:8}}>
      Wake {voiceState==="listening"?"listening":voiceState==="unsupported"?"unsupported in this browser":voiceState==="error"?"needs microphone permission":"off"} · conversation {conversationActive?"active":"waiting for “Jhadina”"} · screen {screenActive?"live":"off"} · {durableArtifacts.filter(a=>a.status==="clean"&&a.contextReady).length} ready file{durableArtifacts.filter(a=>a.status==="clean"&&a.contextReady).length===1?"":"s"}
    </p>
    {(artifacts.length||durableArtifacts.length)?<div className="jh-row" style={{marginTop:8}}>
      {artifacts.map((artifact)=><span key={artifact.id} className="jh-status"><span className="jh-dot"/>{artifact.kind==="screen"?"Screen":artifact.name??artifact.kind}</span>)}
      {durableArtifacts.map((artifact)=><span key={artifact.id} className={artifact.status==="clean"?"jh-status jh-status--success":"jh-status jh-status--warning"}><span className="jh-dot"/>{artifact.name} · {artifact.status==="clean"?(artifact.contextReady?(artifact.extractionStatus==="ready"?"clean · extracted":"clean · ready"):"clean · extraction pending"):artifact.status}{artifact.status==="clean"&&!artifact.contextReady&&artifact.extractionStatus==="pending"?<button type="button" className="jh-button" disabled={retryingId===artifact.id} onClick={()=>void retryExtraction(artifact)}>{retryingId===artifact.id?"Retrying…":"Retry extraction"}</button>:null}</span>)}
      {durableArtifacts.length?<button type="button" className="jh-button" onClick={()=>setDurableArtifacts([])}>Clear files</button>:null}
    </div>:null}
  </div>
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


async function blobToBase64(blob:Blob):Promise<string>{
 return await new Promise((resolve,reject)=>{
  const reader=new FileReader()
  reader.onerror=()=>reject(reader.error??new Error("VOICE_FILE_READ_FAILED"))
  reader.onload=()=>{
   const value=String(reader.result??"")
   const comma=value.indexOf(",")
   if(comma<0)return reject(new Error("VOICE_FILE_READ_FAILED"))
   resolve(value.slice(comma+1))
  }
  reader.readAsDataURL(blob)
 })
}

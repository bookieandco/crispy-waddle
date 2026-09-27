"use client"

import Link from "next/link"
import { useEffect,useState } from "react"
import styles from "./JhadinaShellNavigation.module.css"

type NativeVpnState={status:"disconnected"|"connecting"|"connected"|"error";profileId?:string|null;location?:string|null;lastError?:string|null}
type NativeVpnBridge={connect:(profileId:string)=>Promise<void>;disconnect:()=>Promise<void>;getState:()=>Promise<NativeVpnState>}

declare global{interface Window{jhadinaVpn?:NativeVpnBridge}}

export function VpnShellControl(){
 const [available,setAvailable]=useState(false)
 const [state,setState]=useState<NativeVpnState>({status:"disconnected"})
 useEffect(()=>{
  const bridge=window.jhadinaVpn
  if(!bridge)return
  setAvailable(true)
  void bridge.getState().then(setState).catch(()=>setState({status:"error"}))
 },[])
 async function toggle(){
  const bridge=window.jhadinaVpn
  if(!bridge)return
  setState(current=>({...current,status:"connecting"}))
  try{
   if(state.status==="connected")await bridge.disconnect()
   else await bridge.connect(state.profileId??"default")
   setState(await bridge.getState())
  }catch(cause){setState({status:"error",lastError:cause instanceof Error?cause.message:"VPN control failed"})}
 }
 if(!available)return <Link href="/settings/privacy" className={styles.vpnSetup} aria-label="Open VPN settings">VPN</Link>
 const connected=state.status==="connected"
 return <button type="button" onClick={()=>void toggle()} disabled={state.status==="connecting"} className={[styles.vpnToggle,connected?styles.vpnOn:styles.vpnOff].join(" ")} aria-pressed={connected}>
  <span aria-hidden="true">◈</span><span>{state.status==="connecting"?"VPN…":connected?"VPN ON":"VPN OFF"}</span>
 </button>
}

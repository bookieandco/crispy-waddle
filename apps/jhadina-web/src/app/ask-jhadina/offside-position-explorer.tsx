"use client"

import { useState } from "react"
import { assessOffsidePosition } from "@/lib/intelligence/offside-position-exercise"

/** Explicit, bounded educational exercise; no model-generated executable logic. */
export function OffsidePositionExplorer(){
  const [attacker,setAttacker]=useState(76)
  const [defender,setDefender]=useState(69)
  const [ball,setBall]=useState(62)
  const verdict=assessOffsidePosition({attacker,secondLastDefender:defender,ball})
  const x=(position:number)=>18+position*3.15
  const description=verdict.reason==="OWN_HALF"?"The attacker is on or behind the halfway line."
    :verdict.reason==="LEVEL_OR_BEHIND_BALL"?"The attacker is level with or behind the ball."
    :verdict.reason==="LEVEL_OR_BEHIND_DEFENDER"?"The attacker is level with or behind the second-last defender."
    :"The attacker is beyond both the ball and the second-last opponent in the attacking half."
  const tracks=[
    {label:"Receiving attacker",value:attacker,set:setAttacker,color:"#4c88ed"},
    {label:"Second-last opponent",value:defender,set:setDefender,color:"#fa9d55"},
    {label:"Ball at pass",value:ball,set:setBall,color:"#e7ca65"},
  ]

  return <section className="jh-section" aria-label="Interactive offside position experiment" style={{marginTop:18}}>
    <div className="jh-item">
      <h3 className="jh-card-title">Move the players at the instant of the pass</h3>
      <p className="jh-card-copy">Drag any slider. The blue attacker moves toward the opponent's goal as the position increases. This simplified exercise uses point positions and assumes the ball is played by a teammate.</p>
      <svg viewBox="0 0 354 181" width="100%" role="img" aria-label={"Field position diagram. "+description} style={{display:"block",marginTop:12,borderRadius:10,background:"#246b48"}}>
        <rect x="18" y="15" width="315" height="150" fill="none" stroke="#d9ead6" strokeWidth="1.5"/>
        <line x1={x(50)} x2={x(50)} y1="15" y2="165" stroke="#d9ead6" strokeDasharray="4 4"/>
        <line x1={x(defender)} x2={x(defender)} y1="15" y2="165" stroke="#ffc59b" strokeWidth="1.5" strokeDasharray="5 4"/>
        <line x1={x(Math.max(ball,defender))} x2={x(Math.max(ball,defender))} y1="15" y2="165" stroke="#e4dd9b" strokeWidth="1" strokeDasharray="2 4" opacity=".7"/>
        <g fill="#f9fffc" fontSize="10">
          <text x="23" y="29">Own goal</text>
          <text x="252" y="29">Opposing goal →</text>
          <text x={x(50)} y="175" textAnchor="middle">Halfway</text>
        </g>
        <circle cx={x(attacker)} cy="52" r="9" fill="#4c88ed" stroke="#fff" strokeWidth="1.5"/>
        <circle cx={x(defender)} cy="98" r="9" fill="#fa9d55" stroke="#fff" strokeWidth="1.5"/>
        <circle cx={x(ball)} cy="139" r="7" fill="#e7ca65" stroke="#fff" strokeWidth="1.5"/>
        <g fontSize="10" fill="#fff" textAnchor="middle" fontWeight="bold">
          <text x={x(attacker)} y="43">A</text>
          <text x={x(defender)} y="89">D</text>
          <text x={x(ball)} y="128">B</text>
        </g>
      </svg>
      <div className="jh-list" style={{marginTop:12}}>
        {tracks.map(track=><label key={track.label} className="jh-item" style={{display:"block"}}>
          <span className="jh-between"><strong>{track.label}</strong><span>{track.value}/100</span></span>
          <input type="range" min={0} max={100} step={1} value={track.value} onChange={event=>track.set(Number(event.target.value))} aria-label={track.label+" field position"} style={{display:"block",width:"100%",accentColor:track.color,marginTop:8,minHeight:35}}/>
        </label>)}
      </div>
      <p role="status" aria-live="polite" style={{fontWeight:700,marginTop:14}}>{verdict.offsidePosition?"Offside position":"Not in an offside position"}</p>
      <p className="jh-card-copy">{description}</p>
      <p className="jh-meta">Position ≠ offence. Real decisions also depend on active involvement, relevant body parts, the moment of a teammate's touch and applicable exceptions. This diagram models none of those additional conditions.</p>
      <div className="jh-row" style={{marginTop:10}}>
        <button type="button" className="jh-button" onClick={()=>{setAttacker(76);setDefender(69);setBall(62)}}>Reset example</button>
        <a className="jh-button" href="https://www.theifab.com/laws/latest/offside/" target="_blank" rel="noopener noreferrer">IFAB Law 11</a>
      </div>
    </div>
  </section>
}

"use client"

export type SportsHistoryRecordForUi={
 recordId:string
 entityLabel:string
 season:string
 eventId:string
 eventDate:string
 opponentLabel?:string
 venue:"HOME"|"AWAY"|"NEUTRAL"|"UNKNOWN"
 phase:string
 statKey:string
 statLabel:string
 value:number
 sourceProvider:string
}

export type SportsHistorySeasonSummaryForUi={
 season:string
 sampleSize:number
 sum:number
 mean:number
}

export type SportsHistorySummaryForUi={
 statKey:string
 statLabel:string
 sampleSize:number
 firstEventDate:string
 lastEventDate:string
 sum:number
 mean:number
 stdDev:number
 min:number
 p10:number
 p25:number
 p50:number
 p75:number
 p90:number
 max:number
 hitRatesByThreshold:Record<string,number>
 seasons:readonly SportsHistorySeasonSummaryForUi[]
}

export type SportsHistoryViewForUi={
 viewId:string
 records:readonly SportsHistoryRecordForUi[]
 summaries:readonly SportsHistorySummaryForUi[]
 allTimeAvailable:boolean
 coverage:{
  firstEventDate:string|null
  lastEventDate:string|null
  seasons:readonly string[]
  competitions:readonly string[]
  sourceProviders:readonly string[]
  totalRecords:number
 }
 warnings:readonly string[]
 authority:"HISTORICAL_EVIDENCE_ONLY"
 predictiveAuthority:"NONE"
 bettingAuthority:"NONE"
 financialAuthority:"NONE"
 canExecute:false
}

function formatNumber(value:number){
 if(!Number.isFinite(value))return "—"
 const absolute=Math.abs(value)
 return absolute>=1000
  ? value.toLocaleString(undefined,{maximumFractionDigits:1})
  : value.toLocaleString(undefined,{maximumFractionDigits:2})
}

export function SportsHistoryCard({view}:{view:SportsHistoryViewForUi}){
 const entity=view.records[0]?.entityLabel??"Sports history"
 const recent=[...view.records]
  .sort((a,b)=>Date.parse(b.eventDate)-Date.parse(a.eventDate)||a.statKey.localeCompare(b.statKey))
  .slice(0,16)
 const coverageLabel=view.coverage.firstEventDate&&view.coverage.lastEventDate
  ? new Date(view.coverage.firstEventDate).toLocaleDateString()+" → "+new Date(view.coverage.lastEventDate).toLocaleDateString()
  : "No dated event coverage"

 return <div className="jh-section" style={{marginTop:20}}>
  <div className="jh-item">
   <div className="jh-between" style={{gap:16,alignItems:"flex-start"}}>
    <div>
     <p className="jh-eyebrow">Sports history · read only</p>
     <h2 className="jh-card-title">{entity}</h2>
     <p className="jh-card-copy">Career and historical evidence stays separate from SPORT-SIM until a calibrated feature-admission step explicitly accepts a slice.</p>
    </div>
    <span className={view.allTimeAvailable?"jh-status jh-status--success":"jh-status jh-status--warning"}>
     <span className="jh-dot"/>
     {view.allTimeAvailable?"all-time coverage certified":"partial coverage"}
    </span>
   </div>

   <div className="jh-row" style={{marginTop:12}}>
    <span className="jh-status"><span className="jh-dot"/>{view.coverage.seasons.length} seasons</span>
    <span className="jh-status"><span className="jh-dot"/>{view.coverage.totalRecords.toLocaleString()} stat records</span>
    <span className="jh-status"><span className="jh-dot"/>{view.authority}</span>
   </div>
   <p className="jh-meta" style={{marginTop:10}}>
    {coverageLabel}
    {view.coverage.competitions.length?" · "+view.coverage.competitions.join(" · "):""}
   </p>
   {view.coverage.sourceProviders.length?<p className="jh-meta">Sources: {view.coverage.sourceProviders.join(" · ")}</p>:null}

   {view.summaries.length?<div style={{marginTop:18}}>
    <strong>Historical stat distributions</strong>
    <div className="jh-list" style={{marginTop:8}}>
     {view.summaries.slice(0,12).map(summary=><details className="jh-item" key={summary.statKey}>
      <summary style={{cursor:"pointer"}}>
       <strong>{summary.statLabel}</strong>
       <span className="jh-meta"> · n={summary.sampleSize.toLocaleString()} · avg {formatNumber(summary.mean)} · median {formatNumber(summary.p50)} · P10–P90 {formatNumber(summary.p10)}–{formatNumber(summary.p90)}</span>
      </summary>
      <p className="jh-meta" style={{marginTop:8}}>Range {formatNumber(summary.min)}–{formatNumber(summary.max)} · SD {formatNumber(summary.stdDev)} · {summary.statKey}</p>
      {summary.seasons.length?<div style={{overflowX:"auto",marginTop:8}}>
       <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>
         <th style={{textAlign:"left",padding:"6px 8px"}}>Season</th>
         <th style={{textAlign:"right",padding:"6px 8px"}}>Games / samples</th>
         <th style={{textAlign:"right",padding:"6px 8px"}}>Average</th>
         <th style={{textAlign:"right",padding:"6px 8px"}}>Total</th>
        </tr></thead>
        <tbody>{summary.seasons.map(season=><tr key={season.season}>
         <td style={{padding:"6px 8px"}}>{season.season}</td>
         <td style={{textAlign:"right",padding:"6px 8px"}}>{season.sampleSize.toLocaleString()}</td>
         <td style={{textAlign:"right",padding:"6px 8px"}}>{formatNumber(season.mean)}</td>
         <td style={{textAlign:"right",padding:"6px 8px"}}>{formatNumber(season.sum)}</td>
        </tr>)}</tbody>
       </table>
      </div>:null}
     </details>)}
    </div>
    {view.summaries.length>12?<p className="jh-meta" style={{marginTop:8}}>Showing 12 of {view.summaries.length} stat series in this compact view.</p>:null}
   </div>:null}

   {recent.length?<details style={{marginTop:18}}>
    <summary style={{cursor:"pointer"}}><strong>Recent records from this historical query</strong></summary>
    <div style={{overflowX:"auto",marginTop:8}}>
     <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
      <thead><tr>
       <th style={{textAlign:"left",padding:"6px 8px"}}>Date</th>
       <th style={{textAlign:"left",padding:"6px 8px"}}>Season</th>
       <th style={{textAlign:"left",padding:"6px 8px"}}>Opponent</th>
       <th style={{textAlign:"left",padding:"6px 8px"}}>Stat</th>
       <th style={{textAlign:"right",padding:"6px 8px"}}>Value</th>
      </tr></thead>
      <tbody>{recent.map(record=><tr key={record.recordId}>
       <td style={{padding:"6px 8px"}}>{new Date(record.eventDate).toLocaleDateString()}</td>
       <td style={{padding:"6px 8px"}}>{record.season}</td>
       <td style={{padding:"6px 8px"}}>{record.opponentLabel??"—"}</td>
       <td style={{padding:"6px 8px"}}>{record.statLabel}</td>
       <td style={{textAlign:"right",padding:"6px 8px"}}>{formatNumber(record.value)}</td>
      </tr>)}</tbody>
     </table>
    </div>
   </details>:null}

   <p className="jh-meta" style={{marginTop:14}}>Prediction authority {view.predictiveAuthority} · betting authority {view.bettingAuthority} · financial authority {view.financialAuthority} · execution {view.canExecute?"enabled":"disabled"}</p>
  </div>
 </div>
}

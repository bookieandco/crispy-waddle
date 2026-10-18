"use client"

import { useState } from "react"
import { parseVisualResponse, type VisualResponse } from "@/lib/intelligence/visual-response"
import { CommonsPhotoExplorer } from "./commons-photo-explorer"
import { OffsidePositionExplorer } from "./offside-position-explorer"

/**
 * Only known, typed React components render visual plans.
 * There is no dangerouslySetInnerHTML, iframe, dynamic code, remote URL,
 * network request, hidden form submission or capability execution here.
 */
export function VisualResponseCard({ raw }: { raw: unknown }) {
  const view = parseVisualResponse(raw)
  if (!view) return null
  return <VisualView key={view.title + view.kind + view.items.map(item => item.id + item.label).join(":")} view={view}/>
}

function VisualView({ view }: { view: VisualResponse }) {
  const [current, setCurrent] = useState(0)
  const [checked, setChecked] = useState<string[]>([])
  const [tableMode, setTableMode] = useState(false)

  const length = view.items.length
  const focused = view.items[Math.min(current, length - 1)]
  const completed = checked.length
  const max = view.kind === "bars" ? Math.max(...view.items.map(item => item.value ?? 0), 1) : 1
  const detail = (item: typeof focused) => item.detail ? <p className="jh-card-copy" style={{marginTop:8}}>{item.detail}</p> : null

  return <section className="jh-section" aria-label={view.title} style={{ marginTop:20 }}>
    <div className="jh-item">
      <div className="jh-between" style={{alignItems:"flex-start",gap:14}}>
        <div>
          <p className="jh-eyebrow">JLLM · Interactive visual response</p>
          <h2 className="jh-card-title">{view.title}</h2>
        </div>
        <span className="jh-meta">Read only</span>
      </div>

      {view.kind === "checklist" ? <>
        <p className="jh-card-copy" aria-live="polite" style={{marginTop:12}}>{completed} of {length} complete</p>
        <div role="progressbar" aria-label="Checklist completion" aria-valuemin={0} aria-valuemax={length} aria-valuenow={completed} style={{height:7,borderRadius:8,background:"var(--jh-border, #788)",overflow:"hidden",margin:"8px 0 14px"}}>
          <div style={{width:String((100 * completed)/length) + "%",height:"100%",background:"var(--jh-accent, #6789ae)"}}/>
        </div>
        <div className="jh-list">
          {view.items.map(item => <label key={item.id} className="jh-item" style={{display:"flex",gap:12,alignItems:"flex-start",cursor:"pointer"}}>
            <input type="checkbox" checked={checked.includes(item.id)} onChange={event => setChecked(old => event.target.checked ? [...old,item.id] : old.filter(id => id !== item.id))} style={{marginTop:4,width:20,height:20}}/>
            <div style={{textDecoration:checked.includes(item.id)?"line-through":"none"}}>
              <strong>{item.label}</strong>{detail(item)}
            </div>
          </label>)}
        </div>
        <button type="button" className="jh-button" onClick={() => setChecked([])} disabled={completed === 0} style={{marginTop:10}}>Reset checklist</button>
      </> : null}

      {view.kind === "diagram" ? <>
        <div style={{display:"flex",gap:6,overflowX:"auto",padding:"16px 2px",alignItems:"stretch"}} aria-label="Sequence of steps">
          {view.items.map((item, index) => <div key={item.id} style={{display:"flex",alignItems:"center",gap:6,flex:"1 0 auto"}}>
            {index > 0 ? <span aria-hidden="true" style={{fontSize:20,opacity:.65}}>→</span> : null}
            <button type="button" className="jh-button" aria-current={current === index ? "step" : undefined} aria-label={"View step " + (index + 1)} onClick={() => setCurrent(index)} style={{minWidth:65,background:current===index?"var(--jh-accent, #6789ae)":undefined,color:current===index?"white":undefined}}>
              {index + 1}
            </button>
          </div>)}
        </div>
        <div className="jh-item" aria-live="polite">
          <p className="jh-eyebrow">Stage {current + 1} / {length}</p>
          <strong>{focused.label}</strong>{detail(focused)}
        </div>
      </> : null}

      {view.kind === "stepper" || view.kind === "gallery" ? <>
        <p className="jh-meta" style={{margin:"12px 0"}}>Card {current + 1} of {length}</p>
        <div className="jh-item" aria-live="polite" style={{minHeight:112}}>
          <p className="jh-eyebrow">{view.kind === "gallery" ? "Evidence source" : "Step " + (current + 1)}</p>
          <strong style={{fontSize:18}}>{focused.label}</strong>{detail(focused)}
        </div>
        <div className="jh-row" style={{marginTop:12,alignItems:"center"}}>
          <button type="button" className="jh-button" disabled={current === 0} onClick={() => setCurrent(index => Math.max(0,index-1))}>Previous</button>
          <button type="button" className="jh-button" disabled={current === length - 1} onClick={() => setCurrent(index => Math.min(length-1,index+1))}>Next</button>
        </div>
      </> : null}

      {view.kind === "bars" ? <>
        <div className="jh-row" style={{margin:"12px 0"}}>
          <button type="button" className="jh-button" aria-pressed={!tableMode} onClick={() => setTableMode(false)}>Bars</button>
          <button type="button" className="jh-button" aria-pressed={tableMode} onClick={() => setTableMode(true)}>Values</button>
        </div>
        {tableMode ? <table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
          <thead><tr><th scope="col">Category</th><th scope="col">Value</th></tr></thead>
          <tbody>{view.items.map(item => <tr key={item.id}><th scope="row" style={{padding:"8px 0"}}>{item.label}</th><td>{item.value?.toLocaleString()} {item.unit}</td></tr>)}</tbody>
        </table> : <div className="jh-list" role="img" aria-label="Bar chart of explicitly sourced values">
          {view.items.map(item => <div key={item.id} style={{margin:"8px 0"}}>
            <div className="jh-between" style={{gap:12}}>
              <span>{item.label}</span><strong>{item.value?.toLocaleString()} {item.unit === "number" ? "" : item.unit}</strong>
            </div>
            <div style={{marginTop:6,width:"100%",height:16,background:"var(--jh-border, #788)",borderRadius:4,overflow:"hidden"}}>
              <div style={{width:String(100 * (item.value ?? 0)/max) + "%",height:"100%",background:"var(--jh-accent, #6789ae)"}}/>
            </div>
          </div>)}
        </div>}
      </> : null}

      {view.kind === "simulation" ? <OffsidePositionExplorer/> : null}
      {view.mediaDiscovery === "OWNER_TRIGGERED_COMMONS" ? <CommonsPhotoExplorer/> : null}
      <p className="jh-meta" role="note" style={{marginTop:14}}>{view.note}</p>
    </div>
  </section>
}

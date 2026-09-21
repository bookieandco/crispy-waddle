import Link from "next/link"

const workspaces=[
 {title:"Director Workstation",copy:"Edit projects, review generated assets and continue creative work.",href:"/workstation",kind:"Create"},
 {title:"Growth",copy:"Review drafts, approvals and schedules before anything publishes.",href:"/growth",kind:"Publish"},
 {title:"Opportunities",copy:"Review ranked opportunities and authorize research without authorizing spend or submission.",href:"/opportunity",kind:"Pursue"},
 {title:"Money Command Center",copy:"Review governed financial awareness and account-read surfaces.",href:"/money/command-center",kind:"Money"},
 {title:"Money Live Operations",copy:"Operational view for explicitly governed live-money execution surfaces.",href:"/money/live-operations",kind:"Operations"},
 {title:"Placement",copy:"Worker opportunity, offer and placement workflows.",href:"/placement/worker/opportunities",kind:"Jobs"},
 {title:"Campaign Polls",copy:"Polling and campaign intelligence surface.",href:"/campaign/polls",kind:"Campaign"},
 {title:"Spatial",copy:"Evidence-backed location and live-world context.",href:"/spatial",kind:"Observe"},
 {title:"Calendar",copy:"Time-aware coordination and scheduling.",href:"/calendar",kind:"Plan"},
]

export default function WorkPage(){
 return <main className="jh-page"><div className="jh-wrap">
  <p className="jh-eyebrow">Work</p>
  <div className="jh-between"><div><h1 className="jh-title">Continue what matters.</h1><p className="jh-copy">Work is the directory for real route-backed execution surfaces. Ask Jhadina can reason across them, but each consequential action remains owned by its subsystem and policy boundary.</p></div><Link className="jh-button" href="/approvals">Approvals</Link></div>
  <div className="jh-grid">
   {workspaces.map(item=><Link key={item.href} href={item.href} className="jh-card jh-card--third">
    <span className="jh-status">{item.kind}</span>
    <h2 className="jh-card-title" style={{marginTop:14}}>{item.title}</h2>
    <p className="jh-card-copy">{item.copy}</p>
   </Link>)}
  </div>
  <section className="jh-section"><div className="jh-card jh-card--wide"><p className="jh-eyebrow">Cross-world intelligence</p><h2 className="jh-section-title">Need Jhadina to connect the dots?</h2><p className="jh-card-copy">Ask can use the governed context builder and route your question through Jhadina’s intelligence path without turning the LLM into execution authority.</p><div className="jh-row" style={{marginTop:16}}><Link className="jh-button jh-button--primary" href="/ask-jhadina?surface=work&route=/work">Ask Jhadina</Link><Link className="jh-button" href="/activity">Open black box</Link></div></div></section>
 </div></main>
}

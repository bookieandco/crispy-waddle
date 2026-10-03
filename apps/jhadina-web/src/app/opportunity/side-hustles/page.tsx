import Link from 'next/link'
import {SIDE_HUSTLE_DEFINITIONS,getSideHustleProductionStatus,getSideHustleRelationshipScope} from '@jhadina/opportunity-core'

const CATEGORY_LABELS:Record<string,string>={
  ai_businesses:'AI Businesses',
  freelance:'Services & Freelance',
  products:'Products & Commerce',
  arbitrage:'Arbitrage & Fulfillment',
  partnerships:'Partnerships & Procurement',
  assets:'Physical Assets',
  experiments:'Intelligence / Experiments',
  earn:'Earn',
}

export default function SideHustlesPage(){
  const groups=new Map<string,typeof SIDE_HUSTLE_DEFINITIONS>()
  for(const definition of SIDE_HUSTLE_DEFINITIONS){
    const rows=groups.get(definition.hubCategory)??[]
    groups.set(definition.hubCategory,[...rows,definition])
  }

  return <main style={{maxWidth:1180,margin:'0 auto',padding:'32px 20px 72px'}}>
    <header style={{marginBottom:30}}>
      <Link href="/opportunity" style={{color:'inherit',opacity:.68,textDecoration:'none'}}>← Opportunities</Link>
      <p style={{margin:'28px 0 0',fontSize:12,letterSpacing:1.4,textTransform:'uppercase',opacity:.58}}>Side Hustle Business Factory</p>
      <h1 style={{fontSize:38,margin:'7px 0 10px'}}>Businesses, separated. Relationships, shared underneath.</h1>
      <p style={{maxWidth:820,margin:0,opacity:.72,lineHeight:1.55}}>
        Each hustle has its own prospects, customers, partners, vendors and pipeline context. The same real person or company stays one canonical Relationship Core entity so Jhadina never creates duplicate identities just because they matter to two businesses.
      </p>
    </header>

    {[...groups.entries()].map(([category,definitions])=><section key={category} style={{marginTop:34}}>
      <h2 style={{fontSize:21,marginBottom:14}}>{CATEGORY_LABELS[category]??category}</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:12}}>
        {definitions.map(definition=>{
          const scope=getSideHustleRelationshipScope(definition.family,definition.label)
          const production=getSideHustleProductionStatus(definition.family)
          return <Link key={definition.family} href={'/opportunity/side-hustles/'+definition.family}
            style={{color:'inherit',textDecoration:'none',border:'1px solid color-mix(in srgb, currentColor 20%, transparent)',borderRadius:15,padding:17,display:'block'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12}}>
              <div>
                <div style={{fontSize:12,textTransform:'uppercase',letterSpacing:1,opacity:.56}}>{definition.defaultRole.replace(/_/g,' ')}</div>
                <h3 style={{fontSize:18,margin:'5px 0 8px'}}>{definition.label}</h3>
              </div>
              <div style={{display:'grid',gap:5,justifyItems:'end'}}>
                <span style={{fontSize:12,opacity:.55}}>{scope.lanes.length} lanes</span>
                <span style={{fontSize:11,padding:'4px 7px',border:'1px solid currentColor',borderRadius:999,opacity:.72}}>{production.readiness.replace(/_/g,' ')}</span>
              </div>
            </div>
            <p style={{fontSize:13,opacity:.67,lineHeight:1.45,margin:'0 0 13px'}}>
              {scope.lanes.map(lane=>lane.label).join(' · ')}
            </p>
            <div style={{fontSize:12,opacity:.55}}>Owners: {definition.executionOwners.join(' · ')}</div>
            <div style={{fontSize:12,opacity:.67,lineHeight:1.45,marginTop:8}}><strong>Next:</strong> {production.nextMilestones[0]}</div>
          </Link>
        })}
      </div>
    </section>)}
  </main>
}

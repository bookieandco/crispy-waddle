import {createClient} from '@/lib/supabase/server'
import {isVerifiedPersonalOwner} from '@/lib/auth/personal-owner'
export const dynamic='force-dynamic'
export const revalidate=0

type ResearchAlert={
  alert_id:string
  mint:string
  code:string
  severity:string
  source_url:string
  observed_at:string
}
const colors={background:'#0b1118',panel:'#15202c',text:'#f0f4f8',muted:'#9aaebe'}
export default async function SharkAttentionPage(){
  let status='Not commissioned'
  let alerts:ResearchAlert[]=[]
  let owner=false
  try{
    const db=await createClient()
    const {data:{user},error:authError}=await db.auth.getUser()
    owner=!authError&&isVerifiedPersonalOwner(user)
    if(owner&&user){
      const since=new Date(Date.now()-7*86400_000).toISOString()
      const {data,error}=await db.from('shark_attention_owner_alerts')
        .select('alert_id,mint,code,severity,source_url,observed_at')
        .eq('owner_id',user.id).gte('observed_at',since)
        .order('observed_at',{ascending:false}).limit(30)
      if(!error){
        alerts=(data??[]) as ResearchAlert[]
        status='Research inbox — historical evidence only'
      }
    }
  }catch{status='Unavailable — source not connected'}
  if(!owner)return (
    <main style={{minHeight:'100dvh',padding:'2rem',background:colors.background,color:colors.text}}>
      <h1>SHARK Attention</h1>
      <p>Owner authentication is required to view research alerts.</p>
    </main>
  )
  return (
    <main style={{minHeight:'100dvh',padding:'1.5rem',background:colors.background,color:colors.text,fontFamily:'system-ui'}}>
      <div style={{maxWidth:660,margin:'auto'}}>
        <p style={{color:colors.muted,letterSpacing:'.1em',fontSize:12}}>JHADINA / SHARK / RESEARCH</p>
        <h1 style={{fontSize:28,marginBottom:6}}>Attention Monitor</h1>
        <p style={{color:colors.muted}}>Owner-only, read-only paper research. No orders, custody or wallet signing.</p>
        <section style={{background:colors.panel,borderRadius:12,padding:18,marginTop:18}}>
          <strong>{status}</strong>
          <p style={{color:colors.muted,fontSize:13}}>
            This page does not start a continuous worker or send device notifications.
            Research evidence is not a buy or sell recommendation.
          </p>
          <p style={{fontSize:13}}>Recent research alerts: {alerts.length}</p>
        </section>
        <section aria-label="Recent alerts">
          {alerts.length===0?<p style={{color:colors.muted}}>No owner-reviewed public research alerts are available.</p>:alerts.map(a=>
            <article key={a.alert_id} style={{background:colors.panel,borderRadius:12,padding:16,marginTop:12}}>
              <div style={{fontWeight:650}}>{a.code.replaceAll('_',' ')} · {a.severity}</div>
              <p style={{fontSize:12,wordBreak:'break-all',color:colors.muted}}>{a.mint}</p>
              <p style={{fontSize:12,color:colors.muted}}>{a.observed_at}</p>
              {a.source_url.startsWith('https://')&&
                <a href={a.source_url} target="_blank" rel="noopener noreferrer" style={{color:'#a8d4ff'}}>Public source</a>}
            </article>)}
        </section>
      </div>
    </main>
  )
}

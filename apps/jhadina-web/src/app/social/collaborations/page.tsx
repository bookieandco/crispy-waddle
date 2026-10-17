'use client';
import {useState} from 'react';
import {CREATOR_PERSISTENCE_COMMISSIONED} from '../../../lib/social/creator-persistence-boundary';
import {assessMarketplaceCandidate,compileCollaborationDraft,assessCreatorAssetReuse} from '@jhadina/growth-core/src/intelligence/creator-marketplace';
import type {CreatorCampaignBrief,CreatorCandidate,CreatorSeedEconomics,MarketplaceSource} from '@jhadina/growth-core/src/intelligence/creator-marketplace';

const frame={maxWidth:820,margin:'auto',padding:'28px 18px 110px',color:'#29332e',fontFamily:'system-ui,sans-serif'};
const panel={background:'#fffdf8',border:'1px solid #dde2da',borderRadius:22,padding:18,margin:'18px 0'};
const input={display:'block',margin:'6px 0 12px',padding:'10px',borderRadius:10,border:'1px solid #c8d2c9',width:'100%',boxSizing:'border-box' as const,font:'inherit'};
const amountKeys=['productCostUsd','shippingUsd','creatorFeeUsd','platformFeeUsd','otherCostsUsd','reimbursementUsd','creatorCheckoutUsd'] as const;
const split=(v:string)=>v.split(',').map(x=>x.trim()).filter(Boolean);

export default function CreatorCollaborationLab(){
 const [brand,setBrand]=useState('pupsonstuff');
 const [source,setSource]=useState<MarketplaceSource>('direct_manual');
 const [offer,setOffer]=useState('portrait');
 const [niche,setNiche]=useState('dogs, pets');
 const [affinity,setAffinity]=useState('dog owner');
 const [platform,setPlatform]=useState('instagram');
 const [creator,setCreator]=useState('');
 const [creatorNiche,setCreatorNiche]=useState('');
 const [creatorAffinity,setCreatorAffinity]=useState('');
 const [engagement,setEngagement]=useState('');
 const [consent,setConsent]=useState(false);
 const [amounts,setAmounts]=useState<Record<keyof CreatorSeedEconomics,string>>({
  productCostUsd:'',shippingUsd:'',creatorFeeUsd:'',platformFeeUsd:'',otherCostsUsd:'',reimbursementUsd:'',creatorCheckoutUsd:''
 });
 const [licenseProof,setLicenseProof]=useState('');
 const [licenseExpiry,setLicenseExpiry]=useState('');
 const [licenseUse,setLicenseUse]=useState<'organic_repost'|'paid_ad'>('organic_repost');
 const [savedRecords,setSavedRecords]=useState<Array<{id:string;kind:string;brandId:string;sourceKey:string;revision:number;updatedAt:string;campaignRef:string|null;payload:Record<string,unknown>;evidenceRefs:string[];observedAt:string}>>([]);
 const [persistStatus,setPersistStatus]=useState('');
 const [busy,setBusy]=useState(false);
 const [importText,setImportText]=useState('');
 const [stageEvidence,setStageEvidence]=useState('');
 const nextStage:Record<string,string>={draft:'contact_proposed',contact_proposed:'negotiating_recorded',
  negotiating_recorded:'agreed_recorded',agreed_recorded:'sample_planned',
  sample_planned:'shipment_recorded',shipment_recorded:'ugc_received',ugc_received:'completed_recorded'};
 async function recordStage(record:{id:string;kind:string;brandId:string;sourceKey:string;revision:number;
  campaignRef:string|null;payload:Record<string,unknown>;evidenceRefs:string[];observedAt:string},stage:string){
  if(!CREATOR_PERSISTENCE_COMMISSIONED)return setPersistStatus('Saving is unavailable until storage commissioning is complete.');
  if(!stageEvidence.trim())return setPersistStatus('An evidence reference is required to record a stage.');
  setBusy(true);setPersistStatus('');
  try{
   const res=await fetch('/api/social/collaborations',{method:'PATCH',headers:{'content-type':'application/json'},
    body:JSON.stringify({id:record.id,revision:record.revision,kind:record.kind,brandId:record.brandId,
     campaignRef:record.campaignRef,sourceKey:record.sourceKey,
     payload:{...record.payload,lifecycleStage:stage},
     evidenceRefs:[...record.evidenceRefs,stageEvidence.trim()].slice(-30),observedAt:new Date().toISOString()})});
   const json=await res.json();if(!res.ok)throw Error(json.error||'Could not record stage');
   setPersistStatus('Recorded observation; Jhadina did not contact, purchase, send or publish anything.');
   await reload();
  }catch(e){setPersistStatus(e instanceof Error?e.message:'Save failed');}
  finally{setBusy(false);}
 }
 const [orderEvidence,setOrderEvidence]=useState('');
 const [sales,setSales]=useState('');
 const [fulfillment,setFulfillment]=useState('');
 const [marketing,setMarketing]=useState('');
 async function reload(){
  setBusy(true);setPersistStatus('');
  try{const res=await fetch('/api/social/collaborations?brand='+encodeURIComponent(brand),{cache:'no-store'});
   const json=await res.json();if(!res.ok)throw Error(json.error||'Could not load');
   setSavedRecords(json.records||[]);setPersistStatus('Loaded owner-scoped saved drafts.');}
  catch(e){setPersistStatus(e instanceof Error?e.message:'Read failed');}
  finally{setBusy(false);}
 }
 async function store(kind:'campaign'|'creator'|'license'|'collaboration'|'outcome'|'ad_study'|'creative_brief'){
  if(!CREATOR_PERSISTENCE_COMMISSIONED)return setPersistStatus('Saving is unavailable until storage commissioning is complete.');
  setBusy(true);setPersistStatus('');
  try{
   const values:Record<string,unknown>={
    brandId:brand,offerRef:offer,platform,creator:creator.trim(),origin:'OWNER_PROVIDED_UNVERIFIED',niche:split(niche),
    requiredProductAffinity:split(affinity),observedCreatorNiche:split(creatorNiche),
    observedCreatorAffinity:split(creatorAffinity),consentClaim:consent,
    rightToUse:'NOT_VERIFIED',spendAuthority:false
   };
   if(kind==='creator'&&!creator.trim())throw Error('Creator is required');
   if(kind==='license'&&(!licenseProof.trim()||!licenseExpiry))throw Error('License proof reference and expiry required');
   if(kind==='outcome'&&(!orderEvidence.trim()||!sales.trim()||!fulfillment.trim()||!marketing.trim()))
    throw Error('Order evidence, revenue and actual costs required');
   if(kind==='license'){values.rights={proofRef:licenseProof,expiry:licenseExpiry,requestedUse:licenseUse,unverified:true};}
   if(kind==='outcome'){
    for(const [k,v] of [['revenueUsd',sales],['fulfillmentCostsUsd',fulfillment],['marketingCostUsd',marketing]]){
     if(!Number.isFinite(Number(v))||Number(v)<0)throw Error('Outcome amounts must be nonnegative');
     values[k]=Number(v);
    }
    values.orderEvidenceRef=orderEvidence;values.attributionVerification='NOT_VERIFIED';
   }
   if(kind==='ad_study'){values.paidSpendUsd=0;values.mode='organic_only';}
   if(kind==='collaboration'){values.lifecycleStage='draft';values.outreachStatus='NOT_SENT';}
   if(kind==='creative_brief'){values.directorJob='proposal_only';values.published=false;}
   const sourceKey=kind==='campaign'||kind==='ad_study'?'campaign:'+brand+':'+offer+':'+platform:
    kind==='creator'?'creator:'+platform+':'+creator.trim().replace(/^@/,'').toLowerCase():
    kind+':'+platform+':'+creator.trim().replace(/^@/,'').toLowerCase()+':'+offer;
   const evidenceRefs=[kind==='license'?licenseProof:
    kind==='outcome'?orderEvidence:'owner-manual:'+new Date().toISOString()];
   const res=await fetch('/api/social/collaborations',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({kind,brandId:brand,sourceKey,campaignRef:'campaign:'+brand+':'+offer,payload:values,
     evidenceRefs,observedAt:new Date().toISOString()})});
   const json=await res.json();if(!res.ok)throw Error(json.error||'Save failed');
   setPersistStatus(kind+' saved as owner draft. No external action executed.');
   await reload();
  }catch(e){setPersistStatus(e instanceof Error?e.message:'Save failed');}
  finally{setBusy(false);}
 }
 async function importManual(){
  if(!CREATOR_PERSISTENCE_COMMISSIONED)return setPersistStatus('Saving is unavailable until storage commissioning is complete.');
  setBusy(true);setPersistStatus('');
  try{
   const rows=importText.trim().split(/\r?\n/).map(row=>row.trim()).filter(Boolean);
   if(rows.length<1||rows.length>100)throw Error('1–100 rows per import');
   const leads=rows.map(row=>{
    const parts=row.split(',').map(x=>x.trim());
    if(parts.length!==5)throw Error('Each row needs: platform,handle,niches,affinity,permission');
    const [platform,handle,niches,affinity,permission]=parts;
    return {platform,handle,nicheTags:niches.split('|').map(x=>x.trim()).filter(Boolean),
     productAffinitySignals:affinity.split('|').map(x=>x.trim()).filter(Boolean),
     sourceRef:'manual-typed:'+handle,observedAt:new Date().toISOString(),
     contactPermission:permission,evidenceRefs:['owner-manual-import:'+new Date().toISOString()]};
   });
   const res=await fetch('/api/social/collaborations/import',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({brandId:brand,leads})});
   const json=await res.json();if(!res.ok)throw Error(json.error||'Import failed');
   setPersistStatus('Saved '+json.created+' creator records; '+json.skippedExisting+' already existed.');
   await reload();
  }catch(e){setPersistStatus(e instanceof Error?e.message:'Import failed');}
  finally{setBusy(false);}
 }
 const [result,setResult]=useState<null|{score:number;cost:number|null;blockers:string[];licenseResult?:string;error?:string}>(null);
 function evaluate(){
  try{
   const now=new Date().toISOString();
   const brief:CreatorCampaignBrief={id:'preview:campaign',ownerId:'preview:owner',brandId:brand,offerRef:offer||'unresolved',
    destinationRef:'preview:shop',source,nicheTags:split(niche),requiredProductAffinity:split(affinity),
    desiredPlatforms:[platform],maximumEvidenceAgeDays:30,authorizedExternalSpendUsd:0,evidenceRefs:['owner-entered:preview']};
   const rate=engagement.trim()?Number(engagement)/100:undefined;
   const candidate:CreatorCandidate={consentForOutreach:consent,contactRef:consent?'owner-attested:contact':undefined,suppression:'none',
    evidence:{creatorRef:creator.trim(),platform,sourceRef:'manual:preview',observedAt:now,
     evidenceRefs:['owner-entered:preview'],nicheTags:split(creatorNiche),audienceSignals:[],
     productAffinitySignals:split(creatorAffinity),...(rate!==undefined?{engagementRate:rate}:{})}};
   const ranking=assessMarketplaceCandidate(brief,candidate,now);
   const econ=Object.fromEntries(amountKeys.map(key=>[key,amounts[key].trim()?Number(amounts[key]):null])) as unknown as CreatorSeedEconomics;
   const draft=compileCollaborationDraft(brief,ranking,econ);
   let licenseResult: string|undefined;
   if(licenseProof.trim()&&licenseExpiry.trim()){
    const rights=assessCreatorAssetReuse({license:{ownerId:brief.ownerId,brandId:brand,creatorRef:creator.trim(),
     assetRef:'preview:ugc',permissions:[licenseUse],grantedAt:now,expiresAt:new Date(licenseExpiry).toISOString(),proofRefs:[licenseProof]},
     ownerId:brief.ownerId,brandId:brand,creatorRef:creator.trim(),assetRef:'preview:ugc',desiredUse:licenseUse,nowIso:now});
    licenseResult=rights.allowedForProposal?'In scope for later owner review; no publishing permission granted':'Blocked: '+rights.blockers.join(', ');
   }
   setResult({score:ranking.score,cost:draft.estimatedMarketingCostUsd,blockers:[...draft.blockers],licenseResult});
  }catch(e){setResult({score:0,cost:null,blockers:[],error:e instanceof Error?e.message:'Invalid input'});}
 }
 return <main style={{background:'#f4f1ea',minHeight:'100vh'}}><div style={frame}>
  <a href="/social" style={{color:'#466454'}}>← Social Core</a>
  <p style={{fontSize:11,letterSpacing:'.15em',color:'#728078'}}>JHADINA • FREE-FIRST MARKETING</p>
  <h1 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:'clamp(36px,8vw,56px)',margin:'6px 0'}}>Creator Collaboration Lab</h1>
  <p style={{lineHeight:1.6,color:'#69786e'}}>A free planning alternative for micro-influencer discovery, collaboration costs and UGC rights. Estimates stay in this page and are lost on reload. Saving, imports and stage updates are unavailable until storage commissioning is complete. No outgoing contact, shipping or ads.</p>
  <section style={panel}><h2>Campaign</h2>
   <label>Brand<select style={input} value={brand} onChange={e=>setBrand(e.target.value)}>
    <option value="pupsonstuff">PupsonStuff</option><option value="atwood-bookie">Atwood Bookie</option><option value="bookieandco">Bookie & Co.</option><option value="truckeros">Truckeros</option>
   </select></label>
   <label>Discovery source<select style={input} value={source} onChange={e=>setSource(e.target.value as MarketplaceSource)}>
    <option value="direct_manual">Direct, no-subscription outreach</option><option value="social_cat_manual">Social Cat lead (manual)</option><option value="stack_influence_manual">Stack Influence lead (manual)</option>
   </select></label>
   <label>Offer ID<input style={input} value={offer} onChange={e=>setOffer(e.target.value)}/></label>
   <label>Desired niches (comma-separated)<input style={input} value={niche} onChange={e=>setNiche(e.target.value)}/></label>
   <label>Product affinity<input style={input} value={affinity} onChange={e=>setAffinity(e.target.value)}/></label>
  </section>
  <section style={panel}><h2>Creator evidence</h2>
   <label>Creator identifier<input style={input} value={creator} onChange={e=>setCreator(e.target.value)} placeholder="@handle or consented ID"/></label>
   <label>Platform<select style={input} value={platform} onChange={e=>setPlatform(e.target.value)}><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="youtube">YouTube</option></select></label>
   <label>Observed niches<input style={input} value={creatorNiche} onChange={e=>setCreatorNiche(e.target.value)} placeholder="dogs, pets"/></label>
   <label>Observed product affinity<input style={input} value={creatorAffinity} onChange={e=>setCreatorAffinity(e.target.value)} placeholder="dog owner"/></label>
   <label>Observed engagement (%)<input style={input} value={engagement} onChange={e=>setEngagement(e.target.value)} inputMode="decimal" placeholder="Optional, e.g. 4"/></label>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I have a permitted contact route and no opt-out.</label>
   <p style={{fontSize:12,color:'#66766d'}}>Evidence is manually entered, not independently verified. No automated messaging.</p>
  </section>
  <section style={panel}><h2>Per-creator collaboration costs (USD)</h2>
   {amountKeys.map(key=><label key={key}>{key.replace(/Usd$/,'').replace(/([A-Z])/g,' $1')}
    <input type="number" min="0" step="0.01" style={input} value={amounts[key]} placeholder="Unknown / get quote"
     onChange={e=>setAmounts(prev=>({...prev,[key]:e.target.value}))}/>
   </label>)}
   <p style={{fontSize:12,color:'#66766d'}}>Unknown is not free. Only enter zero when cost is confirmed zero. Product seeding needs a separate approval even when a plan is prepared.</p>
  </section>
  <section style={panel}><h2>Optional signed UGC rights review</h2>
   <label>Owner-supplied agreement reference<input style={input} value={licenseProof} onChange={e=>setLicenseProof(e.target.value)}/></label>
   <label>Expiry date<input style={input} type="date" value={licenseExpiry} onChange={e=>setLicenseExpiry(e.target.value)}/></label>
   <label>Usage<select style={input} value={licenseUse} onChange={e=>setLicenseUse(e.target.value as 'organic_repost'|'paid_ad')}>
    <option value="organic_repost">Organic repost</option><option value="paid_ad">Paid ad</option>
   </select></label>
   <p style={{fontSize:12,color:'#66766d'}}>A license reference is not independent proof. Publishing always requires Social / Action Core authorization.</p>
  </section>
  <button type="button" onClick={evaluate} style={{padding:'14px 22px',background:'#34443c',color:'#fff',border:0,borderRadius:24,fontWeight:700}}>Evaluate preview</button>
  {result&&<section style={panel} aria-live="polite"><h2>Creator assessment</h2>
   {result.error?<p role="alert">{result.error}</p>:<><p><b>Evidence fit:</b> {result.score}/100</p>
    <p><b>Estimated collaboration cost:</b> {result.cost===null?'Missing quote': '$'+result.cost.toFixed(2)}</p>
    {result.blockers.length>0&&<ul>{result.blockers.map(code=><li key={code}>{code}</li>)}</ul>}
    {result.licenseResult&&<p><b>UGC rights:</b> {result.licenseResult}</p>}
    <p><b>Execution:</b> Disabled. No money or messages will be sent.</p></>}
  </section>}
  <section style={panel}><h2>Account drafts — saving unavailable</h2>
   <p style={{fontSize:12,color:'#66766d'}}>Storage commissioning is pending. Save controls are disabled; reloading only attempts to read existing account drafts. Manual entries remain unverified.</p>
   <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
    {(['campaign','creator','collaboration','creative_brief','ad_study','license'] as const).map(kind=>
     <button key={kind} disabled={!CREATOR_PERSISTENCE_COMMISSIONED||busy} type="button" onClick={()=>void store(kind)}
      style={{padding:'9px 13px',borderRadius:16,border:'1px solid #cdd7ce',background:'#eef2ed'}}>{'Save '+kind.replace('_',' ')}</button>)}
    <button type="button" disabled={busy} onClick={()=>void reload()} style={{padding:'9px 13px',borderRadius:16}}>Reload saved records</button>
   </div>
   {persistStatus&&<p role="status">{persistStatus}</p>}
   {savedRecords.length>0&&<>
    <label>Stage evidence reference (for manually recorded collaboration progress)
     <input style={input} value={stageEvidence} onChange={e=>setStageEvidence(e.target.value)} placeholder="Owner note or actual receipt reference"/>
    </label>
    <ul>{savedRecords.slice(0,40).map(r=><li key={r.id} style={{marginBottom:12}}>
      {r.kind} · {r.sourceKey} · v{r.revision}
      {r.kind==='collaboration'&&typeof r.payload.lifecycleStage==='string'&&nextStage[String(r.payload.lifecycleStage)]&&
       <button type="button" disabled={!CREATOR_PERSISTENCE_COMMISSIONED||busy||!stageEvidence.trim()}
        onClick={()=>void recordStage(r,nextStage[String(r.payload.lifecycleStage)]!)}
        style={{marginLeft:8}}>Record {nextStage[String(r.payload.lifecycleStage)]}</button>}
    </li>)}</ul></>}
  </section>
  <section style={panel}><h2>Import manually obtained creator leads</h2>
   <p style={{fontSize:12,color:'#66766d'}}>One row per creator: platform,handle,niche tags separated with |,product affinity separated with |,permission. Permission: unknown, verified_opt_in, declined or do_not_contact. No scraping or sending.</p>
   <textarea value={importText} onChange={e=>setImportText(e.target.value)}
    placeholder="instagram,doglover,dogs|pets,dog owner,unknown" rows={4} style={{...input,resize:'vertical'}}/>
   <button type="button" disabled={!CREATOR_PERSISTENCE_COMMISSIONED||busy||!importText.trim()} onClick={()=>void importManual()}>Save creator leads only</button>
  </section>
  <section style={panel}><h2>Record order-backed results</h2>
   <p style={{fontSize:12,color:'#66766d'}}>Manual evidence entry is not independently verified. Imported revenue is not certified sales or grounds for ad spending.</p>
   <label>External order evidence reference<input style={input} value={orderEvidence} onChange={e=>setOrderEvidence(e.target.value)}/></label>
   <label>Attributed revenue (USD)<input style={input} inputMode="decimal" value={sales} onChange={e=>setSales(e.target.value)}/></label>
   <label>Fulfillment cost (USD)<input style={input} inputMode="decimal" value={fulfillment} onChange={e=>setFulfillment(e.target.value)}/></label>
   <label>Marketing cost (USD)<input style={input} inputMode="decimal" value={marketing} onChange={e=>setMarketing(e.target.value)}/></label>
   <button type="button" disabled={!CREATOR_PERSISTENCE_COMMISSIONED||busy} onClick={()=>void store('outcome')}>Save unverified outcome record</button>
  </section>
 </div></main>;
}

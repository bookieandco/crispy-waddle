'use client';
import {useState} from 'react';
import {assessMarketplaceCandidate,compileCollaborationDraft,assessCreatorAssetReuse} from '@jhadina/growth-core';
import type {CreatorCampaignBrief,CreatorCandidate,CreatorSeedEconomics,MarketplaceSource} from '@jhadina/growth-core';

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
  <p style={{lineHeight:1.6,color:'#69786e'}}>A free planning alternative for micro-influencer discovery, collaboration costs and UGC rights. Local preview only: no subscriptions, stored records, accounts connected, outgoing contact, shipping or ads.</p>
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
 </div></main>;
}

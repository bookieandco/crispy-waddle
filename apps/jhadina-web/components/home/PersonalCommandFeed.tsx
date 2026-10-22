import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { baseStories } from './storyCatalog';
import { HOME_FEED_SOURCES, type FeedSource, type Story } from './storyTypes';
import styles from './PersonalCommandFeed.module.css';
import {selectHomeStories,searchHomeStories, type FeedOrdering, type FeedView} from './feedPresentation';
import {presentSavedFeed,type SavedFeedRead} from './savedFeedPresentation';
import {publicAuthorStories, type PublicPreviewProvider} from './publicAuthorStories';

const glyph: Record<Story['kind'], string> = {
  social: '◎',
  youtube: 'Y',
  director: '▶',
  jhadina: '✦',
  tv: '▣',
  opportunity: '★',
  money: '$',
  sports: '🏆',
  commerce: '●',
};

type GrowthDraft = { title?: string; body: string; status: string };
type OpportunityItem = {
  id: string;
  title: string;
  summary?: string;
  sourceName?: string;
  fitScore?: number;
  deadline?: string;
  estimatedPay?: { min?: number; max?: number; currency?: string; cadence?: string };
  verificationStatus?: string;
  automationLevel?: string;
};
type TvTitle = { id: string; title: string; overview?: string; kind: string; year?: number; providerId?: string };

type MoneyFeedItem = {
  eventId: string;
  type: string;
  lane: string;
  commitment: 'WATCHING' | 'SUGGESTED' | 'COMMITTED' | 'CLOSED' | 'ACCOUNTING' | 'RISK';
  title: string;
  body: string;
  subjectId?: string | null;
  route: string;
  fundedAmountMinor?: string | null;
  currency?: string | null;
  materiality: number;
  occurredAt: string;
  evidenceIds: string[];
};

type SocialHubItem = {
  id: string;
  source: 'publication' | 'observation';
  occurredAt: string;
  platform?: string;
  title: string;
  status?: string;
  contentId?: string;
  provenance: string[];
};

function sourceForPlatform(platform?: string): Exclude<FeedSource, 'All'> {
  switch ((platform ?? '').toLowerCase()) {
    case 'tiktok': return 'TikTok';
    case 'facebook': return 'Facebook';
    case 'instagram': return 'Instagram';
    case 'youtube': return 'YouTube';
    case 'reddit': return 'Reddit';
    case 'snapchat': return 'Snapchat';
    case 'x': return 'X';
    case 'linkedin': return 'LinkedIn';
    case 'threads': return 'Threads';
    case 'bluesky': return 'Bluesky';
    case 'tumblr': return 'Tumblr';
    case 'vk': return 'VK';
    default: return 'Social';
  }
}

function useGrowthProposal(): Story | null {
  const [story, setStory] = useState<Story | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/growth/drafts', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const drafts: GrowthDraft[] = json.data?.drafts ?? [];
        const pending = drafts.filter((draft) => draft.status === 'PENDING_APPROVAL');
        if (cancelled || pending.length === 0) return;
        const first = pending[0]!;
        setStory({
          id: 'growth-pending-approval',
          kind: 'director',
          source: 'Director',
          title: first.title || 'A draft is ready for your review.',
          body: pending.length > 1 ? `${pending.length} drafts are waiting on your approval. Nothing publishes without you.` : first.body,
          age: 'Needs attention',
          action: { label: 'Review', href: '/growth' },
          details: [
            { label: 'Status', value: 'Pending approval' },
            { label: 'Drafts', value: String(pending.length) },
            { label: 'Publishing', value: 'Human gated' },
          ],
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return story;
}

function useSocialHubStories(): Story[] {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/social/hub', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const items: SocialHubItem[] = json.data?.items ?? [];
        if (cancelled) return;
        setStories(items.slice(0, 20).map((item) => {
          const source = sourceForPlatform(item.platform);
          return {
            id: `social-hub:${item.id}`,
            kind: source === 'YouTube' ? 'youtube' : 'social',
            source,
            title: item.title,
            body: item.source === 'publication'
              ? 'Governed publication activity from the Social outbox.'
              : 'Observed social activity with preserved source evidence.',
            age: item.status ?? new Date(item.occurredAt).toLocaleString(),
            occurredAt: item.occurredAt,
            action: { label: 'Open Social', href: '/social' },
            details: [
              { label: 'Type', value: item.source },
              ...(item.status ? [{ label: 'Status', value: item.status }] : []),
              ...(item.platform ? [{ label: 'Platform', value: item.platform }] : []),
              { label: 'Provenance', value: item.provenance.slice(0, 3).join(' · ') || 'Recorded' },
            ],
          } satisfies Story;
        }));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return stories;
}

function useOpportunityStories(): Story[] {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/opportunities', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const items: OpportunityItem[] = json.data?.opportunities ?? [];
        if (cancelled) return;
        setStories(items.slice(0, 5).map((item) => {
          const pay = item.estimatedPay;
          const payText = pay && (typeof pay.min === 'number' || typeof pay.max === 'number')
            ? [pay.min, pay.max].filter((value): value is number => typeof value === 'number').map(value => new Intl.NumberFormat('en-US',{style:'currency',currency:pay.currency || 'USD',maximumFractionDigits:0}).format(value)).join('–')
            : 'Not reported';
          return {
            id: `opportunity:${item.id}`,
            kind: 'opportunity',
            source: 'Opportunities',
            title: item.title,
            body: item.summary || 'A ranked opportunity is available for review.',
            age: item.deadline ? `Deadline ${new Date(item.deadline).toLocaleDateString()}` : 'Opportunity',
            action: { label: 'Review opportunity', href: `/opportunity/${encodeURIComponent(item.id)}` },
            details: [
              { label: 'Source', value: item.sourceName || 'Recorded source' },
              { label: 'Fit', value: typeof item.fitScore === 'number' ? String(item.fitScore) : 'Not scored' },
              { label: 'Pay', value: payText },
              ...(item.verificationStatus ? [{ label: 'Verification', value: item.verificationStatus }] : []),
            ],
          } satisfies Story;
        }));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return stories;
}

function useJhadinaTvStories(): Story[] {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/jhadinatv/search?q=', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const titles: TvTitle[] = json.titles ?? [];
        if (cancelled) return;
        setStories(titles.slice(0, 4).map((title) => ({
          id: `jtv:${title.providerId ?? 'provider'}:${title.id}`,
          kind: 'tv',
          source: 'JhadinaTV',
          title: title.title,
          body: title.overview || 'Available through JhadinaTV’s authorized media provider boundary.',
          age: [title.kind?.toUpperCase(), title.year].filter(Boolean).join(' · ') || 'Watch',
          action: { label: 'Open JhadinaTV', href: '/jhadinatv' },
          details: [
            { label: 'Kind', value: title.kind || 'media' },
            { label: 'Year', value: title.year ? String(title.year) : '—' },
            { label: 'Provider', value: title.providerId || 'Authorized provider' },
          ],
        } satisfies Story)));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return stories;
}


function useMoneyStories(): Story[] {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/money/feed?limit=20', { cache: 'no-store' });
        if (!response.ok) return;
        const json = await response.json();
        const events: MoneyFeedItem[] = json.data?.events ?? [];
        if (cancelled) return;
        setStories(events.map((event) => {
          const hasMoney = event.commitment === 'COMMITTED' || event.commitment === 'CLOSED';
          const source: Exclude<FeedSource, 'All'> = event.lane === 'SPORTS' ? 'Sports' : 'Money';
          const amount = hasMoney && event.fundedAmountMinor && event.currency
            ? new Intl.NumberFormat('en-US',{style:'currency',currency:event.currency}).format(Number(event.fundedAmountMinor)/100)
            : null;
          return {
            id: `money-feed:${event.eventId}`,
            kind: source === 'Sports' ? 'sports' : 'money',
            source,
            title: event.title,
            body: event.body,
            age: `${event.commitment.replaceAll('_',' ')} · ${new Date(event.occurredAt).toLocaleString()}`,
            occurredAt: event.occurredAt,
            action: { label: source === 'Sports' ? 'Open Sports' : 'Open Money', href: event.route || (source === 'Sports' ? '/worlds/sports' : '/money/command-center') },
            details: [
              { label: 'Status', value: event.commitment },
              { label: 'Money committed', value: hasMoney ? 'Yes' : 'No' },
              { label: 'Lane', value: event.lane },
              ...(amount ? [{ label: 'Committed amount', value: amount }] : []),
              { label: 'Materiality', value: String(event.materiality) },
              { label: 'Evidence', value: String(event.evidenceIds?.length ?? 0) + ' records' },
            ],
          } satisfies Story;
        }));
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  return stories;
}


type YoutubeVideo = {id:string; title:string; channel:string; publishedAt:string; thumbnailUrl?:string; url:string}
type YoutubeHome = {connection:"connected"|"disconnected"|"reauthorize"|"unavailable"|"needs_configuration";items:YoutubeVideo[];message:string;partial?:boolean;scannedChannels?:number}

function useYouTubePreview() {
  const [state,setState] = useState<YoutubeHome|null>(null)
  useEffect(()=>{
    let alive=true
    void fetch("/api/home/youtube",{cache:"no-store",credentials:"same-origin"})
      .then(async response=>{
        const data=await response.json() as YoutubeHome
        if(!response.ok) throw new Error("Sign in to connect YouTube")
        return data
      })
      .then(data=>{if(alive)setState(data)})
      .catch(()=>{if(alive)setState({connection:"unavailable",items:[],message:"Cannot check YouTube right now."})})
    return()=>{alive=false}
  },[])
  const stories:Story[]=(state?.items??[]).map(video=>({
    id:"youtube-upload:"+video.id,source:"YouTube",kind:"youtube",title:video.title,
    body:video.channel+" · Recent upload from a sampled subscribed channel",
    age:new Date(video.publishedAt).toLocaleDateString(),
    occurredAt:video.publishedAt,
    media:video.thumbnailUrl?.startsWith("https://")?{type:"image",src:video.thumbnailUrl,alt:"Thumbnail for "+video.title}:undefined,
    action:{label:"Watch on YouTube",href:video.url},
    details:[{label:"Source",value:video.channel},{label:"Evidence",value:"YouTube Data API subscription activity"}],
  }))
  return {state,stories}
}

type SavedSourceState="checking"|"ready"|"disabled"|"unavailable"
function useSavedSourceStories(){
 const [state,setState]=useState<SavedSourceState>("checking")
 const [stories,setStories]=useState<Story[]>([])
 useEffect(()=>{
  let alive=true
  void fetch("/api/home/saved-social",{cache:"no-store",credentials:"same-origin"})
   .then(async response=>{
    if(response.status===503)return {state:"disabled" as const,stories:[] as Story[]}
    if(!response.ok)return {state:"unavailable" as const,stories:[] as Story[]}
    const payload=await response.json() as SavedFeedRead
    if(payload.ok!==true||payload.durable!==true)
     return {state:"unavailable" as const,stories:[] as Story[]}
    return {state:"ready" as const,stories:presentSavedFeed(payload)}
   })
   .then(result=>{if(alive){setState(result.state);setStories(result.stories)}})
   .catch(()=>{if(alive){setState("unavailable");setStories([])}})
  return()=>{alive=false}
 },[])
 return {state,stories}
}

function useSocialAccountCount() {
  const [count,setCount]=useState<number|null>(null)
  const [failed,setFailed]=useState(false)
  useEffect(()=>{
    let alive=true
    void fetch("/api/social/profiles",{cache:"no-store",credentials:"same-origin"})
      .then(async response=>{
        const body=await response.json() as {success:boolean;data?:{status?:string}[]}
        if(!response.ok||!body.success)throw new Error("Unavailable")
        return body.data??[]
      })
      .then(accounts=>{if(alive)setCount(accounts.filter(account=>account.status==="connected").length)})
      .catch(()=>{if(alive)setFailed(true)})
    return()=>{alive=false}
  },[])
  return {count,failed}
}

function StoryCard({story,onOpen}:{story:Story;onOpen:(story:Story)=>void}) {
  return <article className={styles.card}>
    <button type="button" className={styles.cardOpen} onClick={()=>onOpen(story)} aria-label={"View details for "+story.title}>
      <span className={styles.cardHeader}>
        <span className={styles.glyph} aria-hidden="true">{glyph[story.kind]}</span>
        <span className={styles.source}>{story.source}</span>
        <span className={styles.meta}>{story.age}</span>
      </span>
      {story.media?.type==="image"&&story.media.src?<img className={styles.cardMedia} src={story.media.src} alt={story.media.alt??""} loading="lazy"/>:null}
      <span className={styles.cardTitle}>{story.title}</span>
      <span className={styles.body}>{story.body}</span>
    </button>
    {story.action?.href?<div className={styles.actions}><Link href={story.action.href} target={story.action.href.startsWith("https://")?"_blank":undefined} rel={story.action.href.startsWith("https://")?"noopener noreferrer":undefined} className={styles.action}>{story.action.label}</Link></div>:null}
  </article>
}

export function PersonalCommandFeed({source}:{source?:FeedSource}) {
  const growthStory=useGrowthProposal()
  const socialStories=useSocialHubStories()
  const opportunityStories=useOpportunityStories()
  const tvStories=useJhadinaTvStories()
  const moneyStories=useMoneyStories()
  const {state:youtube,stories:youtubeStories}=useYouTubePreview()
  const socialAccounts=useSocialAccountCount()
  const savedFeed=useSavedSourceStories()
  const [selected,setSelected]=useState<Story|null>(null)
  const [publicProvider,setPublicProvider]=useState<PublicPreviewProvider>("bluesky")
  const [publicHandle,setPublicHandle]=useState("")
  const [feedSearch,setFeedSearch]=useState("")
  const [publicStories,setPublicStories]=useState<Story[]>([])
  const [publicPreviewMessage,setPublicPreviewMessage]=useState("")
  const [publicPreviewLoading,setPublicPreviewLoading]=useState(false)
  const previewGeneration=useRef(0)
  useEffect(()=>()=>{previewGeneration.current++},[])
  async function loadPublicPreview(){
    const handle=publicHandle.trim().replace(/^@/,"")
    if(!handle || handle.length>250)return
    const generation=++previewGeneration.current
    setPublicPreviewLoading(true)
    setPublicPreviewMessage("")
    setPublicStories([])
    try{
      const query=new URLSearchParams({provider:publicProvider,account:handle})
      const response=await fetch("/api/home/public-social?"+query.toString(),{
        cache:"no-store",credentials:"same-origin",
      })
      const result=await response.json() as {ok?:boolean;sourceTrust?:string;items?:unknown}
      if(!response.ok||result.ok!==true||result.sourceTrust!=="provider_verified")
        throw Error("PUBLIC_PREVIEW_NOT_AVAILABLE")
      const stories=publicAuthorStories(result.items,publicProvider)
      if(generation!==previewGeneration.current)return
      setPublicStories(stories)
      setPublicPreviewMessage(stories.length
        ?String(stories.length)+" public author posts added to this Home session; no social account linked."
        :"No public author posts returned; no account was linked.")
    }catch{
      if(generation===previewGeneration.current)setPublicPreviewMessage("Public preview is unavailable or restricted. No posts were invented.")
    }finally{
      if(generation===previewGeneration.current)setPublicPreviewLoading(false)
    }
  }
  function clearPublicPreview(){
    previewGeneration.current++
    setPublicStories([])
    setPublicPreviewMessage("Preview cleared; no posts or accounts were saved.")
    setPublicPreviewLoading(false)
  }
  const [view,setView]=useState<FeedView>("updates")
  const [ordering,setOrdering]=useState<FeedOrdering>("latest")
  const [platform,setPlatform]=useState<FeedSource>(source??"All")
  useEffect(()=>{if(source)setPlatform(source)},[source])
  useEffect(()=>{
    if(!selected)return
    function closeOnEscape(event:KeyboardEvent){if(event.key==="Escape")setSelected(null)}
    document.addEventListener("keydown",closeOnEscape)
    return()=>document.removeEventListener("keydown",closeOnEscape)
  },[selected])
  const stories=useMemo(()=>{
    const all=[...publicStories,...savedFeed.stories,...socialStories,...youtubeStories,...moneyStories,...opportunityStories,...tvStories,...(growthStory?[growthStory]:[])]
    return searchHomeStories(selectHomeStories(all,view,source??platform,ordering),feedSearch)
  },[publicStories,savedFeed.stories,socialStories,youtubeStories,moneyStories,opportunityStories,tvStories,growthStory,view,platform,source,ordering,feedSearch])
  // Keep the filter palette proportional to connected/recently observed sources.
  // Other platforms belong in the Connections screen until they have real data.
  const sourceChoices:FeedSource[] = ["All",...HOME_FEED_SOURCES.filter(item=>{
    if(item==="All")return false
    if(item===source)return true
    if(item==="YouTube" && youtube?.connection==="connected")return true
    return [...publicStories,...savedFeed.stories,...socialStories,...youtubeStories,...moneyStories,...opportunityStories,...tvStories,...(growthStory?[growthStory]:[])].some(story=>story.source===item)
  })]
  const views:[FeedView,string][]=[["updates","All updates"],["social","Social"],["watch","Watch"],["work","Work"]]
  const youtubeText = !youtube?"Checking YouTube…":youtube.connection==="connected"?"YouTube linked · "+(youtube.scannedChannels??0)+" channels sampled":youtube.connection==="disconnected"?"YouTube not linked":youtube.connection==="reauthorize"?"YouTube needs reconnection":youtube.connection==="needs_configuration"?"YouTube setup required":"YouTube unavailable"
  const socialText=socialAccounts.failed?"Social status unavailable":socialAccounts.count===null?"Checking Social…":socialAccounts.count>0?socialAccounts.count+" Social accounts bound":"No Social accounts bound"

  return <section className={styles.feed} id="jhadina-feed">
    <div className={styles.feedTop}>
      <div><p className={styles.feedEyebrow}>YOUR LIVE SOURCES</p><h2 className={styles.feedHeading}>One scroll. Real sources.</h2></div>
      <div className={styles.connectionLine}>
        <span>{youtubeText}</span>
        {youtube?.connection==="needs_configuration"?<Link href="/social/connections">YouTube setup</Link>:youtube?.connection!=="connected"?<a href="/api/auth/youtube/start">Connect YouTube</a>:null}
        <span>{socialText}</span><Link href="/social/connections">All connections</Link>
        {savedFeed.state==="ready"?<span>{savedFeed.stories.length} stored provider updates</span>:null}
      </div>
    </div>
    <div role="tablist" aria-label="Choose what to see" className={styles.primaryFilters}>
      {views.map(([key,label])=><button type="button" role="tab" aria-selected={view===key} key={key} className={view===key?styles.filterActive:styles.filter} onClick={()=>{setView(key);setPlatform("All")}}>{label}</button>)}
    </div>
    <div className={styles.orderControl}><label htmlFor="jh-feed-order">Show</label><select id="jh-feed-order" value={ordering} onChange={event=>setOrdering(event.target.value as FeedOrdering)}><option value="latest">Latest first</option><option value="balanced">Mix sources evenly</option></select><label htmlFor="jh-feed-search">Search these posts</label><input id="jh-feed-search" className={styles.previewInput} type="search" maxLength={80} value={feedSearch} onChange={event=>setFeedSearch(event.target.value)} placeholder="Search this feed"/><span>Only observed updates; no inferred likes or personality tracking.</span></div>
    <details className={styles.sourceDetails}>
      <summary>Preview public Bluesky, Mastodon or GitHub activity on Home</summary>
      <form onSubmit={event=>{event.preventDefault();void loadPublicPreview()}}>
       <div className={styles.orderControl}>
        <label htmlFor="jh-public-provider">Network</label>
        <select id="jh-public-provider" value={publicProvider} onChange={event=>{
          previewGeneration.current++
          setPublicProvider(event.target.value as PublicPreviewProvider)
          setPublicStories([])
          setPublicPreviewLoading(false)
          setPublicPreviewMessage("")
        }}>
         <option value="bluesky">Bluesky</option><option value="mastodon">Mastodon.social</option><option value="github">GitHub public</option>
        </select>
        <label htmlFor="jh-public-handle">Public account</label>
        <input id="jh-public-handle" className={styles.previewInput} value={publicHandle}
         maxLength={250} placeholder={publicProvider==="bluesky"?"name.bsky.social":publicProvider==="github"?"GitHub username":"name"}
         onChange={event=>setPublicHandle(event.target.value)}/>
        <button type="submit" className={styles.action} disabled={!publicHandle.trim()||publicPreviewLoading}>
         {publicPreviewLoading?"Checking…":"Show posts"}
        </button>
        {publicStories.length>0?<button type="button" className={styles.secondary} onClick={clearPublicPreview}>Clear</button>:null}
       </div>
      </form>
      <p className={styles.sourceNote} role="status">{publicPreviewMessage||
       "Optional public activity preview only. This does not sign in, sync a private timeline, or save a subscription."}</p>
    </details>
    <details className={styles.sourceDetails}>
      <summary>Filter by platform {platform!=="All"?"· "+platform:""} <span aria-hidden="true">⌄</span></summary>
      <div className={styles.filters} aria-label="Platform filters">
        {sourceChoices.map(item=><button type="button" aria-pressed={(source??platform)===item} key={item} className={(source??platform)===item?styles.filterActive:styles.filter} onClick={()=>{setPlatform(item);setView("updates")}}>{item}</button>)}
      </div>
      <p className={styles.sourceNote}>Only connected or observed sources are listed. <Link href="/social/connections">Manage other platforms</Link>.</p>
    </details>
    {youtube?.message&&youtube.connection!=="connected"?<p className={styles.sourceNote} role="status">{youtube.message}</p>:null}
    {youtube?.connection==="connected"&&youtube.partial?<p className={styles.sourceNote}>YouTube shows only a bounded sample of subscribed-channel uploads, not your complete YouTube home recommendations.</p>:null}
    {savedFeed.state==="disabled"?<p className={styles.sourceNote} role="status">Stored feed is not commissioned. Live authorized read previews can still appear; nothing is silently saved.</p>:null}
    {savedFeed.state==="unavailable"?<p className={styles.sourceNote} role="status">Stored feed could not be verified. Nothing has been filled with simulated updates.</p>:null}
    <div className={styles.resultsCount} aria-live="polite">{stories.length} sourced updates</div>
    <div className={styles.list} aria-label="Jhadina feed updates">
      {stories.length?stories.map(story=><StoryCard key={story.source+":"+story.id} story={story} onOpen={setSelected}/>)
        :<div className={styles.empty}>No verified updates match this view. Connect an account, choose another source, or check again when a provider responds. Nothing has been filled with fake posts.</div>}
    </div>
    <details className={styles.sourceDetails}>
      <summary>Explore your worlds and shortcuts <span aria-hidden="true">⌄</span></summary>
      <div className={styles.list}>
        {baseStories.map(story=><StoryCard key={story.id} story={{...story,isShortcut:true,age:"Shortcut · not a live post"}} onOpen={setSelected}/>)}
      </div>
    </details>
    {selected?<div className={styles.overlay} role="presentation" onClick={()=>setSelected(null)}>
      <div className={styles.detailPanel} role="dialog" aria-modal="true" aria-label={selected.title} onClick={event=>event.stopPropagation()}>
        <button type="button" className={styles.close} onClick={()=>setSelected(null)} aria-label="Close details">×</button>
        <div className={styles.source}>{selected.source}</div>
        <h3 className={styles.detailTitle}>{selected.title}</h3>
        <p className={styles.body}>{selected.body}</p>
        {selected.details?<div className={styles.detailGrid}>{selected.details.map(detail=><div className={styles.detailItem} key={detail.label}><span className={styles.detailLabel}>{detail.label}</span><span className={styles.detailValue}>{detail.value}</span></div>)}</div>:null}
        {selected.action?.href?<Link href={selected.action.href} target={selected.action.href.startsWith("https://")?"_blank":undefined} rel={selected.action.href.startsWith("https://")?"noopener noreferrer":undefined} className={styles.action}>{selected.action.label}</Link>:null}
      </div>
    </div>:null}
  </section>
}

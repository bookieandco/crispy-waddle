import type {DecisionProposal,EvidenceRef} from '@jhadina/core-spine';
import type {MusicJuggernautRepository} from '../music/music-juggernaut-repository';
import {createMusicJuggernautRepository} from '../music/music-juggernaut-repository';
import {loadMusicJuggernautProjection} from '../music/music-juggernaut-service';
import {runMusicJuggernautTick} from '../music/music-juggernaut-tick';

export type AskMusicJuggernautOperation =
  | 'overview'
  | 'catalog_priority'
  | 'experiments'
  | 'breakout'
  | 'live_market'
  | 'rights'
  | 'run_tick';

export interface AskMusicJuggernautIntent{
  matched:true;
  operation:AskMusicJuggernautOperation;
}

export interface AskMusicJuggernautWorkPlan{
  kind:'music_juggernaut';
  operation:AskMusicJuggernautOperation;
  authority:'INTERNAL_PLANNING_ONLY';
  artistKey:string;
  mode:'SEARCH'|'ATTACK';
  nextBoundary:'music_experiment'|'director_social'|'growth_paid_proposal'|'live_planning'|'rights_review';
  projectId:string;
  notes:readonly string[];
}

export interface AskMusicJuggernautResult{
  proposal:DecisionProposal;
  workPlan:AskMusicJuggernautWorkPlan;
  verified:true;
  verificationReason:string;
}

export function inspectAskMusicJuggernautIntent(activeTask:string):AskMusicJuggernautIntent|null{
  const text=normalize(activeTask);
  if(!text)return null;
  const music=/\b(music|song|songs|track|tracks|single|album|catalog|rapper|artist|release|record)\b/.test(text);
  if(!music&&!text.includes('juggernaut'))return null;

  // Direct "promote/market this specific thing" commands remain in the existing
  // Marketing Presence pipeline. Juggernaut owns diagnosis, prioritization and orchestration.
  const diagnostic=/\b(what|which|where|how|audit|status|best|priority|prioritize|should|breakout|viral|momentum|outlier|experiment|test|testing|city|cities|tour|perform|show|rights|clearance|sample|deal|juggernaut|catalog)\b/.test(text);
  if(!diagnostic)return null;

  let operation:AskMusicJuggernautOperation='overview';
  if(/\b(run|continue|operate|execute|work)\b/.test(text)&&/\b(juggernaut|music system|music machine|music os)\b/.test(text))operation='run_tick';
  if(operation==='run_tick'){}
  else if(/\b(rights|clearance|sample|samples|split|splits|master|publishing|deal)\b/.test(text))operation='rights';
  else if(/\b(city|cities|tour|touring|perform|performance|show|venue|room|market)\b/.test(text))operation='live_market';
  else if(/\b(breakout|viral|virality|momentum|taking off|blowing up)\b/.test(text))operation='breakout';
  else if(/\b(experiment|experiments|test|testing|outlier|content style|creative)\b/.test(text))operation='experiments';
  else if(/\b(which song|what song|which track|what track|catalog|priority|prioritize|push next|champion)\b/.test(text))operation='catalog_priority';
  return {matched:true,operation};
}

export async function handleAskMusicJuggernautCommand(input:{
  userId:string;
  activeTask:string;
  artistKey?:string;
  artistName?:string;
},overrides:{repository?:MusicJuggernautRepository}={}):Promise<AskMusicJuggernautResult|null>{
  const intent=inspectAskMusicJuggernautIntent(input.activeTask);
  if(!intent)return null;
  const repository=overrides.repository??createMusicJuggernautRepository();
  const artistKey=input.artistKey?.trim()||'atwood-bookie';
  const artistName=input.artistName?.trim()||'Atwood Bookie';
  if(intent.operation==='run_tick'){
    const receipt=await runMusicJuggernautTick(
      {userId:input.userId,artistKey,artistName},
      {repository},
    );
    const proposal:DecisionProposal={
      id:'ask-music-juggernaut:'+crypto.randomUUID(),
      contextId:'music-juggernaut:'+receipt.projectId,
      disposition:'PROCEED',
      recommendation:receipt.actions.length
        ? receipt.actions.map((action,index)=>(index+1)+'. '+action.instruction).join(' ')
        : 'Music Juggernaut completed its internal tick. No new evidence-backed action is required right now.',
      rationale:'The user explicitly asked Music Juggernaut to continue. Jhadina synchronized lineage-bound Social observations, updated durable learning, and planned the next internal work without starting publication, spend, outreach, bookings, contracts, or rights actions.',
      evidence:receipt.socialSync.evidenceRefs.slice(0,12).map((ref)=>({id:ref,source:'music-juggernaut-tick',observedAt:new Date().toISOString(),summary:ref,immutable:false})),
      uncertainty:[],
      alternatives:[],
    };
    return {
      proposal,
      workPlan:{
        kind:'music_juggernaut',operation:'run_tick',authority:'INTERNAL_PLANNING_ONLY',artistKey,mode:receipt.mode,
        nextBoundary:receipt.mode==='ATTACK'?'director_social':'music_experiment',projectId:receipt.projectId,
        notes:[
          'Internal tick completed.',
          'External actions started=false.',
          ...receipt.actions.map((action)=>action.kind+': '+action.reason),
        ],
      },
      verified:true,
      verificationReason:'Music Juggernaut tick completed through owner-scoped repositories; no external action authority was used.',
    };
  }
  const projection=await loadMusicJuggernautProjection({
    userId:input.userId,artistKey,artistName,initialize:true,repository,
  });
  if(!projection)throw new Error('MUSIC_JUGGERNAUT_PROJECT_UNAVAILABLE');

  const evidence=selectEvidence(intent.operation,projection);
  const recommendation=recommend(intent.operation,projection);
  const nextBoundary=nextBoundaryFor(intent.operation,projection.mode);
  const proposal:DecisionProposal={
    id:'ask-music-juggernaut:'+crypto.randomUUID(),
    contextId:'music-juggernaut:'+String(projection.project.id),
    disposition:'PROCEED',
    recommendation,
    rationale:'Jhadina used the owner-scoped Music Juggernaut state, relative performance evidence, rights state, and live-demand records. The result is planning intelligence only; publishing, paid media, outreach, booking commitments, rights grants, and contracts remain separately governed.',
    evidence,
    uncertainty:[
      ...projection.dataWarnings,
      ...(projection.songs.length===0?['No song campaign records exist yet, so catalog prioritization is not evidence-backed.']:[]),
      ...(projection.observations.length===0?['No performance observations exist yet, so Jhadina remains in search/learning mode.']:[]),
    ],
    alternatives:[],
  };
  return {
    proposal,
    workPlan:{
      kind:'music_juggernaut',
      operation:intent.operation,
      authority:'INTERNAL_PLANNING_ONLY',
      artistKey,
      mode:projection.mode,
      nextBoundary,
      projectId:String(projection.project.id),
      notes:[
        'Music Juggernaut may initialize its internal owner-scoped planning project without external side effects.',
        'Director/Social production, paid media, consequential outreach, bookings, rights grants, and contracts keep their existing authority boundaries.',
        'SEARCH mode maximizes learning; ATTACK mode concentrates only after replicated evidence.',
      ],
    },
    verified:true,
    verificationReason:'Owner-scoped Music growth state was read through the durable Juggernaut projection; no external action or new spend authority was created.',
  };
}

function recommend(operation:AskMusicJuggernautOperation,p:NonNullable<Awaited<ReturnType<typeof loadMusicJuggernautProjection>>>):string{
  const top=p.rankedSongs[0];
  switch(operation){
    case 'catalog_priority':
      return top
        ? 'Current evidence puts “'+top.title+'” first in the catalog decision set. Keep it active while Jhadina continues testing section × format × audience; do not treat the rank as artistic worth.'
        : 'There is not enough catalog evidence to choose a record yet. Stay in SEARCH mode: ingest songs, map sections, and run low-burden tests before choosing a hero record.';
    case 'experiments':{
      const validated=p.outliers.filter((item)=>item.status==='validated').length;
      return p.observations.length
        ? 'Music experiment state: '+p.experiments.length+' experiment(s), '+p.observations.length+' observation(s), '+validated+' validated relative outlier(s). Mode='+p.mode+'.'
        : 'No experiment evidence exists yet. Start with genuinely different content families and multiple song sections; do not spend heavily before an outlier replicates.';
    }
    case 'breakout':{
      const validated=p.outliers.filter((item)=>item.status==='validated');
      return validated.length
        ? 'Breakout evidence is active: '+validated.length+' validated relative outlier(s). Enter ATTACK behavior—feed the winner, prepare the follow-up, capture direct fans, collect real proof, and keep scale inside existing approval limits.'
        : 'No validated breakout signal is recorded yet. Stay in SEARCH mode and keep capital light until a relative outlier replicates.';
    }
    case 'live_market':{
      const city=[...p.venues].sort((a,b)=>b.confidence-a.confidence)[0];
      return city
        ? 'Strongest current live-demand recommendation: evaluate roughly a '+city.recommendedCapacity+'-capacity room in '+city.city+' (confidence '+Math.round(city.confidence*100)+'%). This is planning evidence, not a booking commitment.'
        : 'No city-demand evidence is stored yet. Capture city intent, direct fans, prior attendance, and repeat support before sizing rooms.';
    }
    case 'rights':{
      const blocked=p.rights.filter((row)=>row.sample_status==='blocked'||row.third_party_usage_status==='blocked').length;
      const review=p.rights.filter((row)=>row.sample_status==='review_required'||row.third_party_usage_status==='review_required'||row.master_ownership_known!==true||row.publishing_known!==true).length;
      return blocked
        ? blocked+' asset(s) have rights states that block commercial scaling. Resolve those before paid amplification or licensing.'
        : review
          ? review+' asset(s) still need rights review or ownership evidence before aggressive scaling.'
          : p.rights.length
            ? 'Stored rights records currently show no blocking state. Contracts and grants still require human/legal review.'
            : 'No rights ledger evidence is stored yet. Map masters, publishing, samples, and third-party usage before commercial scaling.';
    }
    case 'run_tick':
      return 'Run the governed Music Juggernaut internal tick.';
    case 'overview':
      return 'Music Juggernaut: mode='+p.mode+'; songs='+p.songs.length+'; experiments='+p.experiments.length+'; observations='+p.observations.length+'; direct live markets='+p.cityDemand.length+'; validated learnings='+p.learning.filter((row)=>row.status==='validated').length+'.';
  }
}

function selectEvidence(operation:AskMusicJuggernautOperation,p:NonNullable<Awaited<ReturnType<typeof loadMusicJuggernautProjection>>>):EvidenceRef[]{
  const now=new Date().toISOString();
  const rows:Record<string,unknown>[]=
    operation==='live_market'?p.cityDemand:
    operation==='rights'?p.rights:
    operation==='experiments'||operation==='breakout'?p.observations:
    operation==='catalog_priority'?p.songs:
    operation==='run_tick'?p.observations:
    [p.project,...p.songs.slice(0,3),...p.observations.slice(0,3)];
  return rows.slice(0,12).map((row,index)=>({
    id:String(row.id??('music-juggernaut-evidence:'+index)),
    source:'music-juggernaut',
    observedAt:typeof row.observed_at==='string'?row.observed_at:typeof row.updated_at==='string'?row.updated_at:now,
    summary:summarizeRow(row),
    immutable:false,
  }));
}

function summarizeRow(row:Record<string,unknown>):string{
  const fields=['title','song_key','campaign_state','experiment_key','content_family','platform','views','song_actions','direct_fan_captures','city_name','show_interest','sample_status','third_party_usage_status','status','finding'];
  return fields.filter((key)=>row[key]!==undefined&&row[key]!==null).map((key)=>key+'='+String(row[key])).join('; ')||'Music Juggernaut durable record';
}

function nextBoundaryFor(operation:AskMusicJuggernautOperation,mode:'SEARCH'|'ATTACK'):AskMusicJuggernautWorkPlan['nextBoundary']{
  if(operation==='run_tick')return mode==='ATTACK'?'director_social':'music_experiment';
  if(operation==='rights')return 'rights_review';
  if(operation==='live_market')return 'live_planning';
  if(operation==='experiments')return 'music_experiment';
  if(operation==='breakout'&&mode==='ATTACK')return 'director_social';
  if(operation==='catalog_priority'&&mode==='ATTACK')return 'growth_paid_proposal';
  return 'music_experiment';
}

function normalize(value:string):string{return value.toLowerCase().replace(/\s+/g,' ').trim();}

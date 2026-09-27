import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const RULES = [
  { kind: 'research', terms: ['research','market','audience','competitor','niche','analy'], purpose: 'understand the source, market, or audience', caps: ['research'], qc: ['source-grounding'], fail: ['weak evidence'] },
  { kind: 'character', terms: ['character','face','identity','reference image','consistent','lora','subject'], purpose: 'establish or preserve character identity', caps: ['character-reference','visual-adapter'], qc: ['identity-lock'], fail: ['identity drift'] },
  { kind: 'asset', terms: ['dataset','image','photo','crop','caption','tag','curate','duplicate','train data'], purpose: 'prepare or curate production/training assets', caps: ['asset-curation'], qc: ['dataset-quality'], fail: ['duplicate or off-model assets'] },
  { kind: 'wardrobe', terms: ['wardrobe','clothing','outfit','garment','shirt','hoodie'], purpose: 'control wardrobe and appearance continuity', caps: ['wardrobe-state'], qc: ['garment-lock'], fail: ['garment drift'] },
  { kind: 'performance', terms: ['pose','motion','movement','performance','blocking','eyeline','gesture','lip sync'], purpose: 'rehearse or control performance before final generation', caps: ['performance-master','rehearsal'], qc: ['rehearsal-graduation'], fail: ['collision or performance drift'] },
  { kind: 'voice', terms: ['voice','speech','tts','dialogue','pronunciation'], purpose: 'create or preserve voice/dialogue identity', caps: ['voice-profile'], qc: ['voice-identity'], fail: ['voice drift'] },
  { kind: 'storyboard', terms: ['storyboard','shot list','shotlist','coverage','camera angle'], purpose: 'plan visual coverage before rendering', caps: ['storyboard'], qc: ['coverage-completeness'], fail: ['missing coverage'] },
  { kind: 'generation', terms: ['generate','generation','render','inference','sample','checkpoint','epoch','train','training'], purpose: 'produce candidate media or trained outputs', caps: ['generation'], qc: ['candidate-qc'], fail: ['artifact or overfit'] },
  { kind: 'edit', terms: ['edit','timeline','cut','transition','assemble'], purpose: 'assemble editable media into a coherent cut', caps: ['timeline-editing'], qc: ['edit-continuity'], fail: ['timeline discontinuity'] },
  { kind: 'review', terms: ['test','compare','inspect','evaluate','quality','check','validation'], purpose: 'review candidates and select admitted output', caps: ['multimodal-review'], qc: ['cross-domain-coherence'], fail: ['weak selection evidence'] },
  { kind: 'delivery', terms: ['export','publish','download','deliver','save'], purpose: 'package approved output and provenance', caps: ['delivery'], qc: ['export-integrity'], fail: ['flattened or missing lineage'] },
] as const;

const ALLOWED = new Set(['github.com','raw.githubusercontent.com','www.youtube.com','youtube.com','youtu.be']);

function stripMarkup(input:string,preserveLines=false):string {
  const cleaned=input
    .replace(/<script[\s\S]*?<\/script>/gi,' ')
    .replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/[\*_>#|]/g,' ');
  return preserveLines
    ? cleaned.replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()
    : cleaned.replace(/\s+/g,' ').trim();
}

function classify(text:string) {
  const lower=text.toLowerCase();
  return RULES.find(rule=>rule.terms.some(term=>lower.includes(term))) ?? {
    kind:'concept', purpose:'capture the source concept or instruction',
    caps:['process-understanding'], qc:['source-grounding'], fail:['ambiguous instruction'],
  };
}

export async function runDirectorCertificationStudy(input:{
  client:SupabaseClient;
  sourceUrl:string;
  studyIds:readonly string[];
}):Promise<{observationCount:number}> {
  const parsed=new URL(input.sourceUrl);
  if(!['http:','https:'].includes(parsed.protocol) || !ALLOWED.has(parsed.hostname.toLowerCase())) {
    throw new Error('DIRECTOR_CERT_SOURCE_HOST_NOT_ALLOWED');
  }
  const sourceParts=parsed.pathname.split('/').filter(Boolean);
  const candidates:string[]=[];
  if(parsed.hostname.toLowerCase()==='github.com'&&sourceParts.length>=2){
    candidates.push('https://raw.githubusercontent.com/'+sourceParts[0]+'/'+sourceParts[1]!.replace(/\\.git$/,'')+'/main/README.md');
  }
  candidates.push(input.sourceUrl);
  let text='';
  for(const candidate of candidates){
    const response=await fetch(candidate,{cache:'no-store',redirect:'follow',headers:{'user-agent':'JhadinaDirectorLiveCertification/1.0'}});
    if(!response.ok) continue;
    const raw=(await response.text()).slice(0,2_000_000);
    const preserveLines=new URL(candidate).hostname.toLowerCase()==='raw.githubusercontent.com';
    const clean=stripMarkup(raw,preserveLines);
    if(clean.length>=200){text=clean;break;}
  }
  if(!text) throw new Error('DIRECTOR_CERT_SOURCE_FETCH_FAILED');
  const chunks=text.split(/\n+|(?<=[.!?])\s+/).map(part=>part.trim()).filter(part=>part.length>=20).slice(0,240);
  if(chunks.length<3) throw new Error('DIRECTOR_CERT_PROCESS_EVIDENCE_INSUFFICIENT');

  const selected:{text:string;rule:ReturnType<typeof classify>}[]=[];
  let lastKind='';
  for(const part of chunks) {
    const rule=classify(part);
    if(rule.kind===lastKind && selected.length) {
      selected[selected.length-1]!.text=(selected[selected.length-1]!.text+' '+part).slice(0,1500);
      continue;
    }
    selected.push({text:part.slice(0,1200),rule});
    lastKind=rule.kind;
    if(selected.length>=24) break;
  }

  let total=0;
  for(const studyId of input.studyIds) {
    const rows=selected.map((entry,index)=>{
      const digest=createHash('sha256').update(input.sourceUrl+'|'+index+'|'+entry.text).digest('hex').slice(0,20);
      return {
        id:'cert-study-step:'+digest+':'+studyId,
        study_id:studyId,
        asset_id:studyId,
        kind:'process-step',
        start_seconds:index*10,
        end_seconds:index*10+10,
        payload:{processStep:{
          order:index,
          kind:entry.rule.kind,
          purpose:entry.rule.purpose,
          operation:entry.text,
          requiredCapabilities:[...entry.rule.caps],
          inputs:index?['source-step:'+(index-1)]:['source-reference'],
          outputs:['source-step:'+index],
          qcChecks:[...entry.rule.qc],
          failureModes:[...entry.rule.fail],
        }},
        confidence:0.84,
        provenance:{provider:'jhadina-cert-study',source:'public-reference',sourceUrl:input.sourceUrl},
      };
    });
    const {error:obsError}=await input.client.from('director_study_observations').upsert(rows,{onConflict:'id'});
    if(obsError) throw obsError;
    const {error:studyError}=await input.client.from('director_studies').update({
      status:'completed',
      observations_seen:rows.length,
      last_time_seconds:rows.length*10,
      completed_at:new Date().toISOString(),
      error:null,
      updated_at:new Date().toISOString(),
    }).eq('id',studyId);
    if(studyError) throw studyError;
    total+=rows.length;
  }
  return {observationCount:total};
}

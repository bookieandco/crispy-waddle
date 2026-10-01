export type RestorationBenchmarkLaneRole =
  | "source"
  | "jhadina-restoration"
  | "external-restoration"
  | "external-mix"
  | "external-finishing"
  | "jhadina-finishing";

export interface RestorationBenchmarkArtifactRef {
  artifactId: string;
  sha256: string;
  mimeType: string;
  sourceLabel: string;
}

export interface RestorationBenchmarkRegion {
  id: string;
  label: string;
  startSample: number;
  endSample: number;
  evidenceIds: string[];
}

export interface RestorationBenchmarkLane {
  id: string;
  role: RestorationBenchmarkLaneRole;
  artifact: RestorationBenchmarkArtifactRef;
  provenanceIds: string[];
  notes?: string[];
}

export interface ExternalRenderProvenance {
  id: string;
  laneId: string;
  product: string;
  version?: string;
  module?: string;
  renderedAt?: string;
  settingsSummary: string[];
  sourceEvidenceIds: string[];
  externallyRendered: true;
}

export interface RestorationBenchmarkObjectiveMetrics {
  integratedLufs?: number;
  loudnessRangeLu?: number;
  truePeakDbtp?: number;
  samplePeakDbfs?: number;
  fullRangeCrestFactorDb?: number;
  bandLimitedCrestFactorDb?: Record<string, number>;
  tonalBalanceDistance?: number;
  stereoCorrelation?: number;
  stereoWidth?: number;
  phaseRisk?: number;
  transientPreservation?: number;
  vocalIdentityPreservation?: number;
  stemLeakage?: number;
  stemRecombinationError?: number;
  maskingScore?: number;
  spectralArtifactChange?: number;
  translationFailureCount?: number;
}

export interface RestorationBenchmarkMetricSnapshot {
  benchmarkId: string;
  laneId: string;
  artifactId: string;
  regionId: string;
  metrics: RestorationBenchmarkObjectiveMetrics;
  evidenceIds: string[];
  measuredAt: string;
}

export interface RestorationBlindListeningResult {
  id: string;
  benchmarkId: string;
  regionId: string;
  blindAlias: string;
  artifactId: string;
  listenerId: string;
  scores: {
    artifactRemoval?: number;
    naturalness?: number;
    vocalQuality?: number;
    transientQuality?: number;
    lowEndQuality?: number;
    stereoQuality?: number;
    musicalIdentity?: number;
    overallPreference?: number;
  };
  comments?: string;
  evidenceIds: string[];
  createdAt: string;
}

export interface RestorationBenchmarkDeltaArtifact {
  id: string;
  benchmarkId: string;
  referenceArtifactId: string;
  candidateArtifactId: string;
  regionId: string;
  artifactId: string;
  sha256: string;
  alignmentSamples: number;
  candidateGainDb: number;
  evidenceIds: string[];
}

export interface RestorationBenchmarkCase {
  id: string;
  title: string;
  sourceArtifactId: string;
  sampleRate: number;
  channels: number;
  seed: string;
  lanes: RestorationBenchmarkLane[];
  regions: RestorationBenchmarkRegion[];
  blind: true;
  loudnessMatch: true;
  timeAlign: true;
  deltaAudition: true;
  noSingleMetricWinner: true;
  status: "defined" | "ingested" | "running" | "complete" | "blocked";
  evidenceIds: string[];
}

export interface RestorationBenchmarkConclusion {
  id: string;
  benchmarkId: string;
  objectiveSnapshotIds: string[];
  listeningResultIds: string[];
  deltaArtifactIds: string[];
  findings: string[];
  metricPreferenceDisagreements: string[];
  abstained: boolean;
  reasons: string[];
  evidenceIds: string[];
}

const HEX_64=/^[0-9a-f]{64}$/i;
const clamp01=(value:number)=>Math.max(0,Math.min(1,value));

export function validateBenchmarkCase(input:RestorationBenchmarkCase):RestorationBenchmarkCase {
  if(!input.id.trim()||!input.title.trim()||!input.sourceArtifactId.trim())throw new Error("Benchmark identity is required.");
  if(!Number.isInteger(input.sampleRate)||input.sampleRate<=0)throw new Error("Benchmark sample rate is invalid.");
  if(!Number.isInteger(input.channels)||input.channels<=0)throw new Error("Benchmark channel count is invalid.");
  if(input.lanes.length<2)throw new Error("Benchmark requires at least source and candidate lanes.");
  if(new Set(input.lanes.map(l=>l.id)).size!==input.lanes.length)throw new Error("Benchmark lane ids must be unique.");
  for(const lane of input.lanes){
    if(!lane.id.trim()||!lane.artifact.artifactId.trim())throw new Error("Benchmark lane identity is invalid.");
    if(!HEX_64.test(lane.artifact.sha256))throw new Error("Benchmark lane SHA-256 is invalid.");
    if(!lane.artifact.mimeType.startsWith("audio/"))throw new Error("Benchmark lanes must reference audio artifacts.");
  }
  for(const region of input.regions){
    if(!region.id.trim()||!Number.isInteger(region.startSample)||!Number.isInteger(region.endSample)||region.startSample<0||region.endSample<=region.startSample){
      throw new Error("Benchmark region is invalid.");
    }
  }
  return Object.freeze({...input,lanes:[...input.lanes],regions:[...input.regions],evidenceIds:[...new Set(input.evidenceIds)]});
}

function fnv1a(value:string):number{
  let hash=0x811c9dc5;
  for(let i=0;i<value.length;i+=1){hash^=value.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}
  return hash>>>0;
}

export function createBlindAliases(seed:string,laneIds:string[]):Record<string,string>{
  if(!seed.trim())throw new Error("Blind benchmark seed is required.");
  if(new Set(laneIds).size!==laneIds.length)throw new Error("Blind benchmark lane ids must be unique.");
  const sorted=[...laneIds].sort((a,b)=>(fnv1a(seed+"\0"+a)-fnv1a(seed+"\0"+b))||a.localeCompare(b));
  return Object.fromEntries(sorted.map((laneId,index)=>[laneId,`Sample-${String(index+1).padStart(2,"0")}-${fnv1a(seed+"\0"+laneId).toString(16).padStart(8,"0").slice(0,4).toUpperCase()}`]));
}

export function normalizeListeningScore(value:number|undefined):number|undefined{
  if(value===undefined)return undefined;
  if(!Number.isFinite(value))throw new Error("Listening score must be finite.");
  return clamp01(value);
}

export type BuildSurface='web_app'|'website'|'api'|'worker'|'package';
export type AppBuildAction='create_app'|'extend_app'|'modify_app'|'inspect_app'|'test_app'|'prepare_deployment';

export interface AppBuildIntent { action:AppBuildAction; surface:BuildSurface; request:string; references:readonly string[]; deployRequested:boolean; }
export interface AppRequirements { purpose:string; users:readonly string[]; features:readonly string[]; ui:readonly string[]; data:readonly string[]; integrations:readonly string[]; acceptance:readonly string[]; unresolved:readonly string[]; }
export interface ExistingCapabilityMatch { capability:string; subsystem:string; reuse:'required'|'preferred'; }
export interface AppArchitecture { placement:'existing-app'|'monorepo-app'|'separate-repository'; target:string; dependencies:readonly string[]; capabilityRegistrations:readonly string[]; doctorRegistrationRequired:true; }
export interface BuildReference { locator:string; kind:'github'|'website'|'documentation'|'specification'|'other'; verified:boolean; licenseReviewed:boolean; executableAuthority:false; }
export interface FeatureSlice { id:string; contract:string; files:readonly string[]; tests:readonly string[]; acceptance:readonly string[]; }
export interface IntegrationRequirement { name:string; kind:'database'|'api'|'auth'|'storage'|'secret'; governed:boolean; }
export interface PreviewAcceptance { buildPassed:boolean; requirementsPassed:readonly string[]; requirementsFailed:readonly string[]; assumptions:readonly string[]; }
export interface DeploymentPreparation { ready:boolean; requiresApproval:true; blockers:readonly string[]; }
export interface AppBuildReceipt { intent:AppBuildIntent; requirements:AppRequirements; architecture:AppArchitecture; references:readonly BuildReference[]; slices:readonly FeatureSlice[]; tests:readonly string[]; doctorRepairs:readonly string[]; preview:PreviewAcceptance; deployment:DeploymentPreparation; }

export function parseAppBuildIntent(request:string,references:readonly string[]=[]):AppBuildIntent {
 const q=request.toLowerCase();
 const action:AppBuildAction=/modify|change|make .* blue|move/.test(q)?'modify_app':/extend|add/.test(q)?'extend_app':/test/.test(q)?'test_app':/inspect|audit/.test(q)?'inspect_app':/deploy|publish|launch/.test(q)?'prepare_deployment':'create_app';
 const surface:BuildSurface=/website|site|landing page/.test(q)?'website':/api/.test(q)?'api':/worker|job/.test(q)?'worker':/package|library/.test(q)?'package':'web_app';
 return {action,surface,request,references:[...references],deployRequested:/deploy|publish|launch/.test(q)};
}

export function compileRequirements(input:{purpose:string;users?:string[];features?:string[];ui?:string[];data?:string[];integrations?:string[];acceptance?:string[]}):AppRequirements {
 if(!input.purpose.trim()) throw new Error('APP_PURPOSE_REQUIRED');
 const unresolved:string[]=[]; if(!input.users?.length) unresolved.push('users'); if(!input.features?.length) unresolved.push('features'); if(!input.acceptance?.length) unresolved.push('acceptance');
 return {purpose:input.purpose,users:input.users??[],features:input.features??[],ui:input.ui??[],data:input.data??[],integrations:input.integrations??[],acceptance:input.acceptance??[],unresolved};
}

export function resolveArchitecture(input:{intent:AppBuildIntent;existingTarget?:string;matches:readonly ExistingCapabilityMatch[]}):AppArchitecture {
 const placement=input.existingTarget?'existing-app':'monorepo-app';
 return {placement,target:input.existingTarget??`apps/${slug(input.intent.request)}`,dependencies:[...new Set(input.matches.map(m=>m.subsystem))].sort(),capabilityRegistrations:input.matches.map(m=>m.capability).sort(),doctorRegistrationRequired:true};
}

export function analyzeReferences(locators:readonly string[],verified:ReadonlySet<string>=new Set(),licensed:ReadonlySet<string>=new Set()):readonly BuildReference[] {
 return locators.map(locator=>({locator,kind:locator.includes('github.com')?'github':/^https?:/.test(locator)?'website':'other',verified:verified.has(locator),licenseReviewed:licensed.has(locator),executableAuthority:false as const}));
}

export function assertReferenceSafeForCode(reference:BuildReference):void {
 if(!reference.verified) throw new Error('BUILD_REFERENCE_UNVERIFIED');
 if(reference.kind==='github'&&!reference.licenseReviewed) throw new Error('BUILD_REFERENCE_LICENSE_UNREVIEWED');
}

export function planFeatureSlices(requirements:AppRequirements):readonly FeatureSlice[] {
 return requirements.features.map((feature,index)=>({id:`slice-${index+1}`,contract:feature,files:[],tests:[`test:${slug(feature)}`],acceptance:requirements.acceptance.filter(a=>a.toLowerCase().includes(feature.toLowerCase()))}));
}

export function classifyIntegrations(names:readonly string[]):readonly IntegrationRequirement[] {
 return names.map(name=>{const n=name.toLowerCase(); const kind:IntegrationRequirement['kind']=/secret|key|token/.test(n)?'secret':/auth|login/.test(n)?'auth':/database|supabase|postgres/.test(n)?'database':/storage|bucket/.test(n)?'storage':'api'; return {name,kind,governed:['secret','auth','database'].includes(kind)};});
}

export function evaluatePreview(requirements:AppRequirements,passed:readonly string[]):PreviewAcceptance {
 const ok=new Set(passed); return {buildPassed:true,requirementsPassed:requirements.acceptance.filter(a=>ok.has(a)),requirementsFailed:requirements.acceptance.filter(a=>!ok.has(a)),assumptions:[...requirements.unresolved]};
}
export function prepareDeployment(preview:PreviewAcceptance,integrations:readonly IntegrationRequirement[]):DeploymentPreparation {
 const blockers=[...preview.requirementsFailed,...preview.assumptions,...integrations.filter(i=>i.governed).map(i=>`governed:${i.name}`)]; return {ready:blockers.length===0,requiresApproval:true,blockers};
}

export function createBuildReceipt(input:Omit<AppBuildReceipt,'deployment'> & {integrations:readonly IntegrationRequirement[]}):AppBuildReceipt {
 return {...input,deployment:prepareDeployment(input.preview,input.integrations)};
}

function slug(value:string):string { const s=value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48); return s||'jhadina-app'; }

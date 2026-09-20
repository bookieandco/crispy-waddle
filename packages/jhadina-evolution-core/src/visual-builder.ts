export type NodeKind='page'|'layout'|'section'|'component'|'element';
export type Viewport='desktop'|'tablet'|'mobile';
export interface VisualNode { id:string; kind:NodeKind; name:string; sourcePath:string; parentId?:string; children:readonly string[]; styles:Readonly<Record<string,string>>; responsive:Partial<Record<Viewport,Readonly<Record<string,string>>>>; }
export interface VisualProject { id:string; surface:'website'|'web_app'; branch:string; published:false; nodes:Readonly<Record<string,VisualNode>>; pages:readonly string[]; assets:readonly string[]; designTokens:Readonly<Record<string,string>>; }
export interface VisualReferenceAdmission { locator:string; revision:string; license:'AGPL-3.0'|'MIT'; use:'architecture-only'|'implementation-patterns'; executionAuthority:false; }
export const BUILDER_3V_REFERENCES:readonly VisualReferenceAdmission[]=[
 {locator:'https://github.com/webstudio-is/webstudio',revision:'pinned-at-admission',license:'AGPL-3.0',use:'architecture-only',executionAuthority:false},
 {locator:'https://github.com/totalumlabs/ai-app-builder-open',revision:'pinned-at-admission',license:'MIT',use:'implementation-patterns',executionAuthority:false}
];
export interface Workspace { projectId:string; branch:string; isolated:true; baseCommit:string; previewUrl?:string; }
export interface PreviewHealth { compiled:boolean; runtimeHealthy:boolean; consoleErrors:readonly string[]; accessibilityViolations:readonly string[]; responsiveFailures:readonly string[]; }
export interface Selection { nodeId:string; sourcePath:string; }
export interface VisualOperation { kind:'style'|'move'|'resize'|'content'|'create'|'delete'; nodeId:string; patch:Readonly<Record<string,string>>; viewport?:Viewport; }
export interface Checkpoint { id:string; beforeHash:string; afterHash:string; operation:VisualOperation; verified:boolean; }
export interface BackendBinding { nodeId:string; provider:string; capability:string; secretRefs:readonly string[]; clientExposedSecrets:false; governed:boolean; }
export interface VisualAcceptanceReceipt { projectId:string; preview:PreviewHealth; checkpoints:readonly Checkpoint[]; doctorRepairs:readonly string[]; desktopVerified:boolean; mobileVerified:boolean; unpublished:true; deploymentRequiresApproval:true; }

export function createVisualProject(input:{id:string;surface:'website'|'web_app';branch:string}):VisualProject {
 return {id:input.id,surface:input.surface,branch:input.branch,published:false,nodes:{},pages:[],assets:[],designTokens:{}};
}
export function createWorkspace(project:VisualProject,baseCommit:string):Workspace { if(!baseCommit.trim())throw new Error('WORKSPACE_BASE_COMMIT_REQUIRED');return {projectId:project.id,branch:project.branch,isolated:true,baseCommit}; }
export function previewReady(h:PreviewHealth):boolean { return h.compiled&&h.runtimeHealthy&&h.consoleErrors.length===0; }
export function selectNode(project:VisualProject,nodeId:string):Selection { const n=project.nodes[nodeId];if(!n)throw new Error('VISUAL_NODE_NOT_FOUND');return {nodeId,sourcePath:n.sourcePath}; }
export function applyVisualOperation(project:VisualProject,op:VisualOperation):VisualProject {
 const node=project.nodes[op.nodeId];if(!node)throw new Error('VISUAL_NODE_NOT_FOUND');
 const next:VisualNode=op.viewport?{...node,responsive:{...node.responsive,[op.viewport]:{...(node.responsive[op.viewport]??{}),...op.patch}}}:{...node,styles:{...node.styles,...op.patch}};
 return {...project,nodes:{...project.nodes,[op.nodeId]:next}};
}
export function conversationalVisualOperation(selection:Selection,message:string,viewport?:Viewport):VisualOperation {
 const q=message.toLowerCase(),patch:Record<string,string>={};
 if(q.includes('blue'))patch.color='blue'; if(q.includes('taller'))patch.minHeight='120%'; if(q.includes('smaller'))patch.scale='.9';
 if(!Object.keys(patch).length)throw new Error('VISUAL_EDIT_UNRESOLVED');
 return {kind:'style',nodeId:selection.nodeId,patch,viewport};
}
export function assertResponsive(project:VisualProject,nodeId:string):void {const n=project.nodes[nodeId];if(!n)throw new Error('VISUAL_NODE_NOT_FOUND');if(!n.responsive.mobile)throw new Error('MOBILE_BEHAVIOR_UNVERIFIED');}
export function reuseComponent(project:VisualProject,name:string):VisualNode|undefined {return Object.values(project.nodes).find(n=>n.kind==='component'&&n.name===name);}
export function addAsset(project:VisualProject,asset:string):VisualProject {return {...project,assets:[...new Set([...project.assets,asset])]};}
export function bindBackend(input:Omit<BackendBinding,'clientExposedSecrets'|'governed'>):BackendBinding {return {...input,clientExposedSecrets:false,governed:input.secretRefs.length>0||/auth|database|storage/i.test(input.capability)};}
export function createCheckpoint(input:{id:string;beforeHash:string;afterHash:string;operation:VisualOperation;verified:boolean}):Checkpoint {if(input.beforeHash===input.afterHash)throw new Error('CHECKPOINT_NO_CHANGE');return input;}
export function verifyVisualAcceptance(input:{project:VisualProject;preview:PreviewHealth;checkpoints:readonly Checkpoint[];doctorRepairs:readonly string[]}):VisualAcceptanceReceipt {
 const verified=previewReady(input.preview)&&input.preview.accessibilityViolations.length===0&&input.preview.responsiveFailures.length===0&&input.checkpoints.every(c=>c.verified);
 return {projectId:input.project.id,preview:input.preview,checkpoints:input.checkpoints,doctorRepairs:input.doctorRepairs,desktopVerified:verified,mobileVerified:verified,unpublished:true,deploymentRequiresApproval:true};
}

/**
 * PURSE-MCP.28. The staged PR chain must be reviewed in order. A green CI
 * badge on an unmerged draft is not proof of deployment or wallet authority.
 */
export const PHANTOM_READONLY_STACK = Object.freeze([
  {pr:1231,base:'main',head:'feat/purse-phantom-mcp-readonly-20261012'},
  {pr:1232,base:'feat/purse-phantom-mcp-readonly-20261012',head:'feat/purse-phantom-mcp-05-08-20261012'},
  {pr:1233,base:'feat/purse-phantom-mcp-05-08-20261012',head:'feat/purse-phantom-mcp-09-12-20261012'},
  {pr:1234,base:'feat/purse-phantom-mcp-09-12-20261012',head:'feat/purse-phantom-mcp-13-16-20261012'},
  {pr:1239,base:'feat/purse-phantom-mcp-13-16-20261012',head:'feat/purse-phantom-mcp-17-20-20261012'},
] as const)
type Stage = Readonly<{
  pr:number
  base:string
  head:string
  draft:boolean
  merged:boolean
  exactHeadCi:'PASS'|'FAIL'|'PENDING'|'UNKNOWN'
  independentReview:'APPROVED'|'PENDING'
}>
export function evaluatePhantomMergeReadiness(input:Readonly<{
  stages: readonly Stage[]
  nextPr: Stage
  hostReadOnlyCommissioned: boolean
  externalRestoreIndependentlyVerified: boolean
  realPhantomReadbackVerified: boolean
}>){
  const stages=[...PHANTOM_READONLY_STACK,{pr:input.nextPr.pr,base:PHANTOM_READONLY_STACK[4].head,head:input.nextPr.head}]
  const report=[...input.stages,input.nextPr]
  const reasons:string[]=[]
  for(const expected of stages){
    const found=report.filter(x=>x.pr===expected.pr)
    if(found.length!==1 || found[0]!.base!==expected.base || found[0]!.head!==expected.head){
      reasons.push('PHANTOM_STACK_TOPOLOGY_INVALID:'+expected.pr)
      continue
    }
    const stage=found[0]!
    if(stage.draft || !stage.merged)reasons.push('PHANTOM_STACK_UNMERGED:'+expected.pr)
    if(stage.exactHeadCi!=='PASS')reasons.push('PHANTOM_STACK_CI_NOT_PASS:'+expected.pr)
    if(stage.independentReview!=='APPROVED')reasons.push('PHANTOM_STACK_REVIEW_PENDING:'+expected.pr)
  }
  if(report.length!==stages.length)reasons.push('PHANTOM_STACK_EXTRA_OR_MISSING_BRANCH')
  if(!input.hostReadOnlyCommissioned)reasons.push('PHANTOM_HOST_RUNTIME_NOT_CERTIFIED')
  if(!input.externalRestoreIndependentlyVerified)reasons.push('PHANTOM_EXTERNAL_RESTORE_NOT_VERIFIED')
  if(!input.realPhantomReadbackVerified)reasons.push('PHANTOM_REAL_READBACK_NOT_VERIFIED')
  return Object.freeze({
    status:reasons.length?'BLOCKED' as const:'READY_FOR_INDEPENDENT_READONLY_RELEASE_REVIEW' as const,
    blockers:Object.freeze(reasons),
    canExecute:false as const,
    canFundWallet:false as const,
    canAuthorizeTrading:false as const,
    finalDeploymentCertified:false as const,
    authority:'RELEASE_EVIDENCE_ONLY' as const,
  })
}

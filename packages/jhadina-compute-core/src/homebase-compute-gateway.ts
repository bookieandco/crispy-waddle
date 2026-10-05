import type {ComputeSubmissionReceipt} from './execution-contract.js';
import type {
  OneRuntimeComputeBinding,
  OneRuntimeTaskDescriptor,
} from './one-runtime-bridge.js';

export type HomebaseComputeTrustDomain='homebase'|'remote-homebase';

export type DirectorPostGatewayDescriptor=Readonly<{
  taskId:string;
  capability:string;
  workerProfileId:string;
  computeBinding:OneRuntimeComputeBinding;
}>;

export type DirectorPostGatewaySubmission=Readonly<{
  projectId:string;
  ownerUserId:string;
  task:OneRuntimeTaskDescriptor;
  descriptor:DirectorPostGatewayDescriptor;
}>;

export type HomebaseComputeGatewayHealth=Readonly<{
  productionReady:boolean;
  authority:'CANONICAL_COMPUTE_SUBMISSION';
  trustDomain:HomebaseComputeTrustDomain;
  reasons:readonly string[];
}>;

export interface HomebaseComputeAdmissionRuntime{
  readiness():Promise<Readonly<{ready:boolean;reasons:readonly string[]}>>;
  submit(input:DirectorPostGatewaySubmission):Promise<ComputeSubmissionReceipt>;
}

export interface HomebaseComputeGatewayAuthenticator{
  authorizeBearer(token:string):Promise<boolean>;
}

export type HomebaseComputeGatewayRequest=Readonly<{
  method:string;
  path:string;
  authorization?:string;
  body?:unknown;
}>;

export type HomebaseComputeGatewayResponse=Readonly<{
  status:number;
  body:unknown;
}>;

function object(value:unknown):Record<string,unknown>{
  return value&&typeof value==='object'&&!Array.isArray(value)
    ?value as Record<string,unknown>
    :{};
}

function nonEmpty(value:unknown):value is string{
  return typeof value==='string'&&Boolean(value.trim());
}

function submissionFromUnknown(value:unknown):DirectorPostGatewaySubmission{
  const body=object(value);
  const projectId=body.projectId;
  const ownerUserId=body.ownerUserId;
  const task=object(body.task);
  const descriptor=object(body.descriptor);
  const binding=object(descriptor.computeBinding);
  const constraints=object(binding.constraints);

  if(!nonEmpty(projectId))throw new Error('HOMEBASE_COMPUTE_PROJECT_ID_REQUIRED');
  if(!nonEmpty(ownerUserId))throw new Error('HOMEBASE_COMPUTE_OWNER_REQUIRED');
  if(!nonEmpty(task.id)||!nonEmpty(task.workSessionId)||!nonEmpty(task.idempotencyKey)){
    throw new Error('HOMEBASE_COMPUTE_TASK_LINEAGE_REQUIRED');
  }
  if(!nonEmpty(task.domain)||!nonEmpty(task.capability)||!nonEmpty(task.status)||!nonEmpty(task.createdAt)){
    throw new Error('HOMEBASE_COMPUTE_TASK_DESCRIPTOR_REQUIRED');
  }
  if(!nonEmpty(descriptor.taskId)||!nonEmpty(descriptor.capability)||!nonEmpty(descriptor.workerProfileId)){
    throw new Error('HOMEBASE_COMPUTE_DESCRIPTOR_REQUIRED');
  }
  if(!nonEmpty(binding.source)||!nonEmpty(binding.kind)||!nonEmpty(binding.resourceProfileId)){
    throw new Error('HOMEBASE_COMPUTE_BINDING_REQUIRED');
  }

  const normalizedTask:OneRuntimeTaskDescriptor={
    id:task.id,
    workSessionId:task.workSessionId,
    domain:task.domain,
    capability:task.capability,
    idempotencyKey:task.idempotencyKey,
    status:task.status,
    createdAt:task.createdAt,
    ...(nonEmpty(task.leaseOwner)?{leaseOwner:task.leaseOwner}:{}),
    ...(nonEmpty(task.leaseToken)?{leaseToken:task.leaseToken}:{}),
    ...(nonEmpty(task.leaseExpiresAt)?{leaseExpiresAt:task.leaseExpiresAt}:{}),
    ...(nonEmpty(task.updatedAt)?{updatedAt:task.updatedAt}:{}),
  };

  const computeBinding:OneRuntimeComputeBinding={
    source:binding.source as OneRuntimeComputeBinding['source'],
    kind:binding.kind as OneRuntimeComputeBinding['kind'],
    resourceProfileId:binding.resourceProfileId,
    ...(nonEmpty(binding.queue)?{queue:binding.queue as OneRuntimeComputeBinding['queue']}:{}),
    ...(typeof binding.requestedPriority==='number'?{requestedPriority:binding.requestedPriority}:{}),
    constraints:{
      sensitiveData:constraints.sensitiveData===true,
      allowCloudBurst:constraints.allowCloudBurst===true,
      ...(typeof constraints.maxCostUsdPerHour==='number'
        ?{maxCostUsdPerHour:constraints.maxCostUsdPerHour}
        :{}),
    },
    ...(Array.isArray(binding.dataLocalityKeys)
      ?{dataLocalityKeys:binding.dataLocalityKeys.map(String)}
      :{}),
    ...(Array.isArray(binding.preferredNodeIds)
      ?{preferredNodeIds:binding.preferredNodeIds.map(String)}
      :{}),
    ...(Array.isArray(binding.forbiddenNodeIds)
      ?{forbiddenNodeIds:binding.forbiddenNodeIds.map(String)}
      :{}),
  };

  return Object.freeze({
    projectId,
    ownerUserId,
    task:Object.freeze(normalizedTask),
    descriptor:Object.freeze({
      taskId:descriptor.taskId,
      capability:descriptor.capability,
      workerProfileId:descriptor.workerProfileId,
      computeBinding:Object.freeze(computeBinding),
    }),
  });
}

export class HomebaseComputeGateway{
  readonly authority='CANONICAL_COMPUTE_SUBMISSION' as const;

  constructor(
    readonly trustDomain:HomebaseComputeTrustDomain,
    private readonly runtime:HomebaseComputeAdmissionRuntime,
    private readonly authenticator:HomebaseComputeGatewayAuthenticator,
    private readonly now:()=>string=()=>new Date().toISOString(),
  ){
    if(trustDomain!=='homebase'&&trustDomain!=='remote-homebase'){
      throw new Error('HOMEBASE_COMPUTE_TRUST_DOMAIN_INVALID');
    }
  }

  async health():Promise<HomebaseComputeGatewayHealth>{
    const health=await this.runtime.readiness();
    return Object.freeze({
      productionReady:health.ready===true,
      authority:this.authority,
      trustDomain:this.trustDomain,
      reasons:Object.freeze([...health.reasons]),
    });
  }

  async submit(input:DirectorPostGatewaySubmission):Promise<ComputeSubmissionReceipt>{
    this.validateDirectorPostSubmission(input);
    const health=await this.runtime.readiness();
    if(!health.ready){
      throw new Error('HOMEBASE_COMPUTE_NOT_PRODUCTION_READY:'+health.reasons.join(','));
    }
    const receipt=await this.runtime.submit(input);
    this.validateReceipt(input,receipt);
    return receipt;
  }

  async handle(request:HomebaseComputeGatewayRequest):Promise<HomebaseComputeGatewayResponse>{
    const authorization=request.authorization??'';
    if(!authorization.startsWith('Bearer ')){
      return Object.freeze({status:401,body:Object.freeze({error:'unauthorized'})});
    }
    const token=authorization.slice(7).trim();
    if(!token||!await this.authenticator.authorizeBearer(token)){
      return Object.freeze({status:401,body:Object.freeze({error:'unauthorized'})});
    }
    if(request.method==='GET'&&request.path==='/health'){
      const health=await this.health();
      return Object.freeze({status:health.productionReady?200:503,body:health});
    }
    if(request.method==='POST'&&request.path==='/v1/director/post-submissions'){
      try{
        const input=submissionFromUnknown(request.body);
        const receipt=await this.submit(input);
        return Object.freeze({status:202,body:Object.freeze({receipt})});
      }catch(error){
        const message=error instanceof Error?error.message:String(error);
        const status=/REQUIRED|MISMATCH|INVALID|FORBIDDEN|ACTIVE_LEASE/.test(message)
          ?409
          :/NOT_PRODUCTION_READY/.test(message)
            ?503
            :500;
        return Object.freeze({
          status,
          body:Object.freeze({error:message}),
        });
      }
    }
    return Object.freeze({status:404,body:Object.freeze({error:'not_found'})});
  }

  private validateDirectorPostSubmission(input:DirectorPostGatewaySubmission):void{
    if(!input.projectId.trim()||!input.ownerUserId.trim()){
      throw new Error('HOMEBASE_COMPUTE_PROJECT_OWNER_REQUIRED');
    }
    if(input.descriptor.taskId!==input.task.id){
      throw new Error('HOMEBASE_COMPUTE_DESCRIPTOR_TASK_MISMATCH');
    }
    if(input.descriptor.capability!==input.task.capability){
      throw new Error('HOMEBASE_COMPUTE_DESCRIPTOR_CAPABILITY_MISMATCH');
    }
    if(
      input.task.status!=='running'||
      !input.task.leaseOwner?.trim()||
      !input.task.leaseToken?.trim()||
      !input.task.leaseExpiresAt||
      Date.parse(input.task.leaseExpiresAt)<=Date.parse(this.now())
    ){
      throw new Error('HOMEBASE_COMPUTE_ACTIVE_LEASE_REQUIRED');
    }
    const constraints=input.descriptor.computeBinding.constraints;
    if(constraints?.sensitiveData!==true){
      throw new Error('HOMEBASE_COMPUTE_DIRECTOR_SENSITIVE_BINDING_REQUIRED');
    }
    if(constraints?.allowCloudBurst===true){
      throw new Error('HOMEBASE_COMPUTE_DIRECTOR_PUBLIC_CLOUD_BURST_FORBIDDEN');
    }
  }

  private validateReceipt(
    input:DirectorPostGatewaySubmission,
    receipt:ComputeSubmissionReceipt,
  ):void{
    if(receipt.provider!=='kubernetes'){
      throw new Error('HOMEBASE_COMPUTE_PROVIDER_INVALID');
    }
    if(receipt.userId!==input.ownerUserId){
      throw new Error('HOMEBASE_COMPUTE_RECEIPT_OWNER_MISMATCH');
    }
    if(receipt.workSessionId!==input.task.workSessionId){
      throw new Error('HOMEBASE_COMPUTE_RECEIPT_SESSION_MISMATCH');
    }
    if(receipt.taskId!==input.task.id){
      throw new Error('HOMEBASE_COMPUTE_RECEIPT_TASK_MISMATCH');
    }
    if(receipt.idempotencyKey!==input.task.idempotencyKey){
      throw new Error('HOMEBASE_COMPUTE_RECEIPT_IDEMPOTENCY_MISMATCH');
    }
    for(const value of [
      receipt.submissionId,
      receipt.actionRequestId,
      receipt.workloadId,
      receipt.namespace,
      receipt.queueName,
      receipt.resourceName,
      receipt.plannedNodeId,
      receipt.primaryStorageBackendId,
      receipt.submittedAt,
      receipt.manifestFingerprint,
    ]){
      if(!value.trim())throw new Error('HOMEBASE_COMPUTE_RECEIPT_IDENTITY_REQUIRED');
    }
  }
}

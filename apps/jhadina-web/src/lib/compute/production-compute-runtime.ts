import {
  KubernetesApiJobTransport,
  KubernetesComputeSubmitter,
  type FetchLike,
  type KubernetesSubmissionConfig,
} from '@jhadina/compute-core';
import {
  ComputeSubmitActionHandler,
} from './compute-action-handler';
import {
  SupabaseComputeExecutionRepository,
  type ComputeReceiptRpcClient,
} from './supabase-compute-execution-repository';

export type ProductionComputeHandlerOptions={
  supabase:ComputeReceiptRpcClient;
  kubernetes:{
    baseUrl:string;
    bearerToken:string;
    fetchImpl?:FetchLike;
  };
  submission:KubernetesSubmissionConfig;
  now?:()=>string;
  permitTtlMs?:number;
};

export function createProductionComputeSubmitActionHandler(
  options:ProductionComputeHandlerOptions,
):ComputeSubmitActionHandler{
  const now=options.now??(()=>new Date().toISOString());
  const repository=new SupabaseComputeExecutionRepository(options.supabase);
  const transport=new KubernetesApiJobTransport({
    baseUrl:options.kubernetes.baseUrl,
    bearerToken:options.kubernetes.bearerToken,
    fetchImpl:options.kubernetes.fetchImpl,
  });
  const submitter=new KubernetesComputeSubmitter(
    transport,
    options.submission,
    repository,
    now,
  );
  return new ComputeSubmitActionHandler(
    submitter,
    now,
    options.permitTtlMs??60_000,
  );
}

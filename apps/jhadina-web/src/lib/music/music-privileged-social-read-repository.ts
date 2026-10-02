import type {SupabaseClient} from '@supabase/supabase-js';
import type {
  SocialAccount,
  SocialObservation,
  SocialPlatform,
  JhadinaBrand,
  SocialPublishTarget,
} from '@jhadina/social-core';
import type {SocialRepository} from '../social/repository';

type Row=Record<string,unknown>;

export function createPrivilegedSocialReadRepository(
  client:SupabaseClient,
  ownerUserId:string,
):SocialRepository{
  const owner=ownerUserId.trim();
  if(!owner)throw new Error('SOCIAL_PRIVILEGED_OWNER_REQUIRED');

  return {
    async listAccounts(userId){
      assertOwner(userId,owner);
      const {data,error}=await client.from('jhadina_social_accounts').select('*')
        .eq('user_id',owner).order('created_at',{ascending:true});
      if(error)throw new Error('SOCIAL_PRIVILEGED_ACCOUNTS_READ_FAILED:'+error.message);
      return ((data??[]) as Row[]).map(accountFromRow);
    },
    async resolveTargets(userId,brand,accountIds){
      assertOwner(userId,owner);
      if(!accountIds.length)throw new Error('SOCIAL_TARGETS_REQUIRED');
      const {data,error}=await client.from('jhadina_social_accounts').select('*')
        .eq('user_id',owner).eq('brand',brand).eq('status','connected').in('id',[...accountIds]);
      if(error)throw new Error('SOCIAL_PRIVILEGED_TARGETS_READ_FAILED:'+error.message);
      const rows=(data??[]) as Row[];
      if(rows.length!==new Set(accountIds).size)throw new Error('SOCIAL_TARGET_OWNERSHIP_OR_BRAND_MISMATCH');
      return rows.map(targetFromRow);
    },
    async listObservations(userId){
      assertOwner(userId,owner);
      const {data,error}=await client.from('jhadina_social_observations').select('*')
        .eq('user_id',owner).order('observed_at',{ascending:false});
      if(error)throw new Error('SOCIAL_PRIVILEGED_OBSERVATIONS_READ_FAILED:'+error.message);
      return ((data??[]) as Row[]).map(observationFromRow);
    },

    async registerAccount(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:registerAccount');},
    async createProposal(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:createProposal');},
    async attachApprovalReceipt(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:attachApprovalReceipt');},
    async getProposal(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:getProposal');},
    async listProposals(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:listProposals');},
    async enqueueOutbox(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:enqueueOutbox');},
    async listOutbox(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:listOutbox');},
    async beginOutboxAttempt(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:beginOutboxAttempt');},
    async completeOutbox(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:completeOutbox');},
    async failOutbox(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:failOutbox');},
    async recordObservation(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:recordObservation');},
    async createPublishCanary(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:createPublishCanary');},
    async getPublishCanary(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:getPublishCanary');},
    async listPublishCanaryReceipts(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:listPublishCanaryReceipts');},
    async capturePublishCanaryOutboxReceipt(){throw new Error('SOCIAL_PRIVILEGED_READ_ONLY:capturePublishCanaryOutboxReceipt');},
  };
}

function accountFromRow(row:Row):SocialAccount{
  return {
    id:String(row.id),
    userId:String(row.user_id),
    brand:String(row.brand) as JhadinaBrand,
    provider:String(row.provider),
    providerProfileId:String(row.provider_profile_id),
    platform:String(row.platform) as SocialPlatform,
    displayName:String(row.display_name),
    handle:text(row.handle),
    status:String(row.status) as SocialAccount['status'],
    createdAt:String(row.created_at),
    updatedAt:String(row.updated_at),
  };
}
function targetFromRow(row:Row):SocialPublishTarget{
  return {
    accountId:String(row.id),
    brand:String(row.brand) as JhadinaBrand,
    provider:String(row.provider),
    providerProfileId:String(row.provider_profile_id),
    platform:String(row.platform) as SocialPlatform,
  };
}
function observationFromRow(row:Row):SocialObservation{
  return {
    id:String(row.id),
    userId:String(row.user_id),
    kind:String(row.kind) as SocialObservation['kind'],
    source:String(row.source),
    provider:text(row.provider),
    platform:String(row.platform) as SocialPlatform,
    accountId:text(row.account_id),
    providerProfileId:text(row.provider_profile_id),
    contentId:text(row.content_id),
    proposalId:text(row.proposal_id),
    outboxId:text(row.outbox_id),
    observedAt:String(row.observed_at),
    sourceUrl:text(row.source_url),
    evidence:Array.isArray(row.evidence)?row.evidence.map(String).filter(Boolean):[],
    metrics:recordNumbers(row.metrics),
    attributes:recordAttributes(row.attributes),
  };
}
function assertOwner(value:string,owner:string):void{
  if(value!==owner)throw new Error('SOCIAL_PRIVILEGED_OWNER_MISMATCH');
}
function text(value:unknown):string|undefined{
  return typeof value==='string'&&value.trim()?value:undefined;
}
function recordNumbers(value:unknown):Record<string,number>{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const out:Record<string,number>={};
  for(const [key,raw] of Object.entries(value as Row)){
    const n=Number(raw);if(Number.isFinite(n))out[key]=n;
  }
  return out;
}
function recordAttributes(value:unknown):Record<string,string|number|boolean|null>{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const out:Record<string,string|number|boolean|null>={};
  for(const [key,raw] of Object.entries(value as Row)){
    if(raw===null||typeof raw==='string'||typeof raw==='number'||typeof raw==='boolean')out[key]=raw;
  }
  return out;
}

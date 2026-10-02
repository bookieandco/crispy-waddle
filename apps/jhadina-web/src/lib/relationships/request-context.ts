import {requireRequestIdentity} from '@/lib/auth/request-user'
import {createServiceRoleClient} from '@/lib/supabase/service-role'
import {ProductionRelationshipRepository} from './production-repository'

export async function createRelationshipRequestContext(){
  const identity=await requireRequestIdentity()
  const client=createServiceRoleClient()
  if(!client)throw new Error('RELATIONSHIP_STORAGE_NOT_CONFIGURED')
  return {
    identity,
    client,
    repo:new ProductionRelationshipRepository(client,identity.userId),
  }
}

export function relationshipApiError(error:unknown){
  const message=error instanceof Error?error.message:'RELATIONSHIP_REQUEST_FAILED'
  const status=/Authenticated|IDENTITY|session/i.test(message)?401:
    /NOT_FOUND/.test(message)?404:
    /REQUIRED|INVALID/.test(message)?400:503
  return {message,status}
}

import "server-only"

import {
  SUPLIFUL_SHOPIFY_FULFILLMENT_SERVICE,
  assertSuplifulShopifyProductBinding,
  type SuplifulShopifyProductBinding,
  type SuplifulShopifyProductBindingResolver,
} from "@jhadina/commerce-adapters"
import { createServiceRoleClient } from "../supabase/service-role"

export interface SuplifulShopifyProductBindingRecordInput {
  userId:string
  binding:SuplifulShopifyProductBinding
  evidenceRefs:string[]
}

type BindingRow={
  internal_product_id:string
  internal_variant_id:string
  shopify_product_gid:string
  shopify_variant_gid:string
  sku:string|null
  fulfillment_service_name:string
  observed_at:string
}

export interface SuplifulShopifyProductBindingVault
extends SuplifulShopifyProductBindingResolver{
  recordBinding(input:SuplifulShopifyProductBindingRecordInput):Promise<void>
}

export function createSuplifulShopifyProductBindingVault():
SuplifulShopifyProductBindingVault{
  return{
    async recordBinding(input){
      const client=createServiceRoleClient()
      if(!client)throw new Error("SUPLIFUL_BINDING_VAULT_NOT_CONFIGURED")
      const userId=requireText(input.userId,"userId")
      assertSuplifulShopifyProductBinding(input.binding)
      const evidenceRefs=uniqueEvidence(input.evidenceRefs)
      const{error}=await client
        .from("jhadina_supliful_shopify_product_bindings")
        .upsert({
          user_id:userId,
          internal_product_id:input.binding.internalProductId,
          internal_variant_id:input.binding.internalVariantId,
          shopify_product_gid:input.binding.shopifyProductGid,
          shopify_variant_gid:input.binding.shopifyVariantGid,
          sku:input.binding.sku?.trim()||null,
          fulfillment_service_name:SUPLIFUL_SHOPIFY_FULFILLMENT_SERVICE,
          evidence_refs:evidenceRefs,
          observed_at:new Date(input.binding.observedAt).toISOString(),
          updated_at:new Date().toISOString(),
        },{
          onConflict:"user_id,internal_product_id,internal_variant_id",
        })
      if(error)throw new Error(`SUPLIFUL_BINDING_STORE_FAILED:${error.message}`)
    },

    async resolveProductBinding(input){
      const client=createServiceRoleClient()
      if(!client)throw new Error("SUPLIFUL_BINDING_VAULT_NOT_CONFIGURED")
      const userId=requireText(input.actorId,"actorId")
      const internalProductId=requireText(input.internalProductId,"internalProductId")
      const internalVariantId=requireText(input.internalVariantId,"internalVariantId")

      const{data,error}=await client
        .from("jhadina_supliful_shopify_product_bindings")
        .select("internal_product_id,internal_variant_id,shopify_product_gid,shopify_variant_gid,sku,fulfillment_service_name,observed_at")
        .eq("user_id",userId)
        .eq("internal_product_id",internalProductId)
        .eq("internal_variant_id",internalVariantId)
        .maybeSingle<BindingRow>()
      if(error)throw new Error(`SUPLIFUL_BINDING_READ_FAILED:${error.message}`)
      if(!data)return null
      const binding:SuplifulShopifyProductBinding={
        internalProductId:data.internal_product_id,
        internalVariantId:data.internal_variant_id,
        shopifyProductGid:data.shopify_product_gid,
        shopifyVariantGid:data.shopify_variant_gid,
        sku:data.sku??undefined,
        fulfillmentServiceName:data.fulfillment_service_name,
        observedAt:new Date(data.observed_at).toISOString(),
      }
      assertSuplifulShopifyProductBinding(binding)
      return binding
    },
  }
}

function uniqueEvidence(values:readonly string[]):string[]{
  const refs=[...new Set(values.map(value=>value.trim()).filter(Boolean))]
  if(!refs.length)throw new Error("Supliful binding evidenceRefs are required")
  return refs
}

function requireText(value:string,field:string):string{
  if(typeof value!=="string"||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}

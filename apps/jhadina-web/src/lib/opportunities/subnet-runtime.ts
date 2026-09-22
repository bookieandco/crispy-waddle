import type { SupabaseClient } from '@supabase/supabase-js'
import { scanSubnetListings } from './subnet-client'

export async function runSubnetScan(client:SupabaseClient,input:{maxPages?:number;state?:string}={}){
  const runId=crypto.randomUUID()
  const startedAt=new Date().toISOString()
  const {error:startError}=await client.from('jhadina_subnet_scan_runs').insert({
    id:runId,status:'running',started_at:startedAt,
  })
  if(startError)throw new Error('SUBNET_SCAN_RUN_START_FAILED: '+startError.message)

  try{
    const result=await scanSubnetListings(input)
    const seenAt=new Date().toISOString()
    const catalogRows=result.records.map(record=>({
      external_id:record.externalId,
      title:record.title,
      prime_name:record.primeName,
      description:record.description??null,
      closing_date:record.closingDate??null,
      performance_start_date:record.performanceStartDate??null,
      place_of_performance:record.placeOfPerformance??null,
      naics_code:record.naicsCode??null,
      naics_label:record.naicsLabel??null,
      contact_name:record.contactName??null,
      contact_email:record.contactEmail??null,
      contact_phone:record.contactPhone??null,
      source_url:record.sourceUrl,
      source_page:record.sourcePage,
      raw:record,
      last_seen_at:seenAt,
      updated_at:seenAt,
    }))

    if(catalogRows.length){
      const {error}=await client.from('jhadina_subnet_catalog').upsert(catalogRows,{
        onConflict:'external_id',
        ignoreDuplicates:false,
        defaultToNull:false,
      })
      if(error)throw new Error('SUBNET_CATALOG_UPSERT_FAILED: '+error.message)
    }

    const receipt={
      runId,
      source:'SBA SUBNet',
      pages:result.pages,
      recordsSeen:result.records.length,
      truncated:result.truncated,
      startedAt,
      completedAt:new Date().toISOString(),
    }
    const {error:finishError}=await client.from('jhadina_subnet_scan_runs').update({
      status:'completed',
      pages_fetched:receipt.pages,
      records_seen:receipt.recordsSeen,
      truncated:receipt.truncated,
      completed_at:receipt.completedAt,
    }).eq('id',runId)
    if(finishError)throw new Error('SUBNET_SCAN_RUN_COMPLETE_FAILED: '+finishError.message)
    return receipt
  }catch(error){
    const completedAt=new Date().toISOString()
    await client.from('jhadina_subnet_scan_runs').update({
      status:'failed',
      error:error instanceof Error?error.message:'unknown_error',
      completed_at:completedAt,
    }).eq('id',runId)
    throw error
  }
}

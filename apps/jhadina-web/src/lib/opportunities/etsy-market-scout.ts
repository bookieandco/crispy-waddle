import { createHash } from 'node:crypto'
import type { VentureMarketSignal } from '@jhadina/opportunity-core'
import type { VentureScoutInboxRecord } from './venture-runtime-repository'

const ETSY_API_ORIGIN='https://api.etsy.com/v3/application'

type EtsyListing={
  listing_id:number
  shop_id:number
  title:string
  url?:string
  num_favorers?:number
  created_timestamp?:number
  original_creation_timestamp?:number
  is_personalizable?:boolean
}

type EtsyShop={
  shop_id:number
  shop_name:string
  created_timestamp?:number
  create_date?:number
  transaction_sold_count?:number
  review_count?:number
  review_average?:number
}

type EtsyListResponse={count?:number;results?:EtsyListing[]}

export type EtsyMarketplaceScoutResult={
  configured:boolean
  query:string
  listingsObserved:number
  shopsObserved:number
  fastGrowthShops:number
  records:VentureScoutInboxRecord[]
  rateLimit?:{
    perSecond?:number
    remainingSecond?:number
    perDay?:number
    remainingDay?:number
  }
  readOnly:true
  perListingSalesClaimed:false
  creativeAssetsFetched:false
}

export function etsyMarketplaceScoutConfigured(env:NodeJS.ProcessEnv=process.env):boolean{
  return Boolean(env.ETSY_API_KEY?.trim())
}

export async function runEtsyMarketplaceScout(input:{
  query:string
  family?:VentureScoutInboxRecord['family']
  seedId?:string
  now?:string
  minimumShopSales?:number
  maximumShopAgeDays?:number
  maxListings?:number
  maxShops?:number
  apiKey?:string
  fetchFn?:typeof fetch
}):Promise<EtsyMarketplaceScoutResult>{
  const apiKey=(input.apiKey??process.env.ETSY_API_KEY??'').trim()
  if(!apiKey)throw new Error('ETSY_API_KEY_NOT_CONFIGURED')
  const query=input.query.trim()
  if(!query)throw new Error('ETSY_QUERY_REQUIRED')

  const now=input.now??new Date().toISOString()
  if(!Number.isFinite(Date.parse(now)))throw new Error('ETSY_NOW_INVALID')
  const maxListings=boundedInt(input.maxListings??25,1,50,'maxListings')
  const maxShops=boundedInt(input.maxShops??8,1,15,'maxShops')
  const minimumShopSales=boundedInt(input.minimumShopSales??1000,0,100_000_000,'minimumShopSales')
  const maximumShopAgeDays=boundedInt(input.maximumShopAgeDays??365,1,3650,'maximumShopAgeDays')
  const family=input.family??'pod_personalized_commerce'
  const seedId=input.seedId??'pod-personalized-market'
  const fetchFn=input.fetchFn??fetch

  const listingUrl=new URL(ETSY_API_ORIGIN+'/listings/active')
  listingUrl.searchParams.set('keywords',query)
  listingUrl.searchParams.set('limit',String(maxListings))
  listingUrl.searchParams.set('sort_on','score')
  listingUrl.searchParams.set('sort_order','desc')

  const listingResponse=await fetchFn(listingUrl,{
    method:'GET',
    headers:{'x-api-key':apiKey,Accept:'application/json'},
    cache:'no-store',
  })
  if(!listingResponse.ok)throw new Error('ETSY_LISTING_SEARCH_FAILED:'+listingResponse.status)
  const listingPayload=await listingResponse.json() as EtsyListResponse
  const listings=(listingPayload.results??[])
    .filter(listing=>Number.isInteger(listing.listing_id)&&Number.isInteger(listing.shop_id)&&Boolean(listing.title?.trim()))
    .slice(0,maxListings)
  const shopIds=[...new Set(listings.map(listing=>listing.shop_id))].slice(0,maxShops)
  const shops:EtsyShop[]=[]
  let lastShopResponse:Response|undefined

  for(const shopId of shopIds){
    const response=await fetchFn(ETSY_API_ORIGIN+'/shops/'+shopId,{
      method:'GET',
      headers:{'x-api-key':apiKey,Accept:'application/json'},
      cache:'no-store',
    })
    lastShopResponse=response
    if(response.status===429)throw new Error('ETSY_RATE_LIMITED')
    if(!response.ok)continue
    const shop=await response.json() as EtsyShop
    if(Number.isInteger(shop.shop_id)&&shop.shop_name?.trim())shops.push(shop)
  }

  const listingByShop=new Map<number,EtsyListing>()
  for(const listing of listings){
    if(!listingByShop.has(listing.shop_id))listingByShop.set(listing.shop_id,listing)
  }

  const records:VentureScoutInboxRecord[]=[]
  let fastGrowthShops=0
  const nowMs=Date.parse(now)

  for(const shop of shops){
    const createdSeconds=shop.created_timestamp??shop.create_date
    const shopAgeDays=typeof createdSeconds==='number'&&createdSeconds>0
      ? Math.max(0,(nowMs-createdSeconds*1000)/86_400_000)
      : undefined
    const sold=typeof shop.transaction_sold_count==='number'?shop.transaction_sold_count:undefined
    const fastGrowth=shopAgeDays!==undefined&&sold!==undefined&&shopAgeDays<=maximumShopAgeDays&&sold>=minimumShopSales
    if(fastGrowth)fastGrowthShops+=1
    const listing=listingByShop.get(shop.shop_id)
    const sourceRef=listing?.url||'https://www.etsy.com/shop/'+encodeURIComponent(shop.shop_name)
    const common=[
      'etsy_shop_id:'+shop.shop_id,
      'shop:'+shop.shop_name,
      shopAgeDays!==undefined?'shop_age_days:'+Math.round(shopAgeDays):'shop_age_days:unknown',
      'scope:shop_level',
      'listing_sales:not_exposed_by_this_public_read_path',
    ]

    if(sold!==undefined){
      records.push(record({
        seedId,family,shop,listing,sourceRef,now,
        signal:{
          id:stableId(seedId,'shop-sales',String(shop.shop_id)),
          kind:'sales',
          sourceRef,
          observedAt:now,
          value:sold,
          unit:'shop_transaction_sold_count',
          note:[
            ...common,
            'transaction_sold_count:'+sold,
            fastGrowth?'fast_growth_filter:pass':'fast_growth_filter:not_passed',
          ].join(' — '),
          confidence:0.9,
        },
      }))
    }

    if(typeof shop.review_count==='number'){
      records.push(record({
        seedId,family,shop,listing,sourceRef,now,
        signal:{
          id:stableId(seedId,'shop-reviews',String(shop.shop_id)),
          kind:'reviews',
          sourceRef,
          observedAt:now,
          value:shop.review_count,
          unit:'shop_review_count',
          note:[
            ...common,
            'review_count:'+shop.review_count,
            typeof shop.review_average==='number'?'review_average:'+shop.review_average:'review_average:unknown',
          ].join(' — '),
          confidence:0.88,
        },
      }))
    }

    if(listing&&typeof listing.num_favorers==='number'){
      records.push(record({
        seedId,family,shop,listing,sourceRef,now,
        signal:{
          id:stableId(seedId,'listing-favorers',String(listing.listing_id)),
          kind:'platform_velocity',
          sourceRef,
          observedAt:now,
          value:listing.num_favorers,
          unit:'listing_favorers',
          note:[
            'listing_id:'+listing.listing_id,
            'shop_id:'+shop.shop_id,
            'listing_title:'+listing.title,
            'num_favorers:'+listing.num_favorers,
            'sales_attribution:not_claimed',
          ].join(' — '),
          confidence:0.82,
        },
      }))
    }
  }

  return{
    configured:true,
    query,
    listingsObserved:listings.length,
    shopsObserved:shops.length,
    fastGrowthShops,
    records,
    rateLimit:rateLimit(lastShopResponse??listingResponse),
    readOnly:true,
    perListingSalesClaimed:false,
    creativeAssetsFetched:false,
  }
}

function record(input:{
  seedId:string
  family:VentureScoutInboxRecord['family']
  shop:EtsyShop
  listing?:EtsyListing
  sourceRef:string
  now:string
  signal:VentureMarketSignal
}):VentureScoutInboxRecord{
  return{
    seedId:input.seedId,
    family:input.family,
    signal:input.signal,
    sourceUrl:input.sourceRef,
    sourceTitle:input.listing?.title?.trim()||input.shop.shop_name.trim(),
  }
}

function stableId(seedId:string,kind:string,identity:string):string{
  const digest=createHash('sha256').update(seedId+'\n'+kind+'\n'+identity).digest('hex').slice(0,24)
  return 'venture-signal:'+seedId+':etsy:'+kind+':'+digest
}

function rateLimit(response:Response):EtsyMarketplaceScoutResult['rateLimit']{
  const read=(name:string)=>{
    const value=response.headers.get(name)
    if(value===null)return undefined
    const parsed=Number(value)
    return Number.isFinite(parsed)?parsed:undefined
  }
  return{
    perSecond:read('x-limit-per-second'),
    remainingSecond:read('x-remaining-this-second')??read('x-remaining-this-secon'),
    perDay:read('x-limit-per-day'),
    remainingDay:read('x-remaining-today'),
  }
}

function boundedInt(value:number,min:number,max:number,label:string):number{
  if(!Number.isInteger(value)||value<min||value>max)throw new Error(label+' must be an integer between '+min+' and '+max)
  return value
}

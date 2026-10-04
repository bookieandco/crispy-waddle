import {describe,expect,it} from "vitest"
import {
  SHOPIFY_ADMIN_API_VERSION,
  SUPLIFUL_SHOPIFY_PROVIDER,
  ShopifyAdminGraphqlClient,
  SuplifulShopifySupplierProcurementAdapter,
  suplifulShopifySourceIdentifier,
  type SuplifulShopifyAdminClient,
  type SuplifulShopifyPaidOrderResolver,
  type SuplifulShopifyRemoteOrder,
  type SupplierOfferSnapshot,
} from "@jhadina/commerce-adapters"

const now="2026-10-03T23:00:00.000Z"

function offer():SupplierOfferSnapshot{
  return{
    provider:SUPLIFUL_SHOPIFY_PROVIDER,
    connectionId:"shopify:store-1",
    supplierId:"supliful",
    productId:"product-1",
    inventoryId:"inventory-1",
    title:"Private-label product",
    externalProduct:{provider:"shopify",externalId:"gid://shopify/ProductVariant/456"},
    unitAmountMinor:1200,
    shippingAmountMinor:500,
    currency:"USD",
    availableQuantity:10,
    estimatedDeliveryDays:7,
    supplierRiskScore:.1,
    destinationCountries:["US","CA"],
    observedAt:now,
  }
}

function remoteOrder(sourceIdentifier:string,overrides:Partial<SuplifulShopifyRemoteOrder>={}):SuplifulShopifyRemoteOrder{
  return{
    id:"gid://shopify/Order/789",
    name:"#1001",
    createdAt:"2026-10-03T23:02:00.000Z",
    updatedAt:"2026-10-03T23:03:00.000Z",
    displayFinancialStatus:"PAID",
    displayFulfillmentStatus:"UNFULFILLED",
    sourceIdentifier,
    customAttributes:[
      {key:"jhadina_internal_order_id",value:"order-1"},
      {key:"jhadina_internal_order_item_id",value:"item-1"},
      {key:"jhadina_supplier_id",value:"supliful"},
      {key:"jhadina_connection_id",value:"shopify:store-1"},
      {key:"jhadina_product_id",value:"product-1"},
      {key:"jhadina_inventory_id",value:"inventory-1"},
      {key:"jhadina_quantity",value:"2"},
      {key:"jhadina_source_identifier",value:sourceIdentifier},
    ],
    fulfillments:[],
    fulfillmentOrders:[],
    ...overrides,
  }
}

function fixture(options:{existing?:SuplifulShopifyRemoteOrder|null;failCreateAfterPersist?:boolean}={}){
  const sourceIdentifier=suplifulShopifySourceIdentifier("supplier-procurement:order-1:item-1")
  let stored=options.existing??null
  let resolverCalls=0
  let createCalls=0

  const client:SuplifulShopifyAdminClient={
    async findOrderBySourceIdentifier(value){
      expect(value).toBe(sourceIdentifier)
      return stored
    },
    async createPaidOrder(input){
      createCalls+=1
      expect(input).toMatchObject({
        sourceIdentifier,
        internalOrderId:"order-1",
        internalOrderItemId:"item-1",
        supplierId:"supliful",
        connectionId:"shopify:store-1",
        productId:"product-1",
        inventoryId:"inventory-1",
        variantGid:"gid://shopify/ProductVariant/456",
        quantity:2,
        customerEmail:"buyer@example.com",
      })
      stored=remoteOrder(sourceIdentifier)
      if(options.failCreateAfterPersist)throw new Error("synthetic transport timeout")
      return stored
    },
  }
  const resolver:SuplifulShopifyPaidOrderResolver={
    async resolvePaidOrder(input){
      resolverCalls+=1
      expect(input).toEqual({
        actorId:"user-1",
        internalOrderId:"order-1",
        internalOrderItemId:"item-1",
      })
      return{
        internalOrderId:"order-1",
        customerEmail:"buyer@example.com",
        customerPhone:"+15555550101",
        shippingAddress:{
          name:"Buyer Example",
          address1:"1 Test Way",
          city:"Los Angeles",
          provinceCode:"CA",
          countryCode:"US",
          zip:"90001",
        },
        paidAt:"2026-10-03T22:55:00.000Z",
        paymentEvidenceRefs:["payment:stripe:1"],
      }
    },
  }

  const adapter=new SuplifulShopifySupplierProcurementAdapter({
    client,
    paidOrderResolver:resolver,
    now:()=>new Date(now),
  })
  return{
    adapter,
    sourceIdentifier,
    counts:()=>({resolverCalls,createCalls}),
  }
}

async function preview(adapter:SuplifulShopifySupplierProcurementAdapter){
  return adapter.prepare({
    actorId:"user-1",
    opportunityId:"opportunity-1",
    researchCaseId:"research-1",
    evidenceRefs:["evidence:offer","evidence:terms"],
    internalOrderId:"order-1",
    internalOrderItemId:"item-1",
    quantity:2,
    destinationCountry:"US",
    idempotencyKey:"supplier-procurement:order-1:item-1",
    offer:offer(),
  })
}

describe("Supliful Shopify procurement adapter",()=>{
  it("keeps customer PII out of the approval preview",async()=>{
    const f=fixture()
    const p=await preview(f.adapter)
    expect(p.actorId).toBe("user-1")
    expect(p.totalAmountMinor).toBe(2900)
    expect(JSON.stringify(p)).not.toContain("buyer@example.com")
    expect(JSON.stringify(p)).not.toContain("1 Test Way")
    expect(f.counts()).toEqual({resolverCalls:0,createCalls:0})
  })

  it("resolves paid-order PII only during approved submit",async()=>{
    const f=fixture()
    const result=await f.adapter.submit(await preview(f.adapter))
    expect(result).toMatchObject({
      status:"confirmed",
      supplierId:"supliful",
      connectionId:"shopify:store-1",
      productId:"product-1",
      inventoryId:"inventory-1",
      quantity:2,
      internalOrderId:"order-1",
      internalOrderItemId:"item-1",
      externalOrder:{provider:"shopify",externalId:"gid://shopify/Order/789"},
    })
    expect(f.counts()).toEqual({resolverCalls:1,createCalls:1})
  })

  it("does not touch PII or create again when the idempotent order already exists",async()=>{
    const source=suplifulShopifySourceIdentifier("supplier-procurement:order-1:item-1")
    const f=fixture({existing:remoteOrder(source)})
    const result=await f.adapter.submit(await preview(f.adapter))
    expect(result.procurementId).toBe("supliful-shopify:gid://shopify/Order/789")
    expect(f.counts()).toEqual({resolverCalls:0,createCalls:0})
  })

  it("recovers an order after an ambiguous create timeout",async()=>{
    const f=fixture({failCreateAfterPersist:true})
    const result=await f.adapter.submit(await preview(f.adapter))
    expect(result.externalOrder?.externalId).toBe("gid://shopify/Order/789")
    expect(f.counts()).toEqual({resolverCalls:1,createCalls:1})
  })

  it("reconstructs the full approved procurement identity after restart",async()=>{
    const source=suplifulShopifySourceIdentifier("supplier-procurement:order-1:item-1")
    const f=fixture({existing:remoteOrder(source,{
      displayFulfillmentStatus:"FULFILLED",
      fulfillments:[{
        id:"gid://shopify/Fulfillment/1",
        status:"SUCCESS",
        trackingInfo:[{company:"UPS",number:"1Z999",url:"https://example.test/track"}],
      }],
    })})
    const result=await f.adapter.getByIdempotencyKey("supplier-procurement:order-1:item-1")
    expect(result).toMatchObject({
      status:"shipped",
      supplierId:"supliful",
      connectionId:"shopify:store-1",
      productId:"product-1",
      inventoryId:"inventory-1",
      quantity:2,
      internalOrderId:"order-1",
      internalOrderItemId:"item-1",
      tracking:{provider:"UPS",externalId:"1Z999"},
    })
  })

  it("uses Shopify 2026-10 sourceIdentifier recovery and never sends credentials in the body",async()=>{
    const calls:Array<{url:string;init:RequestInit}>=[]
    const client=new ShopifyAdminGraphqlClient({
      shopDomain:"example.myshopify.com",
      accessToken:"shpat_test_secret",
      fetchImpl:async(url,init)=>{
        calls.push({url:String(url),init:init??{}})
        return new Response(JSON.stringify({data:{orders:{nodes:[]}}}),{
          status:200,headers:{"content-type":"application/json"},
        })
      },
    })
    await client.findOrderBySourceIdentifier("jhadina-test")
    expect(calls[0].url).toContain(`/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`)
    expect(calls[0].init.headers).toMatchObject({"x-shopify-access-token":"shpat_test_secret"})
    expect(String(calls[0].init.body)).not.toContain("shpat_test_secret")
    expect(String(calls[0].init.body)).toContain('source_identifier')
  })
})

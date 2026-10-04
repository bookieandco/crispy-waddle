import "server-only"

import {
  SHOPIFY_ADMIN_API_VERSION,
  ShopifyAdminGraphqlClient,
  SuplifulShopifySupplierProcurementAdapter,
} from "@jhadina/commerce-adapters"
import { createSupplierPaidOrderVault } from "./supplier-paid-order-vault"

export type SuplifulShopifyRuntimeReadiness = {
  configured: boolean
  shopDomainConfigured: boolean
  accessTokenConfigured: boolean
  apiVersion: string
  paidOrderVaultRequired: true
  livePurchaseAuthorized: false
}

export function getSuplifulShopifyRuntimeReadiness(): SuplifulShopifyRuntimeReadiness {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim() ?? ""
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() ?? ""
  return {
    configured: Boolean(shopDomain && accessToken),
    shopDomainConfigured: Boolean(shopDomain),
    accessTokenConfigured: Boolean(accessToken),
    apiVersion:
      process.env.SHOPIFY_ADMIN_API_VERSION?.trim() || SHOPIFY_ADMIN_API_VERSION,
    paidOrderVaultRequired: true,
    livePurchaseAuthorized: false,
  }
}

export function createSuplifulShopifySupplierAdapter():
SuplifulShopifySupplierProcurementAdapter {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN?.trim()
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()
  if (!shopDomain || !accessToken) {
    throw new Error("SUPLIFUL_SHOPIFY_RUNTIME_NOT_CONFIGURED")
  }

  const client = new ShopifyAdminGraphqlClient({
    shopDomain,
    accessToken,
    apiVersion:
      process.env.SHOPIFY_ADMIN_API_VERSION?.trim() || SHOPIFY_ADMIN_API_VERSION,
  })

  return new SuplifulShopifySupplierProcurementAdapter({
    client,
    paidOrderResolver: createSupplierPaidOrderVault(),
  })
}

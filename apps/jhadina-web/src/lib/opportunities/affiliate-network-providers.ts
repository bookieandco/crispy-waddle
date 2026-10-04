import "server-only"

import {
  CjPublisherCommissionAdapter,
  PartnerizePartnerReportingAdapter,
  PartnerizePaymentSummaryAdapter,
  PartnerizeProgramPayoutAttributionAdapter,
  type AffiliateNetworkObservationAdapter,
  type AffiliatePayoutBalanceAdapter,
  type CjFetch,
  type PartnerizeFetch,
} from "@jhadina/commerce-adapters"

export type AffiliateNetworkProviderName = "partnerize" | "cj-affiliate"

export type AffiliateNetworkProviderBinding = {
  provider: AffiliateNetworkProviderName
  accountRef: string
  adapter: AffiliateNetworkObservationAdapter
}

export type AffiliatePayoutProviderBinding = {
  provider: "partnerize"
  accountRef: string
  adapter: AffiliatePayoutBalanceAdapter
}

export type AffiliateProgramPayoutProviderBinding = {
  provider: "partnerize"
  accountRef: string
  adapter: AffiliateNetworkObservationAdapter
}

export function affiliateNetworkProviderConfigured(
  provider: AffiliateNetworkProviderName,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (provider === "partnerize") {
    return Boolean(
      env.PARTNERIZE_APPLICATION_KEY?.trim() &&
      env.PARTNERIZE_USER_API_KEY?.trim() &&
      env.PARTNERIZE_PUBLISHER_ID?.trim(),
    )
  }
  return Boolean(
    env.CJ_PERSONAL_ACCESS_TOKEN?.trim() &&
    env.CJ_PUBLISHER_ID?.trim(),
  )
}

export function createAffiliateNetworkProvider(
  provider: AffiliateNetworkProviderName,
  input: {
    env?: NodeJS.ProcessEnv
    fetchFn?: typeof fetch
  } = {},
): AffiliateNetworkProviderBinding {
  const env = input.env ?? process.env
  const fetchFn = input.fetchFn ?? fetch

  if (provider === "partnerize") {
    const applicationKey = requiredEnv(
      env,
      "PARTNERIZE_APPLICATION_KEY",
    )
    const userApiKey = requiredEnv(env, "PARTNERIZE_USER_API_KEY")
    const publisherId = requiredEnv(env, "PARTNERIZE_PUBLISHER_ID")
    const authorizationHeader =
      "Basic " +
      Buffer.from(`${applicationKey}:${userApiKey}`, "utf8").toString(
        "base64",
      )

    const partnerizeFetch: PartnerizeFetch = async (url, init) => {
      const response = await fetchFn(url, {
        method: "GET",
        headers: init?.headers,
        cache: "no-store",
      })
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        json: () => response.json(),
      }
    }

    return {
      provider,
      accountRef: publisherId,
      adapter: new PartnerizePartnerReportingAdapter(partnerizeFetch, {
        authorizationHeader,
      }),
    }
  }

  const token = requiredEnv(env, "CJ_PERSONAL_ACCESS_TOKEN")
  const publisherId = requiredEnv(env, "CJ_PUBLISHER_ID")
  const cjFetch: CjFetch = async (url, init) => {
    const response = await fetchFn(url, {
      method: init?.method ?? "POST",
      headers: init?.headers,
      body: init?.body,
      cache: "no-store",
    })
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: () => response.json(),
    }
  }

  return {
    provider,
    accountRef: publisherId,
    adapter: new CjPublisherCommissionAdapter(cjFetch, {
      personalAccessToken: token,
    }),
  }
}

export function createAffiliateProgramPayoutProvider(
  provider: "partnerize",
  input: {
    env?: NodeJS.ProcessEnv
    fetchFn?: typeof fetch
  } = {},
): AffiliateProgramPayoutProviderBinding {
  if (provider !== "partnerize") {
    throw new Error("AFFILIATE_PROGRAM_PAYOUT_PROVIDER_UNSUPPORTED")
  }
  const env = input.env ?? process.env
  const fetchFn = input.fetchFn ?? fetch
  const applicationKey = requiredEnv(env, "PARTNERIZE_APPLICATION_KEY")
  const userApiKey = requiredEnv(env, "PARTNERIZE_USER_API_KEY")
  const publisherId = requiredEnv(env, "PARTNERIZE_PUBLISHER_ID")
  const authorizationHeader =
    "Basic " +
    Buffer.from(`${applicationKey}:${userApiKey}`, "utf8").toString(
      "base64",
    )

  const partnerizeFetch: PartnerizeFetch = async (url, init) => {
    const response = await fetchFn(url, {
      method: "GET",
      headers: init?.headers,
      cache: "no-store",
    })
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: () => response.json(),
    }
  }

  return {
    provider,
    accountRef: publisherId,
    adapter: new PartnerizeProgramPayoutAttributionAdapter(
      partnerizeFetch,
      { authorizationHeader },
    ),
  }
}

export function createAffiliatePayoutProvider(
  provider: "partnerize",
  input: {
    env?: NodeJS.ProcessEnv
    fetchFn?: typeof fetch
  } = {},
): AffiliatePayoutProviderBinding {
  if (provider !== "partnerize") {
    throw new Error("AFFILIATE_PAYOUT_PROVIDER_UNSUPPORTED")
  }
  const env = input.env ?? process.env
  const fetchFn = input.fetchFn ?? fetch
  const applicationKey = requiredEnv(env, "PARTNERIZE_APPLICATION_KEY")
  const userApiKey = requiredEnv(env, "PARTNERIZE_USER_API_KEY")
  const publisherId = requiredEnv(env, "PARTNERIZE_PUBLISHER_ID")
  const authorizationHeader =
    "Basic " +
    Buffer.from(`${applicationKey}:${userApiKey}`, "utf8").toString("base64")

  const partnerizeFetch: PartnerizeFetch = async (url, init) => {
    const response = await fetchFn(url, {
      method: "GET",
      headers: init?.headers,
      cache: "no-store",
    })
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: () => response.json(),
    }
  }

  return {
    provider,
    accountRef: publisherId,
    adapter: new PartnerizePaymentSummaryAdapter(partnerizeFetch, {
      authorizationHeader,
    }),
  }
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name}_NOT_CONFIGURED`)
  return value
}

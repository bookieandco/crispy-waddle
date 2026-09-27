import {
  EnvironmentCredentialResolver,
  type AlpacaCredentials,
} from "@jhadina/money-core"

export const ALPACA_PAPER_CREDENTIAL_REF = "money/alpaca/paper" as const

export async function resolveAlpacaPaperCredentials(
  resolver = new EnvironmentCredentialResolver(),
): Promise<AlpacaCredentials> {
  const resolved = await resolver.resolve(ALPACA_PAPER_CREDENTIAL_REF)
  let parsed:unknown
  try {
    parsed=JSON.parse(resolved.secret)
  } catch {
    throw new Error("MONEY_ALPACA_PAPER_CREDENTIAL_JSON_INVALID")
  }
  if(!parsed||typeof parsed!=="object")throw new Error("MONEY_ALPACA_PAPER_CREDENTIAL_INVALID")
  const row=parsed as Record<string,unknown>
  if(typeof row.keyId!=="string"||!row.keyId.trim()||typeof row.secretKey!=="string"||!row.secretKey.trim()){
    throw new Error("MONEY_ALPACA_PAPER_CREDENTIAL_INVALID")
  }
  return Object.freeze({keyId:row.keyId,secretKey:row.secretKey})
}

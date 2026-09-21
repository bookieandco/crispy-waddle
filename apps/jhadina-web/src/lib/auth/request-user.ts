import { createRequestIdentityVerifier } from "./request-identity"

export async function requireRequestIdentity() {
  const verifier = await createRequestIdentityVerifier()
  return verifier.verify({})
}

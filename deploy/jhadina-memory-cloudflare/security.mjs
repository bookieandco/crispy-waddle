/*
 * Verified workload identity only. OIDC proves the calling Vercel deployment,
 * not the end user's session; Jhadina's authenticated server routes enforce
 * end-user scope before calling this private gateway.
 */
const encoder = new TextEncoder();

function decodeBase64Url(raw) {
  if (!/^[A-Za-z0-9_-]+$/.test(raw) || raw.length > 16000) throw new Error("invalid token");
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function tokenPart(segment) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

function expectedIssuer(env) {
  const issuer = env.OIDC_ISSUER;
  if (typeof issuer !== "string" ||
      !/^https:\/\/oidc\.vercel\.com(?:\/[a-z0-9][a-z0-9-]*)?$/.test(issuer)) {
    throw new Error("OIDC_ISSUER_MISSING_OR_INVALID");
  }
  return issuer;
}

/** Fetches only Vercel's fixed JWKS endpoint; never follows an issuer in the token. */
export async function verifyVercelWorkload(authHeader, env, fetchImpl = fetch, now = Date.now()) {
  const issuer = expectedIssuer(env);
  for (const setting of ["OIDC_AUDIENCE", "OIDC_SUBJECT", "OIDC_PROJECT_ID", "OIDC_ENVIRONMENT"]) {
    if (typeof env[setting] !== "string" || !env[setting].trim()) {
      throw new Error("OIDC_EXPECTED_CLAIMS_MISSING");
    }
  }
  if (typeof authHeader !== "string" || !/^Bearer [A-Za-z0-9_.-]+$/.test(authHeader)) {
    throw new Error("OIDC_TOKEN_REQUIRED");
  }
  const token = authHeader.slice(7);
  if (token.length > 12000) throw new Error("OIDC_TOKEN_TOO_LARGE");
  const pieces = token.split(".");
  if (pieces.length !== 3) throw new Error("OIDC_JWT_SHAPE_INVALID");
  const header = tokenPart(pieces[0]);
  const claims = tokenPart(pieces[1]);
  if (!header || typeof header.kid !== "string" || header.kid.length > 150 ||
      (header.alg !== "RS256" && header.alg !== "ES256") ||
      header.typ && header.typ !== "JWT") throw new Error("OIDC_HEADER_INVALID");
  const nowSecs = Math.floor(now / 1000);
  if (claims.iss !== issuer || claims.sub !== env.OIDC_SUBJECT ||
      !([claims.aud].flat().includes(env.OIDC_AUDIENCE)) ||
      claims.project_id !== env.OIDC_PROJECT_ID ||
      claims.environment !== env.OIDC_ENVIRONMENT ||
      typeof claims.exp !== "number" || nowSecs >= claims.exp ||
      typeof claims.iat !== "number" || claims.iat > nowSecs + 30 ||
      (typeof claims.nbf === "number" && nowSecs + 30 < claims.nbf)) {
    throw new Error("OIDC_CLAIMS_REJECTED");
  }
  const url = issuer + "/.well-known/jwks";
  const response = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("OIDC_JWKS_UNAVAILABLE");
  const jwks = await response.json();
  const keys = Array.isArray(jwks.keys) ? jwks.keys : [];
  const jwk = keys.find((key) => key.kid === header.kid &&
    key.alg === header.alg && key.use !== "enc");
  if (!jwk) throw new Error("OIDC_KEY_NOT_FOUND");
  const algorithm = header.alg === "RS256"
    ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
    : { name: "ECDSA", namedCurve: "P-256" };
  if (header.alg === "RS256" && jwk.kty !== "RSA") throw new Error("OIDC_KEY_TYPE_MISMATCH");
  if (header.alg === "ES256" && (jwk.kty !== "EC" || jwk.crv !== "P-256")) {
    throw new Error("OIDC_KEY_TYPE_MISMATCH");
  }
  const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
  const signatureAlgorithm = header.alg === "RS256"
    ? algorithm : { name: "ECDSA", hash: "SHA-256" };
  const verified = await crypto.subtle.verify(signatureAlgorithm, key, decodeBase64Url(pieces[2]),
    encoder.encode(pieces[0] + "." + pieces[1]));
  if (!verified) throw new Error("OIDC_SIGNATURE_INVALID");
  return Object.freeze({ issuer: claims.iss, projectId: claims.project_id, environment: claims.environment });
}

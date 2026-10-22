import test from "node:test";
import assert from "node:assert/strict";
import { verifyVercelWorkload } from "./security.mjs";
import worker from "./worker.mjs";

const env = {
  OIDC_ISSUER: "https://oidc.vercel.com",
  OIDC_AUDIENCE: "https://vercel.com/owner-team",
  OIDC_SUBJECT: "owner:owner-team:project:jhadina:environment:preview",
  OIDC_PROJECT_ID: "prj-test-123",
  OIDC_ENVIRONMENT: "preview",
};
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
async function tokenFixture() {
  const keys = await crypto.subtle.generateKey({
    name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256",
  }, true, ["sign", "verify"]);
  const jwk = { ...await crypto.subtle.exportKey("jwk", keys.publicKey), use: "sig", kid: "test-key", alg: "RS256" };
  const issued = Math.floor(Date.now() / 1000);
  const claims = { iss: env.OIDC_ISSUER, aud: env.OIDC_AUDIENCE,
    sub: env.OIDC_SUBJECT, project_id: env.OIDC_PROJECT_ID, environment: "preview",
    iat: issued, exp: issued + 600 };
  async function sign(payload = claims) {
    const head = b64({ alg: "RS256", kid: "test-key", typ: "JWT" });
    const body = b64(payload);
    const signed = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey,
      new TextEncoder().encode(head + "." + body));
    return head + "." + body + "." + Buffer.from(signed).toString("base64url");
  }
  return { sign, claims, jwk };
}
test("only a verified exact Vercel project/environment/issuer can call Worker", async () => {
  const { sign, claims, jwk } = await tokenFixture();
  const fetchImpl = async (url) => {
    assert.equal(url, "https://oidc.vercel.com/.well-known/jwks");
    return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
  };
  const token = await sign();
  assert.deepEqual(await verifyVercelWorkload("Bearer " + token, env, fetchImpl), {
    issuer: env.OIDC_ISSUER, projectId: env.OIDC_PROJECT_ID, environment: "preview",
  });
  for (const override of [
    { aud: "https://evil.example" },
    { iss: "https://evil.example" },
    { project_id: "prj-other" },
    { environment: "production" },
    { exp: Math.floor(Date.now() / 1000) - 5 },
  ]) {
    const parts = token.split(".");
    const signature = parts[2];
    const tampered = parts[0] + "." + parts[1] + "." +
      (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    await assert.rejects(() => verifyVercelWorkload("Bearer " + tampered, env, fetchImpl), /SIGNATURE_INVALID/);
    await assert.rejects(() => verifyVercelWorkload("Bearer " + token, { ...env, OIDC_PROJECT_ID: "wrong" }, fetchImpl), /CLAIMS_REJECTED/);
    const forged = await sign({ ...claims, ...override });
    await assert.rejects(() => verifyVercelWorkload("Bearer " + forged, env, fetchImpl), /CLAIMS_REJECTED/);
  }
});
test("Worker rejects public and uncredentialed operations before touching D1", async () => {
  const fakeDB = { prepare() { throw new Error("unexpected private DB query"); } };
  const url = "https://private.example.workers.dev/memory";
  assert.equal((await worker.fetch(new Request(url, { method: "GET" }), { DB: fakeDB })).status, 404);
  assert.equal((await worker.fetch(new Request(url, { method: "POST" }), { DB: fakeDB })).status, 415);
  const result = await worker.fetch(new Request(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "probe", payload: {} }),
  }), { DB: fakeDB, ...env });
  assert.equal(result.status, 401);
  assert.deepEqual(await result.json(), { error: "Unauthorized workload" });
});

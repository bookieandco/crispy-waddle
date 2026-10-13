import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const verify=vi.fn(async()=>({userId:"owner-a",sessionId:"session"}));
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({verify}),
}));
import {GET} from "./route";
describe("SOCIAL-ID.24 authenticated read-only operations route",()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("JHADINA_SOCIAL_WEEKLY_AUDIT_READ_ENABLED","false");});
 afterEach(()=>vi.unstubAllEnvs());
 it("returns no-cache owner-only uncommissioned unknown numbers, never demo records",async()=>{
  const r=await GET(),data=await r.json();
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toContain("no-store");
  expect(data.success).toBe(true);
  expect(data.data.readiness).toBe("NOT_COMMISSIONED");
  expect(data.data.pendingApprovals).toBeNull();
  expect(data.data.quarantinedActions).toBeNull();
  expect(data.data.actions).toBeNull();
  expect(data.data.canPublish).toBe(false);
  expect(data.data.canRetry).toBe(false);
  expect(verify).toHaveBeenCalledTimes(1);
 });
 it("never silently enables uncommissioned SQL on an environment flag",async()=>{
  vi.stubEnv("JHADINA_SOCIAL_WEEKLY_AUDIT_READ_ENABLED","true");
  const r=await GET(),data=await r.json();
  expect(r.status).toBe(503);
  expect(data.success).toBe(false);
  expect(data.data).toBeUndefined();
 });
 it("fails closed for revoked or invalid owner session",async()=>{
  verify.mockRejectedValueOnce(new Error("SOCIAL_NO_SESSION"));
  const r=await GET();
  expect(r.status).toBe(401);
  const data=await r.json();
  expect(data.data).toBeUndefined();
  expect(r.headers.get("cache-control")).toContain("no-store");
 });
});

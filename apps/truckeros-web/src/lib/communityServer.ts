/**
 * Preview-only Node/SQLite social boundary. No demo driver fallback.
 * Public production signup is NOT authorized until verification,
 * server-side rate limiting, account recovery, moderation and restore tests exist.
 */
import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { SqliteTruckerCommunity } from "@jhadina/truckeros-core/community/sqlite";
const COOKIE = "truckeros_community_session";
declare global {
  // eslint-disable-next-line no-var
  var __truckerCommunitySqlite: { path:string; db:SqliteTruckerCommunity } | undefined;
}
export function apiEnabled(): boolean {
  // This entire route family is intentionally disabled in production.
  // Pilot rollout requires replacing this gate with audited production auth.
  return process.env.NODE_ENV !== "production" && process.env.TRUCKEROS_COMMUNITY_PREVIEW === "1";
}
export function database(): SqliteTruckerCommunity {
  if (!apiEnabled()) throw Error("Community preview not enabled");
  const path=process.env.TRUCKEROS_COMMUNITY_DATABASE_PATH;
  if (!path || !path.startsWith("/") || path==="/tmp" || path.startsWith("/tmp/")) {
    throw Error("Configure an absolute, persistent TRUCKEROS_COMMUNITY_DATABASE_PATH");
  }
  if (!globalThis.__truckerCommunitySqlite || globalThis.__truckerCommunitySqlite.path!==path) {
    globalThis.__truckerCommunitySqlite?.db.close();
    globalThis.__truckerCommunitySqlite={path,db:new SqliteTruckerCommunity(path)};
  }
  return globalThis.__truckerCommunitySqlite.db;
}
export function session(request:NextRequest):string {
  const token=request.cookies.get(COOKIE)?.value;
  if (!token) throw Error("Unauthorized");
  return token;
}
export function assertSafeMutation(request:NextRequest):void {
  if (!apiEnabled())throw Error("Community preview not enabled");
  const origin=request.headers.get("origin");
  // Reject absent Origin; no referrer fallback, no CORS and no cross-site writes.
  if (!origin || origin==="null")throw Error("Invalid origin");
  if (new URL(origin).origin!==request.nextUrl.origin)throw Error("Invalid origin");
  const contentType=request.headers.get("content-type")?.toLowerCase()??"";
  if(!contentType.startsWith("application/json"))throw Error("JSON required");
  const len=Number(request.headers.get("content-length")??"0");
  if(!Number.isFinite(len)||len>16_384||len<0)throw Error("Invalid request size");
  const fetchSite=request.headers.get("sec-fetch-site");
  if(fetchSite && fetchSite!=="same-origin" && fetchSite!=="none")throw Error("Cross-site request");
}
export async function readPayload(request:NextRequest):Promise<Record<string,unknown>> {
  const source=await request.text();
  if(source.length>16_384)throw Error("Invalid request size");
  const parsed:unknown=JSON.parse(source);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Invalid payload");
  return parsed as Record<string,unknown>;
}
export function response(data:unknown,status=200) {
  return NextResponse.json({success:true,data},{status,headers:{"Cache-Control":"no-store"}});
}
export function failure(err:unknown) {
  const message=err instanceof Error?err.message:"Request failed";
  const unauthorized=/Unauthorized|Invalid credentials/.test(message);
  const unconfigured=/Community preview not enabled|Configure an absolute/.test(message);
  const status=unconfigured?503:unauthorized?401:/Invalid origin|Cross-site/.test(message)?403:400;
  // Never leak SQLite details, password requirements or server paths.
  const error=unconfigured?"Community preview is not configured":unauthorized?"Not authenticated":status===403?"Request blocked":"Invalid request";
  return NextResponse.json({success:false,error},{status,headers:{"Cache-Control":"no-store"}});
}
export function setSession(response:NextResponse,token:string) {
  response.cookies.set(COOKIE,token,{
    httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",
    maxAge:7*24*60*60,path:"/"
  });
  return response;
}
export function clearSession(response:NextResponse) {
  response.cookies.set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:0,path:"/"});
  return response;
}

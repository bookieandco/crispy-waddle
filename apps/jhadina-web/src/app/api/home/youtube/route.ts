import { NextRequest, NextResponse } from "next/server"
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity"
import { decryptSecret, encryptSecret } from "@/lib/youtube-oauth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Subscription = { snippet?: { resourceId?: { channelId?: string }; title?: string } }
type Activity = { snippet?: { title?: string; channelTitle?: string; publishedAt?: string; type?: string; thumbnails?: { medium?: {url?: string}; default?: {url?: string} } }; contentDetails?: { upload?: { videoId?: string } } }
type ApiList<T> = { items?: T[]; pageInfo?: {totalResults?: number} }
type Video = { id: string; title: string; channel: string; publishedAt: string; thumbnailUrl?: string; url: string }
const validId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id)
const validChannel = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{10,40}$/.test(id)

export async function GET(request: NextRequest) {
  let identity: string
  try {
    const verifier = await createRequestIdentityVerifier()
    identity = (await verifier.verify({})).userId
  } catch {
    return NextResponse.json({ connection: "unavailable", items: [], message: "Sign in to view your YouTube subscriptions." }, { status: 401, headers: { "Cache-Control": "private, no-store" } })
  }

  const accessEncrypted = request.cookies.get("jhadina_youtube_access")?.value
  const refreshEncrypted = request.cookies.get("jhadina_youtube_refresh")?.value
  if (!accessEncrypted && !refreshEncrypted) return NextResponse.json({connection:"disconnected",items:[],message:"Connect YouTube to see a bounded sample of subscribed-channel uploads."},{headers:{"Cache-Control":"private, no-store"}})
  const ownerEncrypted = request.cookies.get("jhadina_youtube_owner")?.value
  try {
    if (!ownerEncrypted || decryptSecret(ownerEncrypted) !== identity) return NextResponse.json({connection:"reauthorize",items:[],message:"Reconnect YouTube for this signed-in Jhadina account."},{headers:{"Cache-Control":"private, no-store"}})
  } catch { return NextResponse.json({connection:"reauthorize",items:[],message:"Reconnect YouTube for this signed-in Jhadina account."},{headers:{"Cache-Control":"private, no-store"}}) }

  let access = ""
  let refreshed = false
  const reply = (data: Record<string, unknown>) => {
    const response = NextResponse.json(data, {headers:{"Cache-Control":"private, no-store"}})
    if (refreshed) response.cookies.set("jhadina_youtube_access", encryptSecret(access), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3300,
    })
    return response
  }

  async function renew() {
    if (!refreshEncrypted) throw new Error("REAUTHORIZE")
    const refreshToken = decryptSecret(refreshEncrypted)
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error("REAUTHORIZE")
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: {"content-type":"application/x-www-form-urlencoded"},
      body: new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"}),
    })
    const payload = await response.json() as {access_token?:string}
    if (!response.ok || !payload.access_token) throw new Error("REAUTHORIZE")
    access = payload.access_token
    refreshed = true
  }

  async function read<T>(path: string, params: Record<string,string>): Promise<T> {
    if (!access) await renew()
    const url = new URL("https://www.googleapis.com/youtube/v3/" + path)
    for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value)
    let response = await fetch(url,{headers:{Authorization:"Bearer " + access},cache:"no-store",signal:AbortSignal.timeout(8000)})
    if (response.status === 401 && refreshEncrypted) {
      await renew()
      response = await fetch(url,{headers:{Authorization:"Bearer " + access},cache:"no-store",signal:AbortSignal.timeout(8000)})
    }
    if (response.status === 401) throw new Error("REAUTHORIZE")
    if (!response.ok) throw new Error("UPSTREAM_UNAVAILABLE")
    return response.json() as Promise<T>
  }

  try {
    if (accessEncrypted) {
      try { access = decryptSecret(accessEncrypted) } catch { access = "" }
    }
    // subscriptions.list is the authenticated owner's list, not YouTube's personalized Home algorithm.
    const subs = await read<ApiList<Subscription>>("subscriptions",{part:"snippet",mine:"true",maxResults:"12"})
    const channels = [...new Set((subs.items ?? []).map(x=>x.snippet?.resourceId?.channelId).filter(validChannel))].slice(0,6)
    const results = await Promise.allSettled(channels.map(channelId=>read<ApiList<Activity>>("activities",{part:"snippet,contentDetails",channelId,maxResults:"5"})))
    const videos: Video[] = []
    let failed = 0
    results.forEach((result)=>{
      if (result.status === "rejected") {failed++;return}
      for (const activity of result.value.items ?? []) {
        if (activity.snippet?.type !== "upload") continue
        const id = activity.contentDetails?.upload?.videoId
        if (!validId(id)) continue
        const publishedAt = activity.snippet?.publishedAt ?? ""
        if (!Number.isFinite(Date.parse(publishedAt))) continue
        videos.push({
          id,title:activity.snippet?.title?.slice(0,220) || "YouTube upload",
          channel:activity.snippet?.channelTitle?.slice(0,120) || "YouTube channel",
          publishedAt,thumbnailUrl:activity.snippet?.thumbnails?.medium?.url ?? activity.snippet?.thumbnails?.default?.url,
          url:"https://www.youtube.com/watch?v=" + id,
        })
      }
    })
    const items = [...new Map(videos.map(item=>[item.id,item])).values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,18)
    return reply({
      connection: "connected", items, scannedChannels:channels.length,
      partial:failed>0 || Boolean(subs.pageInfo?.totalResults && subs.pageInfo.totalResults>channels.length),
      message:failed>0
        ? "Some subscribed channels could not be checked. Showing verified uploads from the channels that responded."
        : "Recent uploads sampled from subscribed channels—not a replica of YouTube's recommendation feed.",
    })
  } catch (error) {
    if (error instanceof Error && error.message === "REAUTHORIZE") return reply({connection:"reauthorize",items:[],message:"Your YouTube permission needs to be renewed."})
    return reply({connection:"unavailable",items:[],message:"YouTube is temporarily unavailable or quota-limited. No videos were invented."})
  }
}

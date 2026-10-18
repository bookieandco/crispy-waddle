import type { NextRequest } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { MusicAuthRequiredError, MusicBackendUnavailableError } from "@/lib/music/music-request-scope";

/** Vercel Authentication gates private preview domains; production uses the real user session.
 * Never take tenant ID or an auth flag from request headers or query parameters. */
export function musicYoutubeIsOwnerPreview(): boolean {
  return process.env.VERCEL_ENV === "preview";
}
export async function youtubeOwnerScope(): Promise<string> {
  if (musicYoutubeIsOwnerPreview()) return "vercel-protected-preview";
  const {userId}=await authenticatedMusicScope();
  return userId;
}
export function canPreviewAccessYouTubeRoute(req: NextRequest): boolean {
  return musicYoutubeIsOwnerPreview() &&
    (req.method==="GET" || req.method==="HEAD") &&
    (req.nextUrl.pathname==="/api/music/youtube/search" ||
    req.nextUrl.pathname==="/api/music/youtube/playlist" ||
    req.nextUrl.pathname==="/api/music/youtube/status" ||
    req.nextUrl.pathname==="/api/auth/youtube/start" ||
    req.nextUrl.pathname==="/api/auth/youtube/callback");
}
export function youtubeAuthHttpError(error: unknown): {status:number;message:string} {
  if (error instanceof MusicAuthRequiredError) return {status:401,message:"Sign in to use YouTube discovery."};
  if (error instanceof MusicBackendUnavailableError) return {status:503,message:"Account authentication is temporarily unavailable."};
  return {status:503,message:"YouTube discovery temporarily unavailable."};
}

import { NextRequest, NextResponse } from "next/server";
import { HootsuiteProvider, type JhadinaBrand, type SocialPlatform } from "@jhadina/social-core";

export const dynamic = "force-dynamic";

interface CreatePostBody { brand: JhadinaBrand; platforms: SocialPlatform[]; text: string; mediaUrls?: string[]; scheduledAt?: string; approved?: boolean }

export async function GET() {
  try {
    const provider = new HootsuiteProvider();
    return NextResponse.json({ success: true, provider: provider.name, data: await provider.getPosts() });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load social posts" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreatePostBody;
    if (!body.brand || !body.platforms?.length || !body.text?.trim()) return NextResponse.json({ success: false, error: "brand, platforms and text are required" }, { status: 400 });
    const provider = new HootsuiteProvider();
    const post = await provider.createPost({ brand: body.brand, platforms: body.platforms, text: body.text.trim(), mediaUrls: body.mediaUrls, scheduledAt: body.scheduledAt, requiresApproval: true, approvedAt: body.approved ? new Date().toISOString() : undefined });
    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create social post" }, { status: 400 });
  }
}

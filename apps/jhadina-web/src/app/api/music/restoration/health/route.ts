import { NextResponse } from "next/server";
import {
  getMusicRestorationRuntimeHealth,
  isMusicRestorationRuntimeConfigured,
  musicRestorationRuntimeAuthMode,
} from "@/lib/music/restoration-runtime-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isMusicRestorationRuntimeConfigured())) {
    return NextResponse.json({
      ok: true,
      configured: false,
      providerId: "music-restoration-worker",
      status: "not-configured",
      productionReady: false,
      authMode: await musicRestorationRuntimeAuthMode(),
    }, {
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const health = await getMusicRestorationRuntimeHealth();
    const productionReady = health.status === "ready" && health.productionReady === true;
    return NextResponse.json({
      ok: true,
      configured: true,
      providerId: "music-restoration-worker",
      status: productionReady ? "ready" : String(health.status ?? "blocked"),
      productionReady,
      authMode: await musicRestorationRuntimeAuthMode(),
      health,
    }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (cause) {
    return NextResponse.json({
      ok: true,
      configured: true,
      providerId: "music-restoration-worker",
      status: "unavailable",
      productionReady: false,
      authMode: await musicRestorationRuntimeAuthMode(),
      error: cause instanceof Error ? cause.message : "MUSIC_RESTORATION_WORKER_HEALTH_FAILED",
    }, {
      headers: { "cache-control": "no-store" },
    });
  }
}

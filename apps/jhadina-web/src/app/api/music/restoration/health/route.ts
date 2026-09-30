import { NextResponse } from "next/server";
import {
  getMusicRestorationRuntimeHealth,
  getMusicRestorationRuntimeLiveness,
  isMusicRestorationRuntimeConfigured,
  musicRestorationRuntimeAuthMode,
} from "@/lib/music/restoration-runtime-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isMusicRestorationRuntimeConfigured()) {
    const liveness = await getMusicRestorationRuntimeLiveness();
    return NextResponse.json({
      ok: true,
      configured: false,
      machineAuthConfigured: false,
      sessionAuthSupported: true,
      providerId: "music-restoration-worker",
      status: liveness.reachable ? "session-auth-ready" : "worker-unavailable",
      workerReachable: liveness.reachable,
      productionReady: false,
      authMode: "supabase-session",
      liveness,
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
      machineAuthConfigured: true,
      sessionAuthSupported: true,
      providerId: "music-restoration-worker",
      status: productionReady ? "ready" : String(health.status ?? "blocked"),
      productionReady,
      authMode: musicRestorationRuntimeAuthMode(),
      health,
    }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (cause) {
    return NextResponse.json({
      ok: true,
      configured: true,
      machineAuthConfigured: true,
      sessionAuthSupported: true,
      providerId: "music-restoration-worker",
      status: "unavailable",
      productionReady: false,
      authMode: musicRestorationRuntimeAuthMode(),
      error: cause instanceof Error ? cause.message : "MUSIC_RESTORATION_WORKER_HEALTH_FAILED",
    }, {
      headers: { "cache-control": "no-store" },
    });
  }
}

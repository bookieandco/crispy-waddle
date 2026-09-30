import { NextRequest, NextResponse } from "next/server";
import {
  renderLogicImportGuide,
  renderReaperProject,
  renderRestorationManifest,
  renderRestorationMarkersCsv,
} from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { getRestorationStudioCase } from "@/lib/music/restoration-studio-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFormat = "manifest" | "reaper" | "markers" | "logic";

function safeFile(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "restoration";
}

export async function GET(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const caseId = req.nextUrl.searchParams.get("caseId")?.trim() ?? "";
    const format = (req.nextUrl.searchParams.get("format")?.trim() ?? "manifest") as ExportFormat;
    if (!caseId) return NextResponse.json({ success: false, error: "caseId is required" }, { status: 400 });
    if (!["manifest","reaper","markers","logic"].includes(format)) {
      return NextResponse.json({ success: false, error: "Unsupported export format" }, { status: 400 });
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const snapshot = await getRestorationStudioCase({
      client,
      ownerUserId: identity.userId,
      caseId,
    });
    const title = safeFile(String(snapshot.restorationCase.title ?? "restoration"));

    if (format === "manifest") {
      const downloads = snapshot.manifest.tracks.map(track => ({
        artifactId: track.artifactId,
        fileName: track.fileName,
        downloadUrl: snapshot.artifacts.find(item => item.id === track.artifactId)?.downloadUrl ?? null,
      }));
      const body = JSON.stringify({ ...snapshot.manifest, downloads }, null, 2) + "\n";
      return new NextResponse(body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": 'attachment; filename="' + title + '-restoration-manifest.json"',
          "cache-control": "no-store",
        },
      });
    }

    if (format === "reaper") {
      return new NextResponse(renderReaperProject(snapshot.manifest), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": 'attachment; filename="' + title + '.rpp"',
          "cache-control": "no-store",
        },
      });
    }

    if (format === "markers") {
      return new NextResponse(renderRestorationMarkersCsv(snapshot.manifest.markers), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="' + title + '-markers.csv"',
          "cache-control": "no-store",
        },
      });
    }

    return new NextResponse(renderLogicImportGuide(snapshot.manifest), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'attachment; filename="' + title + '-logic-import.md"',
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restoration export failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /NOT_FOUND|not found/i.test(message)
        ? 404
        : /NOT_CONFIGURED|not configured/i.test(message)
          ? 503
          : 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

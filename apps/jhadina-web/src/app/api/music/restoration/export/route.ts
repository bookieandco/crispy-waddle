import { NextRequest, NextResponse } from "next/server";
import {
  renderLogicImportGuide,
  renderReaperProject,
  renderRestorationMarkersCsv,
  planRestorationBundleParts,
} from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { buildRestorationDawBundle } from "@/lib/music/restoration-daw-bundle-service";
import { getRestorationStudioCase } from "@/lib/music/restoration-studio-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFormat = "bundle" | "bundle-plan" | "manifest" | "reaper" | "markers" | "logic";

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
    if (!["bundle","bundle-plan","manifest","reaper","markers","logic"].includes(format)) {
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

    const plan = format === "bundle" || format === "bundle-plan"
      ? planRestorationBundleParts(snapshot.manifest.tracks, snapshot.artifacts)
      : null;

    if (format === "bundle-plan" && plan) {
      return NextResponse.json({
        success: true,
        totalSourceBytes: plan.totalSourceBytes,
        partByteLimit: plan.partByteLimit,
        parts: plan.parts.map(p => ({
          number: p.number, sourceBytes: p.sourceBytes, count: p.artifactIds.length,
        })),
        directArtifacts: plan.directArtifacts.map(entry => ({
          artifactId: entry.artifactId, sourceBytes: entry.sourceBytes,
          fileName: snapshot.manifest.tracks.find(t => t.artifactId === entry.artifactId)?.fileName ?? "audio",
          downloadUrl: snapshot.artifacts.find(a => a.id === entry.artifactId)?.downloadUrl ?? null,
        })),
        note: "Download ZIP parts separately, extract into the same folder. Oversized single assets are exact owner-scoped downloads. They have not been omitted or transcoded.",
      }, { headers: { "cache-control": "private, no-store" } });
    }

    if (format === "bundle") {
      try {
        const partParam = req.nextUrl.searchParams.get("part");
        const partNumber = partParam === null ? null : Number(partParam);
        if (partNumber !== null &&
            (!Number.isSafeInteger(partNumber) || partNumber < 1)) {
          return NextResponse.json({ success: false, error: "Invalid bundle part" }, { status: 400 });
        }
        const selectedPart = partNumber !== null ? plan?.parts.find(p => p.number === partNumber) : null;
        if (partNumber !== null && !selectedPart) {
          return NextResponse.json({ success: false, error: "Bundle part not found" }, { status: 404 });
        }
        const bundle = await buildRestorationDawBundle({
          client,
          ownerUserId: identity.userId,
          snapshot,
          includedArtifactIds: selectedPart?.artifactIds,
        });
        const body = bundle.bytes.buffer.slice(
          bundle.bytes.byteOffset,
          bundle.bytes.byteOffset + bundle.bytes.byteLength,
        ) as ArrayBuffer;
        return new NextResponse(body, {
          headers: {
            "content-type": "application/zip",
            "content-disposition": 'attachment; filename="' + bundle.title + (partNumber === null ? "" : "-part-" + partNumber + "-of-" + plan?.parts.length) + '-jhadina-restoration.zip"',
            "cache-control": "private, no-store",
            "content-length": String(bundle.bytes.byteLength),
            "x-jhadina-bundle-sha256": bundle.sha256,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message === "MUSIC_RESTORATION_DAW_BUNDLE_TOO_LARGE") {
          return NextResponse.json({
            success: false,
            error: "DAW bundle is too large for the web export boundary. Export individual assets or use the commissioned restoration worker.",
          }, { status: 413 });
        }
        throw error;
      }
    }

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
          "cache-control": "private, no-store",
        },
      });
    }

    if (format === "reaper") {
      return new NextResponse(renderReaperProject(snapshot.manifest), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": 'attachment; filename="' + title + '.rpp"',
          "cache-control": "private, no-store",
        },
      });
    }

    if (format === "markers") {
      return new NextResponse(renderRestorationMarkersCsv(snapshot.manifest.markers), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="' + title + '-markers.csv"',
          "cache-control": "private, no-store",
        },
      });
    }

    return new NextResponse(renderLogicImportGuide(snapshot.manifest), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'attachment; filename="' + title + '-logic-import.md"',
        "cache-control": "private, no-store",
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

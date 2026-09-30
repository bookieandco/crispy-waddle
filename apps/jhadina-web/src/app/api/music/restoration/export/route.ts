import { NextRequest, NextResponse } from "next/server";
import {
  buildRestorationZip,
  renderLogicImportGuide,
  renderReaperProject,
  renderRestorationManifest,
  renderRestorationMarkersCsv,
  sha256Hex,
} from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { getRestorationStudioCase } from "@/lib/music/restoration-studio-service";
import { SupabaseMusicRestorationArtifactStore } from "@/lib/music/restoration-supabase-store";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportFormat = "bundle" | "manifest" | "reaper" | "markers" | "logic";

const MAX_DAW_BUNDLE_SOURCE_BYTES = 700 * 1024 * 1024;

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
    if (!["bundle","manifest","reaper","markers","logic"].includes(format)) {
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

    if (format === "bundle") {
      const totalSourceBytes = snapshot.artifacts.reduce(
        (sum, artifact) => sum + Number(artifact.sizeBytes ?? 0),
        0,
      );
      if (!Number.isFinite(totalSourceBytes) || totalSourceBytes > MAX_DAW_BUNDLE_SOURCE_BYTES) {
        return NextResponse.json({
          success: false,
          error: "DAW bundle is too large for the web export boundary. Export individual assets or use the commissioned restoration worker.",
        }, { status: 413 });
      }

      const store = new SupabaseMusicRestorationArtifactStore(client, identity.userId);
      const entries: Array<{ path: string; data: Uint8Array | string }> = [
        {
          path: "restoration-manifest.json",
          data: renderRestorationManifest(snapshot.manifest),
        },
        {
          path: "markers.csv",
          data: renderRestorationMarkersCsv(snapshot.manifest.markers),
        },
        {
          path: safeFile(String(snapshot.restorationCase.title ?? "restoration")) + ".rpp",
          data: renderReaperProject(snapshot.manifest),
        },
        {
          path: "LOGIC-IMPORT.md",
          data: renderLogicImportGuide(snapshot.manifest),
        },
        {
          path: "README.txt",
          data: [
            "Jhadina Restoration Studio DAW bundle",
            "",
            "The immutable source remains authoritative.",
            "Files in stems/ are exact registered artifact bytes and are SHA-256 checked before packaging.",
            "Open the .rpp file in REAPER from this extracted folder, or import stems/ at time 0 in Logic Pro.",
            "markers.csv and restoration-manifest.json preserve timing, lineage, QC and restoration history.",
            "",
          ].join("\n"),
        },
      ];

      for (const track of snapshot.manifest.tracks) {
        const bytes = await store.downloadArtifactBytes(track.artifactId);
        const actualHash = await sha256Hex(bytes);
        if (actualHash.toLowerCase() !== track.sha256.toLowerCase()) {
          throw new Error(`MUSIC_RESTORATION_EXPORT_HASH_MISMATCH: ${track.artifactId}`);
        }
        entries.push({ path: "stems/" + track.fileName, data: bytes });
      }

      const zip = buildRestorationZip(entries);
      return new NextResponse(zip, {
        headers: {
          "content-type": "application/zip",
          "content-disposition": 'attachment; filename="' + title + '-jhadina-restoration.zip"',
          "cache-control": "private, no-store",
          "content-length": String(zip.byteLength),
        },
      });
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

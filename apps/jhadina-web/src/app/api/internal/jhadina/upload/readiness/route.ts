import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { evaluateUploadProductionReadiness } from "@/lib/intelligence/upload-production-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const readiness = await evaluateUploadProductionReadiness({
    client: createServiceRoleClient(),
  });

  return NextResponse.json(
    {
      ok: readiness.ready,
      readiness,
    },
    { status: readiness.ready ? 200 : 503 },
  );
}

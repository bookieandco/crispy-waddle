import { NextRequest, NextResponse } from "next/server"

const OWNER = "bookieandco"
const REPO = "crispy-waddle"
const WORKFLOW = "jhadina-evolution-execute.yml"
const DEFAULT_BASE = "agent/jhadina-integration-spine"

interface ExecuteBody {
  taskId?: unknown
  prompt?: unknown
  baseBranch?: unknown
  approvalId?: unknown
}

function getUserId(req: NextRequest) {
  return req.headers.get("x-user-id")
}

function isSafeTaskId(value: string) {
  return /^[A-Za-z0-9._-]{1,100}$/.test(value)
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const token = process.env.GITHUB_EVOLUTION_TOKEN
  if (!token) {
    return NextResponse.json({ error: "Evolution dispatch is not configured" }, { status: 503 })
  }

  let body: ExecuteBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const taskId = typeof body.taskId === "string" ? body.taskId.trim() : ""
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  const baseBranch = typeof body.baseBranch === "string" && body.baseBranch.trim()
    ? body.baseBranch.trim()
    : DEFAULT_BASE
  const approvalId = typeof body.approvalId === "string" ? body.approvalId.trim() : ""

  if (!taskId || !isSafeTaskId(taskId)) {
    return NextResponse.json({ error: "taskId is required and must contain only letters, numbers, '.', '_' or '-'" }, { status: 400 })
  }
  if (!prompt || prompt.length > 12000) {
    return NextResponse.json({ error: "prompt is required and must be at most 12000 characters" }, { status: 400 })
  }
  if (!approvalId) {
    return NextResponse.json({ error: "approvalId is required" }, { status: 400 })
  }
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(baseBranch)) {
    return NextResponse.json({ error: "Invalid baseBranch" }, { status: 400 })
  }

  const apiBase = `https://api.github.com/repos/${OWNER}/${REPO}`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  // Idempotency check: do not dispatch another run while this task is already active.
  const runsResponse = await fetch(
    `${apiBase}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=100`,
    { headers, cache: "no-store" },
  )

  if (!runsResponse.ok) {
    return NextResponse.json({ error: "Unable to inspect existing evolution runs" }, { status: 502 })
  }

  const runs = await runsResponse.json() as {
    workflow_runs?: Array<{ id: number; display_title?: string; status?: string; conclusion?: string | null }>
  }

  const active = (runs.workflow_runs ?? []).find((run) =>
    run.display_title === `Jhadina Evolution — ${taskId}` &&
    ["queued", "in_progress", "waiting", "requested"].includes(run.status ?? ""),
  )

  if (active) {
    return NextResponse.json({
      success: true,
      status: "already_running",
      data: { taskId, workflowRunId: active.id, requestedBy: userId },
    })
  }

  const dispatchResponse = await fetch(
    `${apiBase}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: DEFAULT_BASE,
        inputs: { task_id: taskId, prompt, base_branch: baseBranch },
      }),
    },
  )

  if (!dispatchResponse.ok) {
    const detail = await dispatchResponse.text()
    console.error("Evolution workflow dispatch failed", detail)
    return NextResponse.json({ error: "Evolution workflow dispatch failed" }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    status: "dispatched",
    data: {
      taskId,
      requestedBy: userId,
      approvalId,
      baseBranch,
      workflow: WORKFLOW,
      note: "GitHub Environment approval remains authoritative before Claude Code execution.",
    },
  })
}

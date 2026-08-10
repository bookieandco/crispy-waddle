import { NextResponse } from "next/server";
import { agents, type AgentId, type AgentContext } from "../../../../lib/agents";

export async function GET() {
  const entries = await Promise.all(
    (Object.keys(agents) as AgentId[]).map(async (id) => ({
      id,
      name: agents[id].name,
      role: agents[id].role,
      status: await agents[id].health(),
    })),
  );
  return NextResponse.json({ agents: entries });
}

export async function POST(request: Request) {
  const body = await request.json() as Partial<AgentContext> & { agent?: AgentId };
  if (!body.agent || !(body.agent in agents) || !body.goal || !body.requestId || !body.userId) {
    return NextResponse.json({ error: "agent, goal, requestId, and userId are required" }, { status: 400 });
  }

  const result = await agents[body.agent].handle({
    requestId: body.requestId,
    userId: body.userId,
    goal: body.goal,
    context: body.context,
  });

  return NextResponse.json(result);
}

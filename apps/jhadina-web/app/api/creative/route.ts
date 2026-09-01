import { normalizeCreativeIntent } from "@jhadina/creative-engine";

/**
 * Multimodal creative hub boundary.
 *
 * The conversational Jhadina layer should call this boundary with text and
 * media references. Authorization/policy should wrap this capability before
 * dispatching a CreativeJob to an execution/provider layer.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    operation?: "generate" | "edit" | "enhance" | "upscale";
    prompt?: string;
    references?: Array<{
      assetId: string;
      role:
        | "subject"
        | "style"
        | "composition"
        | "product"
        | "environment"
        | "color"
        | "inspiration";
      uri?: string;
    }>;
    outputCount?: number;
    productId?: string;
    metadata?: Record<string, unknown>;
  };

  const intent = normalizeCreativeIntent(body);

  return Response.json({
    capability: "creative",
    intent,
    dispatch: "pending-governance",
  });
}

import type {
  SocialMessageProvider,
  SocialProviderMessageReceipt,
  SocialProviderMessageRequest,
} from "./messaging.js";

export const TIKTOK_BUSINESS_MESSAGE_READ_SCOPE = "message.list.read";
export const TIKTOK_BUSINESS_MESSAGE_SEND_SCOPE = "message.list.send";

export interface TikTokBusinessAuthorization {
  businessId: string;
  scopes: readonly string[];
  observedAt: string;
}

export interface TikTokBusinessMessageRecord {
  messageId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text?: string;
  source?: "API" | "APP" | "WEB" | "OTHERS" | "UNKNOWN_SOURCE";
  occurredAt: string;
}

export interface TikTokBusinessMessagingClient {
  inspectAuthorization(): Promise<TikTokBusinessAuthorization>;
  listMessages(conversationId: string): Promise<TikTokBusinessMessageRecord[]>;
  sendText(input: {
    businessId: string;
    conversationId: string;
    text: string;
  }): Promise<{ messageId: string; observedAt: string }>;
}

export interface TikTokMessageReconciliationContext {
  idempotencyKey: string;
  businessId: string;
  providerRecipientId: string;
  conversationId: string;
  text: string;
  createdAt: string;
  providerMessageId?: string;
}

export interface TikTokMessageReconciliationResolver {
  getByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<TikTokMessageReconciliationContext | null>;
}

export class TikTokBusinessMessagingProvider implements SocialMessageProvider {
  readonly name = "tiktok" as const;

  constructor(
    private readonly client: TikTokBusinessMessagingClient,
    private readonly reconciliation: TikTokMessageReconciliationResolver,
  ) {}

  async sendMessage(
    input: SocialProviderMessageRequest,
  ): Promise<SocialProviderMessageReceipt> {
    if (input.platform !== "tiktok") {
      throw new Error("TIKTOK_MESSAGE_PLATFORM_MISMATCH");
    }
    if (!input.conversationRef?.trim()) {
      throw new Error("TIKTOK_MESSAGE_EXISTING_CONVERSATION_REQUIRED");
    }

    const text = input.text.trim();
    if (!text) throw new Error("TIKTOK_MESSAGE_TEXT_REQUIRED");
    if ([...text].length > 6000) {
      throw new Error("TIKTOK_MESSAGE_TEXT_TOO_LONG");
    }

    const authorization = await this.client.inspectAuthorization();
    assertTikTokMessagingAuthorization(authorization);
    if (authorization.businessId !== input.senderProviderProfileId) {
      throw new Error("TIKTOK_MESSAGE_BUSINESS_ID_MISMATCH");
    }

    const messages = await this.client.listMessages(input.conversationRef);
    if (!messages.some((message) => message.direction === "inbound")) {
      // Business Messaging is a reply channel, not a general cold-DM surface.
      throw new Error("TIKTOK_MESSAGE_CANNOT_INITIATE_CONVERSATION");
    }

    const existing = await this.findMessageByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const sent = await this.client.sendText({
      businessId: authorization.businessId,
      conversationId: input.conversationRef,
      text,
    });
    if (!sent.messageId.trim()) {
      throw new Error("TIKTOK_MESSAGE_RECEIPT_MISSING");
    }

    return {
      provider: this.name,
      platform: "tiktok",
      senderProviderProfileId: authorization.businessId,
      providerRecipientId: input.providerRecipientId,
      providerMessageId: sent.messageId,
      state: "sent",
      observedAt: normalizeTimestamp(sent.observedAt, "TIKTOK_MESSAGE_SENT_AT_INVALID"),
    };
  }

  async findMessageByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<SocialProviderMessageReceipt | null> {
    const context = await this.reconciliation.getByIdempotencyKey(idempotencyKey);
    if (!context) return null;

    const authorization = await this.client.inspectAuthorization();
    assertTikTokMessagingAuthorization(authorization);
    if (authorization.businessId !== context.businessId) {
      throw new Error("TIKTOK_MESSAGE_RECONCILIATION_BUSINESS_MISMATCH");
    }

    if (context.providerMessageId) {
      return {
        provider: this.name,
        platform: "tiktok",
        senderProviderProfileId: context.businessId,
        providerRecipientId: context.providerRecipientId,
        providerMessageId: context.providerMessageId,
        state: "sent",
        observedAt: new Date().toISOString(),
      };
    }

    const createdAt = Date.parse(context.createdAt);
    if (!Number.isFinite(createdAt)) {
      throw new Error("TIKTOK_MESSAGE_RECONCILIATION_TIME_INVALID");
    }

    const candidates = (await this.client.listMessages(context.conversationId))
      .filter((message) =>
        message.direction === "outbound" &&
        message.source === "API" &&
        message.messageType === "TEXT" &&
        message.text?.trim() === context.text.trim() &&
        Date.parse(message.occurredAt) >= createdAt,
      );

    if (candidates.length === 0) return null;
    if (candidates.length !== 1) {
      throw new Error("TIKTOK_MESSAGE_RECONCILIATION_AMBIGUOUS");
    }

    const matched = candidates[0];
    return {
      provider: this.name,
      platform: "tiktok",
      senderProviderProfileId: context.businessId,
      providerRecipientId: context.providerRecipientId,
      providerMessageId: matched.messageId,
      state: "sent",
      observedAt: matched.occurredAt,
    };
  }
}

export function assertTikTokMessagingAuthorization(
  authorization: TikTokBusinessAuthorization,
): void {
  if (!authorization.businessId.trim()) {
    throw new Error("TIKTOK_BUSINESS_ID_REQUIRED");
  }
  const scopes = new Set(authorization.scopes);
  if (!scopes.has(TIKTOK_BUSINESS_MESSAGE_READ_SCOPE)) {
    throw new Error("TIKTOK_MESSAGE_READ_SCOPE_REQUIRED");
  }
  if (!scopes.has(TIKTOK_BUSINESS_MESSAGE_SEND_SCOPE)) {
    throw new Error("TIKTOK_MESSAGE_SEND_SCOPE_REQUIRED");
  }
  normalizeTimestamp(
    authorization.observedAt,
    "TIKTOK_AUTHORIZATION_OBSERVED_AT_INVALID",
  );
}

function normalizeTimestamp(value: string, code: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(code);
  return new Date(timestamp).toISOString();
}

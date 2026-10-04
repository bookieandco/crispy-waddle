import { describe, expect, it } from "vitest";
import {
  CjPublisherCommissionAdapter,
  PartnerizePartnerReportingAdapter,
  normalizeCjPublisherCommission,
  normalizePartnerizeClick,
  normalizePartnerizeConversion,
} from "@jhadina/commerce-adapters";

describe("affiliate network adapters", () => {
  it("normalizes Partnerize clicks as traffic observations", () => {
    const click = normalizePartnerizeClick({
      campaign_id: "campaign-1",
      publisher_id: "publisher-1",
      set_time: "2026-10-03 12:00:00",
      publisher_reference: "session-1",
      clickref: "click-1",
    });

    expect(click).toMatchObject({
      provider: "partnerize",
      accountRef: "partnerize:publisher:publisher-1",
      programRef: "partnerize:campaign:campaign-1",
      externalEventRef: "partnerize:click:click-1",
      kind: "click",
      customerOrSessionRef: "session-1",
      occurredAt: "2026-10-03T12:00:00.000Z",
    });
  });

  it("preserves Partnerize conversion approval separately from the conversion event", () => {
    const conversion = normalizePartnerizeConversion({
      conversion_id: "conversion-1",
      campaign_id: "campaign-1",
      publisher_id: "publisher-1",
      conversion_time: "2026-10-03 12:05:00",
      currency: "usd",
      customer_reference: "customer-1",
      conversion_value: {
        conversion_status: "approved",
        publisher_commission: "25.50",
        value: "255",
      },
    });

    expect(conversion).toMatchObject({
      kind: "conversion",
      providerStatus: "approved",
      economicState: "approved",
      amount: 25.5,
      currency: "USD",
    });
  });

  it("reads Partnerize click and conversion reports without granting write authority", async () => {
    const requested: string[] = [];
    const adapter = new PartnerizePartnerReportingAdapter(
      async (url) => {
        requested.push(url);
        const isClick = url.includes("/click.json");
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          async json() {
            return isClick
              ? {
                  count: 1,
                  limit: 100,
                  offset: 0,
                  clicks: [
                    {
                      click: {
                        campaign_id: "campaign-1",
                        publisher_id: "publisher-1",
                        set_time: "2026-10-03 12:00:00",
                        clickref: "click-1",
                      },
                    },
                  ],
                }
              : {
                  count: 1,
                  limit: 100,
                  offset: 0,
                  conversions: [
                    {
                      conversion_data: {
                        conversion_id: "conversion-1",
                        campaign_id: "campaign-1",
                        publisher_id: "publisher-1",
                        conversion_time: "2026-10-03 12:05:00",
                        currency: "USD",
                        conversion_value: {
                          conversion_status: "pending",
                          publisher_commission: 10,
                        },
                      },
                    },
                  ],
                };
          },
        };
      },
      { authorizationHeader: "Basic fixture-token" },
    );

    const batch = await adapter.read({
      accountRef: "publisher-1",
      startAt: "2026-10-03T00:00:00Z",
      endAt: "2026-10-04T00:00:00Z",
      limit: 100,
    });

    expect(batch.observations).toHaveLength(2);
    expect(batch.readOnly).toBe(true);
    expect(requested).toHaveLength(2);
    expect(requested[0]).toContain("timezone=UTC");
  });

  it("maps CJ original commissions and negative corrections without calling closed paid", () => {
    const original = normalizeCjPublisherCommission({
      commissionId: "100",
      advertiserId: "200",
      publisherId: "300",
      advertiserName: "Merchant",
      orderId: "order-1",
      actionStatus: "CLOSED",
      validationStatus: "ACCEPTED",
      original: true,
      originalActionId: "action-1",
      postingDate: "2026-10-03T12:00:00Z",
      eventDate: "2026-10-03T11:59:00Z",
      pubCommissionAmountUsd: "30.00",
    });
    expect(original).toMatchObject({
      kind: "conversion",
      economicState: "approved",
      amount: 30,
      currency: "USD",
    });
    expect(original?.economicState).not.toBe("paid");

    const correction = normalizeCjPublisherCommission({
      commissionId: "101",
      advertiserId: "200",
      publisherId: "300",
      actionStatus: "CLOSED",
      validationStatus: "DECLINED",
      original: false,
      originalActionId: "action-1",
      correctionReason: "RETURNED_MERCHANDISE",
      postingDate: "2026-10-04T12:00:00Z",
      eventDate: "2026-10-04T11:59:00Z",
      pubCommissionAmountUsd: "-30.00",
    });
    expect(correction).toMatchObject({
      kind: "reversal",
      economicState: "rejected",
      amount: 30,
    });
  });

  it("uses CJ commission watermark pagination", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const adapter = new CjPublisherCommissionAdapter(
      async (_url, init) => {
        requests.push(JSON.parse(init?.body ?? "{}") as Record<string, unknown>);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          async json() {
            return {
              data: {
                publisherCommissions: {
                  count: 1,
                  limit: 100,
                  maxCommissionId: "999",
                  payloadComplete: false,
                  records: [
                    {
                      commissionId: "998",
                      advertiserId: "200",
                      publisherId: "300",
                      actionStatus: "NEW",
                      validationStatus: "PENDING",
                      original: true,
                      originalActionId: "action-1",
                      postingDate: "2026-10-03T12:00:00Z",
                      eventDate: "2026-10-03T11:59:00Z",
                      pubCommissionAmountUsd: "5.00",
                    },
                  ],
                },
              },
            };
          },
        };
      },
      { personalAccessToken: "fixture-token" },
    );

    const batch = await adapter.read({
      accountRef: "300",
      startAt: "2026-10-01T00:00:00Z",
      cursor: "900",
    });

    expect(batch.complete).toBe(false);
    expect(batch.nextCursor).toBe("999");
    const variables = (
      requests[0].variables as Record<string, unknown>
    );
    expect(variables.sinceCommissionId).toBe("900");
    expect(variables.publishers).toEqual(["300"]);
  });
});

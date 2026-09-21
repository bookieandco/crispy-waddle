import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFreeSignal, mergeConnectivityOpportunities } from "./free-signal-scout.js";

test("visible Wi-Fi is not assumed to be free", () => {
  const result = classifyFreeSignal({
    id: "wifi-1",
    transport: "wifi",
    label: "CoffeeShop",
    access: "unknown",
    source: "device",
    observedAt: "2026-08-25T00:00:00.000Z",
  });

  assert.equal(result.free, false);
  assert.equal(result.verifiedFree, false);
});

test("verified public catalog opportunities rank first", () => {
  const result = mergeConnectivityOpportunities(
    [
      {
        id: "wifi-1",
        transport: "wifi",
        label: "OpenNetwork",
        access: "unknown",
        source: "device",
        observedAt: "2026-08-25T00:00:00.000Z",
      },
    ],
    [
      {
        id: "public-1",
        transport: "wifi",
        label: "Public WiFi",
        access: "authorized",
        source: "public-catalog",
        observedAt: "2026-08-25T00:00:00.000Z",
        free: true,
        verifiedFree: true,
        distanceMeters: 500,
      },
    ],
  );

  assert.equal(result[0]?.id, "public-1");
  assert.equal(result[0]?.verifiedFree, true);
});

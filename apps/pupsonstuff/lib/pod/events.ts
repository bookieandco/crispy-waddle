export type PodEvent =
  | { type: "creation.created"; creationId: string }
  | { type: "artwork.generated"; creationId: string; assetId: string }
  | { type: "qa.completed"; creationId: string; productionReady: boolean; score: number }
  | { type: "customer.approved"; creationId: string }
  | { type: "provider.order-created"; creationId: string; orderId: string }
  | { type: "fulfillment.shipped"; creationId: string; trackingNumber?: string };

export function canFulfill(event: PodEvent) {
  return event.type === "customer.approved";
}

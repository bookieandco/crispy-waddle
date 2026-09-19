import type {
  CommerceAuthorizationDecision,
  CommerceIntent,
} from "@jhadina/opportunity-contracts";

export interface SupplierProcurementRequest {
  intent: CommerceIntent;
  authorization: CommerceAuthorizationDecision;
  idempotencyKey: string;
  supplierId: string;
  connectionId: string;
  inventoryId: string;
  quantity: number;
}

export interface SupplierExternalOrderReference {
  provider: string;
  externalId: string;
  externalVersion?: string;
}

export type SupplierProcurementStatus =
  | "accepted"
  | "submitted"
  | "confirmed"
  | "rejected"
  | "failed";

export interface SupplierProcurementResult {
  procurementId: string;
  status: SupplierProcurementStatus;
  supplierId: string;
  connectionId: string;
  quantity: number;
  externalOrder?: SupplierExternalOrderReference;
  submittedAt?: string;
  errorCode?: string;
}

/**
 * Provider port for supplier purchasing. Implementations must be invoked only
 * after the Commerce authorization/approval boundary has accepted the intent.
 * This contract intentionally contains no authorization logic and no payment
 * execution; those remain outside the adapter.
 */
export interface SupplierProcurementAdapter {
  readonly name: string;
  submit(request: SupplierProcurementRequest): Promise<SupplierProcurementResult>;
  getByIdempotencyKey(idempotencyKey: string): Promise<SupplierProcurementResult | null>;
}

export function assertAuthorizedSupplierProcurement(
  request: SupplierProcurementRequest,
): void {
  if (request.authorization.decision !== "allow") {
    throw new Error("Supplier procurement requires an allowed commerce authorization");
  }
  if (!request.intent.idempotencyKey || request.intent.idempotencyKey !== request.idempotencyKey) {
    throw new Error("Supplier procurement idempotency key mismatch");
  }
  if (request.intent.kind !== "financial_commitment") {
    throw new Error("Supplier procurement requires a financial commitment intent");
  }
  if (request.intent.resourceType !== "supplier_procurement") {
    throw new Error("Supplier procurement requires a supplier_procurement resource");
  }
  if (!request.supplierId.trim()) throw new Error("supplierId is required");
  if (!request.connectionId.trim()) throw new Error("connectionId is required");
  if (!request.inventoryId.trim()) throw new Error("inventoryId is required");
  if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
    throw new Error("quantity must be a positive integer");
  }
}

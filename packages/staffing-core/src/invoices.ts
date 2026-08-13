import type { SqlExecutor } from "./postgres-adapters.js";

export type InvoiceStatus = "ISSUED" | "VOID" | "PAID";

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitRate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  placementId: string;
  timesheetId: string;
  agreementId: string;
  currency: string;
  subtotal: number;
  status: InvoiceStatus;
  issuedAt: string;
  createdAt: string;
}

export interface InvoiceGenerator {
  transaction<T>(work: (tx: InvoiceGenerator) => Promise<T>): Promise<T>;
  getApprovedTimesheet(timesheetId: string, organizationId: string): Promise<any | null>;
  getPlacement(placementId: string, organizationId: string): Promise<any | null>;
  getResolvedAgreement(placementId: string, organizationId: string): Promise<any | null>;
  createInvoice(invoice: Invoice): Promise<Invoice>;
  createLine(line: InvoiceLine): Promise<InvoiceLine>;
  writeEvent(event: { id: string; type: "INVOICE_ISSUED"; aggregateId: string; organizationId: string; occurredAt: string; payload: unknown }): Promise<void>;
}

export class InvoiceGenerationService {
  constructor(private readonly db: InvoiceGenerator, private readonly ids: { next(prefix: string): string }, private readonly clock: { now(): string }) {}

  async generate(timesheetId: string, organizationId: string): Promise<Invoice> {
    return this.db.transaction(async (tx) => {
      const timesheet = await tx.getApprovedTimesheet(timesheetId, organizationId);
      if (!timesheet || timesheet.status !== "APPROVED") throw new Error("Only approved timesheets can generate invoices");
      const placement = await tx.getPlacement(timesheet.placementId, organizationId);
      if (!placement) throw new Error("Placement not found");
      const agreement = await tx.getResolvedAgreement(placement.id, organizationId);
      if (!agreement) throw new Error("No resolved agreement found for placement");
      if (agreement.currency !== placement.currency) throw new Error("Agreement currency does not match placement currency");
      const regular = Number(timesheet.regularHours);
      const overtime = Number(timesheet.overtimeHours);
      const regularAmount = Number((regular * Number(agreement.billingRate)).toFixed(2));
      const overtimeAmount = Number((overtime * Number(agreement.billingRate)).toFixed(2));
      const subtotal = Number((regularAmount + overtimeAmount).toFixed(2));
      if (subtotal <= 0) throw new Error("Cannot issue an invoice with zero billable value");
      const now = this.clock.now();
      const invoiceId = this.ids.next("invoice");
      const invoice = await tx.createInvoice({ id: invoiceId, organizationId, placementId: placement.id, timesheetId, agreementId: agreement.agreementId, currency: agreement.currency, subtotal, status: "ISSUED", issuedAt: now, createdAt: now });
      if (regular > 0) await tx.createLine({ id: this.ids.next("line"), invoiceId, description: "Regular hours", quantity: regular, unitRate: Number(agreement.billingRate), amount: regularAmount });
      if (overtime > 0) await tx.createLine({ id: this.ids.next("line"), invoiceId, description: "Overtime hours", quantity: overtime, unitRate: Number(agreement.billingRate), amount: overtimeAmount });
      await tx.writeEvent({ id: this.ids.next("event"), type: "INVOICE_ISSUED", aggregateId: invoiceId, organizationId, occurredAt: now, payload: invoice });
      return invoice;
    });
  }
}

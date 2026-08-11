import type { ID } from "./domain.js";
import type { BillingCalculation } from "./billing.js";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID" | "OVERDUE";
export type PaymentStatus = "PENDING" | "SETTLED" | "FAILED" | "REFUNDED";
export interface Invoice { id: ID; organizationId: ID; employerId: ID; agencyId: ID; timesheetId: ID; number: string; currency: string; subtotal: number; total: number; dueAt: string; status: InvoiceStatus; issuedAt?: string; }
export interface Payment { id: ID; invoiceId: ID; amount: number; currency: string; status: PaymentStatus; receivedAt?: string; externalReference?: string; }
export interface RevenueLedgerEntry { id: ID; organizationId: ID; invoiceId: ID; type: "INVOICE_ISSUED" | "PAYMENT_RECEIVED" | "PLATFORM_FEE" | "REFUND"; amount: number; currency: string; occurredAt: string; }
export interface InvoiceRepository { saveInvoice(invoice: Invoice): Promise<void>; issueInvoice(id: ID): Promise<Invoice>; savePayment(payment: Payment): Promise<void>; updateInvoiceStatus(id: ID, status: InvoiceStatus): Promise<Invoice>; saveLedgerEntry(entry: RevenueLedgerEntry): Promise<void>; }
export interface InvoiceIds { next(prefix: string): ID; }
export interface InvoiceClock { now(): string; }
export class InvoiceLedgerService {
  constructor(private readonly repository: InvoiceRepository, private readonly ids: InvoiceIds, private readonly clock: InvoiceClock) {}
  async draftFromBilling(input: { organizationId: ID; employerId: ID; agencyId: ID; timesheetId: ID; invoiceNumber: string; dueAt: string; billing: BillingCalculation }): Promise<Invoice> {
    const invoice: Invoice = { id: this.ids.next("invoice"), organizationId: input.organizationId, employerId: input.employerId, agencyId: input.agencyId, timesheetId: input.timesheetId, number: input.invoiceNumber, currency: input.billing.currency, subtotal: input.billing.employerBill, total: input.billing.employerBill, dueAt: input.dueAt, status: "DRAFT" };
    await this.repository.saveInvoice(invoice); return invoice;
  }
  async issue(invoiceId: ID): Promise<Invoice> {
    const invoice = await this.repository.issueInvoice(invoiceId);
    await this.repository.saveLedgerEntry({ id: this.ids.next("ledger"), organizationId: invoice.organizationId, invoiceId: invoice.id, type: "INVOICE_ISSUED", amount: invoice.total, currency: invoice.currency, occurredAt: this.clock.now() });
    return invoice;
  }
}

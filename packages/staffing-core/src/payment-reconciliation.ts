import type { ID } from "./agency-agreements.js";

export type InvoicePaymentStatus = "PARTIALLY_PAID" | "PAID";

export interface PaymentReceipt { organizationId:ID; provider:string; externalPaymentId:string; invoiceId:ID; employerId:ID; amount:number; currency:string; receivedAt:string; }
export interface PaymentReconciliationResult { paymentId:string; invoiceId:ID; status:InvoicePaymentStatus; appliedAmount:number; remainingAmount:number; }

export interface PaymentReconciliationStore {
  findByExternalId(key:{organizationId:ID;provider:string;externalPaymentId:string}):Promise<PaymentReconciliationResult|null>;
  lockInvoice(invoiceId:ID,organizationId:ID):Promise<{id:ID;total:number;paid:number;currency:string;status:string}|null>;
  recordPayment(payment:PaymentReceipt):Promise<string>;
  updateInvoicePaid(invoiceId:ID,organizationId:ID,paid:number,status:InvoicePaymentStatus):Promise<void>;
  recordCashLedgerEntry(input:{organizationId:ID;invoiceId:ID;paymentId:string;amount:number;currency:string;occurredAt:string}):Promise<void>;
}

export class PaymentReconciliationService {
  constructor(private readonly store:PaymentReconciliationStore,private readonly ids:{next(prefix:string):string}){}

  async reconcile(payment:PaymentReceipt):Promise<PaymentReconciliationResult>{
    if(payment.amount<=0) throw new Error("Payment amount must be positive");
    const existing=await this.store.findByExternalId(payment);
    if(existing) return existing;
    const invoice=await this.store.lockInvoice(payment.invoiceId,payment.organizationId);
    if(!invoice) throw new Error("Invoice not found");
    if(invoice.currency!==payment.currency) throw new Error("Payment currency does not match invoice currency");
    if(["PAID","VOID"].includes(invoice.status)) throw new Error("Invoice cannot accept payment");
    const remaining=Math.max(0,invoice.total-invoice.paid);
    if(payment.amount>remaining) throw new Error("Payment exceeds invoice balance");
    const applied=payment.amount;
    const status:InvoicePaymentStatus=applied===remaining?"PAID":"PARTIALLY_PAID";
    const paymentId=await this.store.recordPayment(payment);
    await this.store.updateInvoicePaid(invoice.id,payment.organizationId,invoice.paid+applied,status);
    await this.store.recordCashLedgerEntry({organizationId:payment.organizationId,invoiceId:invoice.id,paymentId,amount:applied,currency:payment.currency,occurredAt:payment.receivedAt});
    return {paymentId,invoiceId:invoice.id,status,appliedAmount:applied,remainingAmount:remaining-applied};
  }
}

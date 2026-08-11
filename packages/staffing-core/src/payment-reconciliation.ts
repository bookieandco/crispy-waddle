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

export interface PaymentTransaction { run<T>(work:(store:PaymentReconciliationStore)=>Promise<T>):Promise<T>; }

export class PaymentReconciliationService {
  constructor(private readonly store:PaymentReconciliationStore,private readonly ids:{next(prefix:string):string},private readonly transaction?:PaymentTransaction){}

  async reconcile(payment:PaymentReceipt):Promise<PaymentReconciliationResult>{
    if(payment.amount<=0) throw new Error("Payment amount must be positive");
    const execute=async(store:PaymentReconciliationStore):Promise<PaymentReconciliationResult>=>{
      const existing=await store.findByExternalId(payment);
      if(existing) return existing;
      const invoice=await store.lockInvoice(payment.invoiceId,payment.organizationId);
      if(!invoice) throw new Error("Invoice not found");
      // The external-id check races with another delivery, so check again after acquiring the invoice lock.
      const existingAfterLock=await store.findByExternalId(payment);
      if(existingAfterLock) return existingAfterLock;
      const invoiceTotal=Number(invoice.total);
      const invoicePaid=Number(invoice.paid);
      if(!Number.isFinite(invoiceTotal)||!Number.isFinite(invoicePaid)) throw new Error("Invoice amounts are invalid");
      if(invoice.currency!==payment.currency) throw new Error("Payment currency does not match invoice currency");
      if(["PAID","VOID"].includes(invoice.status)) throw new Error("Invoice cannot accept payment");
      const remaining=Math.max(0,invoiceTotal-invoicePaid);
      if(payment.amount>remaining) throw new Error("Payment exceeds invoice balance");
      const applied=payment.amount;
      const status:InvoicePaymentStatus=applied===remaining?"PAID":"PARTIALLY_PAID";
      const paymentId=await store.recordPayment(payment);
      await store.updateInvoicePaid(invoice.id,payment.organizationId,invoicePaid+applied,status);
      await store.recordCashLedgerEntry({organizationId:payment.organizationId,invoiceId:invoice.id,paymentId,amount:applied,currency:payment.currency,occurredAt:payment.receivedAt});
      return {paymentId,invoiceId:invoice.id,status,appliedAmount:applied,remainingAmount:remaining-applied};
    };
    return this.transaction ? this.transaction.run(execute) : execute(this.store);
  }
}

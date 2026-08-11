import type { ID } from "./agency-agreements.js";
import type { PaymentReceipt, PaymentReconciliationResult, PaymentReconciliationStore, InvoicePaymentStatus } from "./payment-reconciliation.js";
import type { SqlExecutor } from "./postgres-adapters.js";

export class PostgresPaymentReconciliationRepository implements PaymentReconciliationStore {
  constructor(private readonly db:SqlExecutor,private readonly ids:{next(prefix:string):string}){}

  async findByExternalId(key:{organizationId:ID;provider:string;externalPaymentId:string}):Promise<PaymentReconciliationResult|null>{
    const rows=await this.db.query<any>(`select p.id as "paymentId",p.invoice_id as "invoiceId",i.status,p.amount as "appliedAmount",greatest(0,i.total-i.paid) as "remainingAmount" from staffing_payments p join invoices i on i.id=p.invoice_id where p.organization_id=$1 and p.provider=$2 and p.external_payment_id=$3 limit 1`,[key.organizationId,key.provider,key.externalPaymentId]);
    return rows[0]??null;
  }

  async lockInvoice(invoiceId:ID,organizationId:ID){
    const rows=await this.db.query<any>(`select id,total,paid,currency,status from invoices where id=$1 and organization_id=$2 for update`,[invoiceId,organizationId]);
    return rows[0]??null;
  }

  async recordPayment(payment:PaymentReceipt):Promise<string>{
    const id=this.ids.next("payment");
    const rows=await this.db.query<any>(`insert into staffing_payments (id,organization_id,provider,external_payment_id,invoice_id,employer_id,amount,currency,received_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (organization_id,provider,external_payment_id) do nothing returning id`,[id,payment.organizationId,payment.provider,payment.externalPaymentId,payment.invoiceId,payment.employerId,payment.amount,payment.currency,payment.receivedAt]);
    if(rows[0]?.id) return rows[0].id;
    const existing=await this.db.query<any>(`select id from staffing_payments where organization_id=$1 and provider=$2 and external_payment_id=$3`,[payment.organizationId,payment.provider,payment.externalPaymentId]);
    if(!existing[0]) throw new Error("Payment reservation lost without a durable payment record");
    return existing[0].id;
  }

  async updateInvoicePaid(invoiceId:ID,organizationId:ID,paid:number,status:InvoicePaymentStatus):Promise<void>{
    await this.db.query(`update invoices set paid=$3,status=$4 where id=$1 and organization_id=$2`,[invoiceId,organizationId,paid,status]);
  }

  async recordCashLedgerEntry(input:{organizationId:ID;invoiceId:ID;paymentId:string;amount:number;currency:string;occurredAt:string}):Promise<void>{
    await this.db.query(`insert into staffing_cash_ledger_entries (id,organization_id,invoice_id,payment_id,amount,currency,occurred_at) values ($1,$2,$3,$4,$5,$6,$7) on conflict (organization_id,payment_id) do nothing`,[this.ids.next("cash"),input.organizationId,input.invoiceId,input.paymentId,input.amount,input.currency,input.occurredAt]);
  }
}

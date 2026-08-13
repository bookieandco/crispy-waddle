export interface FinancialAmount {
  amount: number;
  currency: string;
}

export interface InvoiceBalance extends FinancialAmount {
  invoiced: number;
  settled: number;
  outstanding: number;
  status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERPAID";
}

export function calculateInvoiceBalance(
  total: number,
  payments: FinancialAmount[],
): InvoiceBalance {
  if (total < 0) throw new Error("Invoice total cannot be negative");
  const currency = payments[0]?.currency ?? "USD";
  if (payments.some((payment) => payment.currency !== currency)) {
    throw new Error("Invoice payments must use one currency");
  }
  const settled = payments.reduce((sum, payment) => {
    if (payment.amount <= 0) throw new Error("Payment amount must be positive");
    return sum + payment.amount;
  }, 0);
  const outstanding = Math.max(0, total - settled);
  const status = settled === 0 ? "OPEN" : settled < total ? "PARTIALLY_PAID" : settled === total ? "PAID" : "OVERPAID";
  return { amount: outstanding, currency, invoiced: total, settled, outstanding, status };
}

export function assertSameCurrency(expected: string, actual: string): void {
  if (expected !== actual) throw new Error(`Currency mismatch: expected ${expected}, received ${actual}`);
}

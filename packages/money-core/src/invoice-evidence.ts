/** Invoice/document evidence boundary. Extraction is not accounting recognition. */

export interface InvoiceEvidence {
  evidenceId: string;
  documentHash: string;
  sourceUri: string;
  issuerName?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  grossAmount?: number;
  taxAmount?: number;
  extractedAt: string;
  extractorVersion: string;
  confidence: number;
}

export type InvoiceValidationState =
  | 'VALID'
  | 'POSSIBLE_DUPLICATE'
  | 'DUPLICATE'
  | 'CONFLICTING'
  | 'INCOMPLETE'
  | 'UNKNOWN';

export interface InvoiceAccountingCandidate {
  candidateId: string;
  evidenceId: string;
  validation: InvoiceValidationState;
  vendorOrCustomerId?: string;
  contractId?: string;
  amount?: number;
  currency?: string;
  proposedAccount?: string;
  proposedTaxCode?: string;
  rationale: string;
  requiresApproval: boolean;
}

export function validateInvoiceAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invoice amount must be finite and non-negative');
}

export function validateExtractionConfidence(confidence: number): void {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Extraction confidence must be between 0 and 1');
  }
}

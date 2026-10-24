/** Provider-boundary check. A dry run never contacts Printify, including
 * lookups for ambiguous prior orders. Live fulfillment is a separately
 * authorized capability, not inferred from a configured Printify token. */
export function assertPrintifySubmissionApproved(
  env: Record<string,string|undefined> = process.env,
): void {
  if (env.PUPSON_FULFILLMENT_MODE !== 'live') {
    throw new Error('Printify network calls are disabled in dry-run mode.');
  }
  if (env.PUPSON_LIVE_COMMERCE_APPROVED !== 'true' ||
      env.PUPSON_PAYMENT_OPERATIONS_READY !== 'true' ||
      env.PUPSON_PUBLIC_RELEASE_APPROVED !== 'true' ||
      env.PUPSON_PRINTIFY_SUBMISSION_APPROVED !== 'true' ||
      !env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ||
      env.VERCEL_ENV !== 'production') {
    throw new Error('Printify submission requires separately approved live commerce and fulfillment.');
  }
}

export type GateStatus = 'pass' | 'block' | 'warn';

export interface GateCheck {
  id: string;
  status: GateStatus;
  message: string;
}

export interface StorageBucketSummary {
  id: string;
  public: boolean;
  file_size_limit?: number | null;
  allowed_mime_types?: string[] | null;
}

export interface CatalogVariantSummary {
  product_id: string;
  variant_id: string;
  active: boolean;
  provider: string;
  certification_status: string;
}

const REQUIRED_PRIVATE_BUCKETS = [
  'pupson-originals',
  'pupson-creative',
  'pupson-print-ready',
] as const;

function present(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function secretLengthCheck(
  id: string,
  label: string,
  value: string | undefined,
  minimum: number
): GateCheck {
  if (!present(value)) return { id, status: 'block', message: `${label} is not configured.` };
  if (value!.length < minimum)
    return {
      id,
      status: 'block',
      message: `${label} must be at least ${minimum} characters.`,
    };
  return { id, status: 'pass', message: `${label} is configured.` };
}

export function evaluateLaunchEnvironment(
  env: NodeJS.ProcessEnv = process.env
): GateCheck[] {
  const checks: GateCheck[] = [];
  const required = [
    ['SUPABASE_URL', 'Supabase URL'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service-role key'],
    ['STRIPE_SECRET_KEY', 'Stripe secret key'],
    ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook secret'],
    ['PRINTIFY_API_KEY', 'Printify API key'],
    ['PRINTIFY_SHOP_ID', 'Printify shop ID'],
    ['OPENAI_API_KEY', 'OpenAI API key'],
    ['MUAPI_API_KEY', 'Muapi API key'],
  ] as const;

  for (const [key, label] of required) {
    checks.push({
      id: `env.${key}`,
      status: present(env[key]) ? 'pass' : 'block',
      message: present(env[key]) ? `${label} is configured.` : `${label} is not configured.`,
    });
  }

  checks.push(
    secretLengthCheck('env.CRON_SECRET', 'Creative worker cron secret', env.CRON_SECRET, 32),
    secretLengthCheck(
      'env.PUPSON_ADMIN_SESSION_SECRET',
      'Admin session secret',
      env.PUPSON_ADMIN_SESSION_SECRET,
      32
    ),
    secretLengthCheck(
      'env.PUPSON_ADMIN_PASSWORD',
      'Admin password',
      env.PUPSON_ADMIN_PASSWORD,
      20
    ),
    secretLengthCheck(
      'env.PUPSON_PRINTIFY_WEBHOOK_SECRET',
      'Printify webhook secret',
      env.PUPSON_PRINTIFY_WEBHOOK_SECRET,
      32
    )
  );

  const removerProvider = env.PUPSON_BACKGROUND_REMOVER_PROVIDER?.trim();
  const removerUrl = env.PUPSON_BACKGROUND_REMOVER_URL?.trim();
  const knockoutToken = env.KNOCKOUT_TOKEN?.trim();
  const selfHostedRemover =
    (!removerProvider || removerProvider === 'backgroundremover') &&
    Boolean(removerUrl?.startsWith('https://'));
  const knockoutRemover =
    removerProvider === 'knockout' && Boolean(knockoutToken);
  checks.push({
    id: 'env.BACKGROUND_REMOVER',
    status: selfHostedRemover || knockoutRemover ? 'pass' : 'block',
    message: selfHostedRemover
      ? 'Self-hosted background removal is configured over HTTPS.'
      : knockoutRemover
        ? 'BiRefNet background removal is configured.'
        : 'Configure an HTTPS self-hosted background-removal service or a BiRefNet provider token.',
  });

  const upscalerUrl = env.PUPSON_UPSCALER_URL?.trim();
  const upscalerConfigured =
    Boolean(upscalerUrl?.startsWith('https://')) || Boolean(knockoutToken);
  checks.push({
    id: 'env.IMAGE_UPSCALER',
    status: upscalerConfigured ? 'pass' : 'block',
    message: upscalerConfigured
      ? 'A print-resolution AI upscaler is configured.'
      : 'Configure an HTTPS PUPSON_UPSCALER_URL or KNOCKOUT_TOKEN so enlarged artwork cannot bypass the source-resolution gate.',
  });

  checks.push({
    id: 'env.PUPSON_ADMIN_USERNAME',
    status: present(env.PUPSON_ADMIN_USERNAME) ? 'pass' : 'block',
    message: present(env.PUPSON_ADMIN_USERNAME)
      ? 'Admin username is configured.'
      : 'Admin username is not configured.',
  });

  checks.push({
    id: 'env.PUPSON_FULFILLMENT_MODE',
    status: env.PUPSON_FULFILLMENT_MODE === 'dry_run' ? 'pass' : 'block',
    message:
      env.PUPSON_FULFILLMENT_MODE === 'dry_run'
        ? 'Fulfillment is safely locked to dry_run.'
        : 'PUPSON_FULFILLMENT_MODE must remain dry_run until physical samples pass.',
  });

  const origin = env.PUPSON_PUBLIC_ORIGIN;
  checks.push({
    id: 'env.PUPSON_PUBLIC_ORIGIN',
    status: origin?.startsWith('https://') ? 'pass' : 'block',
    message: origin?.startsWith('https://')
      ? 'Public origin uses HTTPS.'
      : 'PUPSON_PUBLIC_ORIGIN must be the canonical HTTPS deployment origin.',
  });

  const stripeKey = env.STRIPE_SECRET_KEY;
  checks.push({
    id: 'env.STRIPE_MODE',
    status: stripeKey?.startsWith('sk_test_') ? 'pass' : 'block',
    message: stripeKey?.startsWith('sk_test_')
      ? 'Stripe is configured in test mode for certification.'
      : 'Certification requires a Stripe test-mode secret key.',
  });

  checks.push({
    id: 'env.STRIPE_WEBHOOK_FORMAT',
    status: env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_') ? 'pass' : 'block',
    message: env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')
      ? 'Stripe webhook secret format is valid.'
      : 'STRIPE_WEBHOOK_SECRET must be an endpoint signing secret (whsec_...).',
  });

  for (const key of [
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PRINTIFY_API_KEY',
    'PUPSON_ADMIN_PASSWORD',
    'PUPSON_ADMIN_SESSION_SECRET',
    'PUPSON_PRINTIFY_WEBHOOK_SECRET',
    'CRON_SECRET',
    'PUPSON_BACKGROUND_REMOVER_TOKEN',
    'PUPSON_UPSCALER_TOKEN',
    'KNOCKOUT_TOKEN',
  ]) {
    checks.push({
      id: `env.public.${key}`,
      status: present(env[`NEXT_PUBLIC_${key}`]) ? 'block' : 'pass',
      message: present(env[`NEXT_PUBLIC_${key}`])
        ? `NEXT_PUBLIC_${key} exposes a server secret and must be removed.`
        : `${key} is not exposed through a NEXT_PUBLIC_ alias.`,
    });
  }

  return checks;
}

export function evaluateStorageBuckets(buckets: StorageBucketSummary[]): GateCheck[] {
  const byId = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  return REQUIRED_PRIVATE_BUCKETS.map((id) => {
    const bucket = byId.get(id);
    if (!bucket) return { id: `storage.${id}`, status: 'block', message: `${id} is missing.` };
    if (bucket.public)
      return {
        id: `storage.${id}`,
        status: 'block',
        message: `${id} is public and must be private.`,
      };
    return { id: `storage.${id}`, status: 'pass', message: `${id} is private.` };
  });
}

export function evaluateCatalog(rows: CatalogVariantSummary[]): GateCheck[] {
  const certified = rows.filter(
    (row) =>
      row.active &&
      row.provider === 'printify' &&
      ['sandbox_verified', 'sample_verified'].includes(row.certification_status)
  );
  const samples = certified.filter((row) => row.certification_status === 'sample_verified');
  return [
    {
      id: 'catalog.sandbox',
      status: certified.length > 0 ? 'pass' : 'block',
      message:
        certified.length > 0
          ? `${certified.length} active Printify variant(s) passed sandbox certification.`
          : 'No active Printify variants have passed sandbox certification.',
    },
    {
      id: 'catalog.samples',
      status: samples.length > 0 ? 'pass' : 'block',
      message:
        samples.length > 0
          ? `${samples.length} active Printify variant(s) passed physical-sample certification.`
          : 'No active Printify variants have passed the physical-sample gate.',
    },
  ];
}

export function summarizeGate(checks: GateCheck[]) {
  return {
    pass: checks.filter((check) => check.status === 'pass').length,
    warn: checks.filter((check) => check.status === 'warn').length,
    block: checks.filter((check) => check.status === 'block').length,
  };
}

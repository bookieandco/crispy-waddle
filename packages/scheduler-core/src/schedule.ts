export type ScheduleDialect = 'posix';

export type ScheduleOverlapPolicy = 'allow' | 'skip' | 'replace';

export type Schedule = {
  id: string;
  name: string;
  expression: string;
  dialect: ScheduleDialect;
  timezone: string;
  enabled: boolean;
  target: string;
  timeoutMs?: number;
  overlapPolicy: ScheduleOverlapPolicy;
  maxConcurrency?: number;
};

export type ScheduleValidationIssue = {
  field: keyof Schedule;
  message: string;
};

export type ScheduleValidationResult =
  | { ok: true; value: Schedule }
  | { ok: false; issues: ScheduleValidationIssue[] };

const CRON_FIELD = /^(?:\*|\d+|\d+-\d+|\d+(?:,\d+)+|\*\/\d+|\d+-\d+\/\d+)$/;

function validCronExpression(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 && fields.every((field) => CRON_FIELD.test(field));
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function nonNegativeInteger(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value >= 0);
}

/**
 * Canonical runtime boundary for schedules.
 * Platform adapters must consume this contract rather than raw UI config.
 */
export function validateSchedule(input: unknown): ScheduleValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, issues: [{ field: 'id', message: 'Schedule must be an object.' }] };
  }

  const candidate = input as Partial<Schedule>;
  const issues: ScheduleValidationIssue[] = [];

  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    issues.push({ field: 'id', message: 'id is required.' });
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
    issues.push({ field: 'name', message: 'name is required.' });
  }
  if (typeof candidate.expression !== 'string' || !validCronExpression(candidate.expression)) {
    issues.push({ field: 'expression', message: 'expression must be a five-field POSIX cron expression.' });
  }
  if (candidate.dialect !== 'posix') {
    issues.push({ field: 'dialect', message: 'dialect must be posix.' });
  }
  if (typeof candidate.timezone !== 'string' || !validTimezone(candidate.timezone)) {
    issues.push({ field: 'timezone', message: 'timezone must be a valid IANA timezone.' });
  }
  if (typeof candidate.enabled !== 'boolean') {
    issues.push({ field: 'enabled', message: 'enabled must be boolean.' });
  }
  if (typeof candidate.target !== 'string' || candidate.target.trim() === '') {
    issues.push({ field: 'target', message: 'target is required.' });
  }
  if (!['allow', 'skip', 'replace'].includes(candidate.overlapPolicy as string)) {
    issues.push({ field: 'overlapPolicy', message: 'overlapPolicy must be allow, skip, or replace.' });
  }
  if (!nonNegativeInteger(candidate.timeoutMs)) {
    issues.push({ field: 'timeoutMs', message: 'timeoutMs must be a non-negative integer.' });
  }
  if (candidate.maxConcurrency !== undefined && (!Number.isInteger(candidate.maxConcurrency) || candidate.maxConcurrency < 1)) {
    issues.push({ field: 'maxConcurrency', message: 'maxConcurrency must be an integer greater than zero.' });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      id: candidate.id!.trim(),
      name: candidate.name!.trim(),
      expression: candidate.expression!.trim().replace(/\s+/g, ' '),
      dialect: 'posix',
      timezone: candidate.timezone!,
      enabled: candidate.enabled!,
      target: candidate.target!.trim(),
      ...(candidate.timeoutMs === undefined ? {} : { timeoutMs: candidate.timeoutMs }),
      overlapPolicy: candidate.overlapPolicy!,
      ...(candidate.maxConcurrency === undefined ? {} : { maxConcurrency: candidate.maxConcurrency }),
    },
  };
}

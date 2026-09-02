import type { Schedule } from './schedule';

export type VercelCronConfig = {
  path: string;
  schedule: string;
};

export type GitHubActionsSchedule = {
  cron: string;
  timezone?: string;
};

export type HomebaseSchedule = {
  id: string;
  expression: string;
  timezone: string;
  target: string;
  enabled: boolean;
};

export type SchedulerAdapter<T> = {
  readonly platform: string;
  compile(schedule: Schedule): T;
};

/** Vercel consumes a path plus a five-field cron expression in vercel.json. */
export const vercelCronAdapter: SchedulerAdapter<VercelCronConfig> = {
  platform: 'vercel-cron',
  compile(schedule) {
    return { path: schedule.target, schedule: schedule.expression };
  },
};

/** GitHub Actions supports POSIX cron and an optional IANA timezone. */
export const githubActionsScheduleAdapter: SchedulerAdapter<GitHubActionsSchedule> = {
  platform: 'github-actions',
  compile(schedule) {
    return { cron: schedule.expression, timezone: schedule.timezone };
  },
};

/** Homebase/local execution keeps the canonical schedule intact for a local scheduler. */
export const homebaseScheduleAdapter: SchedulerAdapter<HomebaseSchedule> = {
  platform: 'homebase',
  compile(schedule) {
    return {
      id: schedule.id,
      expression: schedule.expression,
      timezone: schedule.timezone,
      target: schedule.target,
      enabled: schedule.enabled,
    };
  },
};

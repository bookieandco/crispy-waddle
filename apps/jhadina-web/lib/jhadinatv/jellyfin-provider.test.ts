import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createJellyfinProviderBundle, getJellyfinAdmissionStatus } from './jellyfin-provider';

const envKeys = [
  'JHADINA_TV_JELLYFIN_URL',
  'JHADINA_TV_JELLYFIN_API_KEY',
  'JHADINA_TV_JELLYFIN_USER_ID',
  'JHADINA_PUBLIC_ORIGIN',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'JHADINA_TV_JELLYFIN_RIGHTS',
  'JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS',
  'JHADINA_TV_JELLYFIN_TERRITORIES',
  'JHADINA_TV_JELLYFIN_LIVE_STREAM_PATH_TEMPLATE',
  'JHADINA_TV_JELLYFIN_VOD_STREAM_PATH_TEMPLATE',
] as const;

const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

describe('JhadinaTV Jellyfin admission', () => {
  beforeEach(() => {
    for (const key of envKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('fails closed when provider credentials and rights evidence are absent', () => {
    const status = getJellyfinAdmissionStatus();

    expect(status.admitted).toBe(false);
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(expect.arrayContaining([
      'JHADINA_TV_JELLYFIN_URL',
      'JHADINA_TV_JELLYFIN_API_KEY',
      'JHADINA_TV_JELLYFIN_USER_ID',
      'JHADINA_PUBLIC_ORIGIN',
      'JHADINA_TV_JELLYFIN_RIGHTS(playback-required)',
      'JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS',
    ]));
    expect(createJellyfinProviderBundle()).toBeNull();
  });

  it('rejects non-HTTPS Jellyfin and public origins', () => {
    process.env.JHADINA_TV_JELLYFIN_URL = 'http://homebase.local:8096';
    process.env.JHADINA_TV_JELLYFIN_API_KEY = 'server-secret';
    process.env.JHADINA_TV_JELLYFIN_USER_ID = 'user-1';
    process.env.JHADINA_PUBLIC_ORIGIN = 'http://jhadina.local';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS = 'playback';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS = 'license-1';

    const status = getJellyfinAdmissionStatus();

    expect(status.admitted).toBe(false);
    expect(status.missing).toEqual(expect.arrayContaining([
      'JHADINA_TV_JELLYFIN_URL(https-required)',
      'JHADINA_PUBLIC_ORIGIN(https-required)',
    ]));
  });

  it('requires playback independently from other media rights', () => {
    process.env.JHADINA_TV_JELLYFIN_URL = 'https://media.example.test';
    process.env.JHADINA_TV_JELLYFIN_API_KEY = 'server-secret';
    process.env.JHADINA_TV_JELLYFIN_USER_ID = 'user-1';
    process.env.JHADINA_PUBLIC_ORIGIN = 'https://jhadina.example.test';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS = 'casting,ai-analysis';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS = 'license-1';

    const status = getJellyfinAdmissionStatus();

    expect(status.admitted).toBe(false);
    expect(status.rights).toEqual(['casting', 'ai-analysis']);
    expect(status.missing).toContain('JHADINA_TV_JELLYFIN_RIGHTS(playback-required)');
  });

  it('admits only a complete HTTPS provider with explicit playback and evidence', () => {
    process.env.JHADINA_TV_JELLYFIN_URL = 'https://media.example.test/';
    process.env.JHADINA_TV_JELLYFIN_API_KEY = 'server-secret';
    process.env.JHADINA_TV_JELLYFIN_USER_ID = 'user-1';
    process.env.JHADINA_PUBLIC_ORIGIN = 'https://jhadina.example.test/';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS = 'playback,casting,unknown-right';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS = 'contract-1,contract-2';

    const status = getJellyfinAdmissionStatus();

    expect(status.admitted).toBe(true);
    expect(status.configured).toBe(true);
    expect(status.missing).toEqual([]);
    expect(status.rights).toEqual(['playback', 'casting']);
    expect(status.rightsEvidenceCount).toBe(2);
    expect(createJellyfinProviderBundle()).not.toBeNull();
  });
});

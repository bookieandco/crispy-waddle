import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks=vi.hoisted(()=>({
  createServerClient:vi.fn(),
}));

vi.mock('@supabase/ssr',()=>({
  createServerClient:mocks.createServerClient,
}));

import { updateSession } from './middleware';

const envKeys=[
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
const original=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));

describe('Supabase middleware Director certification behavior',()=>{
  beforeEach(()=>{
    mocks.createServerClient.mockReset();
    for(const key of envKeys) delete process.env[key];
  });
  afterEach(()=>{
    for(const key of envKeys){
      const value=original[key];
      if(value===undefined) delete process.env[key];
      else process.env[key]=value;
    }
  });

  it('lets Director machine routes reach their own bearer-secret boundary without a browser session',async()=>{
    const response=await updateSession(new NextRequest('https://example.com/api/director/process-replication/reconcile'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('lets internal scheduler routes reach OIDC/cron authorization without being redirected to interactive login',async()=>{
    const response=await updateSession(new NextRequest('https://example.com/api/internal/sam/scan?lookbackDays=2'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('uses the canonical low-privilege public fallback instead of crashing when Vercel public env is absent',async()=>{
    mocks.createServerClient.mockReturnValue({
      auth:{getClaims:vi.fn().mockResolvedValue({data:{claims:null}})},
    });
    const response=await updateSession(new NextRequest('https://example.com/api/jhadina/command'));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toContain('/login');
    const [url,key]=mocks.createServerClient.mock.calls[0]!;
    expect(url).toBe('https://kqbkaozfjubkjevdfvic.supabase.co');
    expect(key).toMatch(/^sb_publishable_/);
  });

  it('prefers environment overrides and never falls back to service-role credentials',async()=>{
    process.env.SUPABASE_URL='https://override.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJ-public-anon-test';
    process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-must-never-be-used';
    mocks.createServerClient.mockReturnValue({
      auth:{getClaims:vi.fn().mockResolvedValue({data:{claims:{sub:'u'}}})},
    });
    const response=await updateSession(new NextRequest('https://example.com/app'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      'https://override.supabase.co',
      'eyJ-public-anon-test',
      expect.any(Object),
    );
    expect(JSON.stringify(mocks.createServerClient.mock.calls)).not.toContain('service-role-must-never-be-used');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks=vi.hoisted(()=>({
  createServerClient:vi.fn(),
}));

vi.mock('@supabase/ssr',()=>({
  createServerClient:mocks.createServerClient,
}));

import { updateSession } from './middleware';
import { getPublicSupabaseConfig } from './public-config';

const envKeys=[
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
] as const;
const original=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));

describe('Supabase middleware production bootstrap',()=>{
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

  it('has a canonical public Supabase fallback when deployment env injection is absent',()=>{
    const config=getPublicSupabaseConfig();
    expect(config.url).toBe('https://kqbkaozfjubkjevdfvic.supabase.co');
    expect(config.key).toMatch(/^sb_publishable_/);
  });

  it('uses the canonical public fallback instead of crashing middleware when env is absent',async()=>{
    mocks.createServerClient.mockReturnValue({
      auth:{getClaims:vi.fn().mockResolvedValue({data:{claims:{sub:'u'}}})},
    });
    const response=await updateSession(new NextRequest('https://example.com/api/jhadina/command'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      'https://kqbkaozfjubkjevdfvic.supabase.co',
      expect.stringMatching(/^sb_publishable_/),
      expect.any(Object),
    );
  });

  it('prefers deployment env aliases while never falling back to service-role credentials',async()=>{
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='anon-key';
    mocks.createServerClient.mockReturnValue({
      auth:{getClaims:vi.fn().mockResolvedValue({data:{claims:{sub:'u'}}})},
    });
    const response=await updateSession(new NextRequest('https://example.com/app'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.any(Object),
    );
  });
});

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
] as const;
const original=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));

describe('Supabase middleware fail-closed behavior',()=>{
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

  it('lets Director machine routes reach their own bearer-secret boundary without public Supabase env',async()=>{
    const response=await updateSession(new NextRequest('https://example.com/api/director/process-replication/reconcile'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('returns 503 for ordinary protected APIs instead of crashing middleware when public auth env is absent',async()=>{
    const response=await updateSession(new NextRequest('https://example.com/api/jhadina/command'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({success:false,error:'Authentication service is not configured'});
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('supports publishable-key aliases without ever falling back to service-role credentials',async()=>{
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

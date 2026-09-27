import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSupabasePublicConfig } from './public-config';

const keys=[
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
const original=Object.fromEntries(keys.map(key=>[key,process.env[key]]));

describe('public Supabase bootstrap config',()=>{
  beforeEach(()=>{for(const key of keys) delete process.env[key];});
  afterEach(()=>{
    for(const key of keys){
      const value=original[key];
      if(value===undefined) delete process.env[key];
      else process.env[key]=value;
    }
  });

  it('provides the canonical SWLC public bootstrap when deployment env is absent',()=>{
    const config=getSupabasePublicConfig();
    expect(config.url).toBe('https://kqbkaozfjubkjevdfvic.supabase.co');
    expect(config.publishableKey).toMatch(/^sb_publishable_/);
  });

  it('prefers env overrides and ignores service-role credentials',()=>{
    process.env.NEXT_PUBLIC_SUPABASE_URL='https://override.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_override';
    process.env.SUPABASE_SERVICE_ROLE_KEY='secret-never-public';
    expect(getSupabasePublicConfig()).toEqual({
      url:'https://override.supabase.co',
      publishableKey:'sb_publishable_override',
    });
  });
});

import {describe,expect,it} from 'vitest';
import {Ps5ExperimentalReferenceCatalog} from './ps5-experimental-catalog.js';

describe('Ps5ExperimentalReferenceCatalog',()=>{
  it('keeps exploit/payload sources as research references rather than automatic executors',()=>{
    const catalog=new Ps5ExperimentalReferenceCatalog();
    expect(catalog.canAutomaticallyExecute('ps5-linux-loader')).toBe(false);
    expect(catalog.canAutomaticallyExecute('ps5-payloads-mirror')).toBe(false);
    expect(catalog.get('ps5-payloads-mirror')?.prohibitedAutomaticActions).toContain('execute-payload');
  });

  it('allows an emulator reference to enter the normal managed-runtime evaluation path',()=>{
    const catalog=new Ps5ExperimentalReferenceCatalog();
    expect(catalog.canAutomaticallyExecute('kyty')).toBe(true);
    expect(catalog.list('emulation').map(reference=>reference.repository)).toEqual(['InoriRus/Kyty']);
  });
});

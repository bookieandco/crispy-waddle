import {describe,expect,it} from 'vitest';
import {G21_HARDWARE_LATENCY_MATRIX,summarizeHardwareLatency} from './gaming-latency-validation.js';

describe('G21 hardware input-to-photon validation',()=>{
  it('requires enough monotonic real-path samples before classifying a route',()=>{
    const samples=Array.from({length:20},(_,i)=>({
      pathId:'gamesir-x5-usb-c-phone',capturedAtMs:i*100,capturedByJhadinaAtMs:i*100+1,
      runtimeReceivedAtMs:i*100+5,frameRenderedAtMs:i*100+12,displayedAtMs:i*100+18,
    }));
    expect(summarizeHardwareLatency(samples)).toMatchObject({samples:20,p95InputToPhotonMs:18,classification:'excellent'});
  });

  it('covers wired, bluetooth, LAN, browser and console paths',()=>{
    expect(G21_HARDWARE_LATENCY_MATRIX).toEqual(expect.arrayContaining([
      'gamesir-x5-usb-c-phone','dualsense-bluetooth','sunshine-lan','emulatorjs-browser','playstation-remote-play-lan',
    ]));
  });
});

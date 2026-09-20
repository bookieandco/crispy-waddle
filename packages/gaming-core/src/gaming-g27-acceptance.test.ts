import {describe,expect,it} from 'vitest';
import {UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX} from './emulation-production.js';
import {G15J_SUPPORTED_PLAYSTATION_ACCEPTANCE} from './playstation-supported-runtime.js';
import {G17_G18_ACCEPTANCE} from './extended-runtimes.js';
import {CONTROLLER_MAPPING_REFERENCES} from './controller-mapping-governance.js';
import {G21_HARDWARE_LATENCY_MATRIX} from './gaming-latency-validation.js';
import {GamingRecoveryPolicy} from './gaming-reliability.js';
import {GamingAssistantPlanner} from './gaming-intelligence.js';
import {G26_DEVICE_ACCEPTANCE_MATRIX,evaluateDeviceAcceptance} from './gaming-device-acceptance.js';
import {G27_PRODUCTION_HARDENING_REQUIREMENTS,GamingProductionHardeningGate} from './gaming-production-hardening.js';

describe('G27 cumulative gaming production-hardening acceptance',()=>{
  it('retains the universal emulation acceptance surface',()=>{
    expect(UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX.length).toBeGreaterThanOrEqual(9);
    expect(new Set(UNIVERSAL_EMULATION_ACCEPTANCE_MATRIX.map(item=>item.runtime))).toEqual(
      new Set(['libretro-wasm','emulatorjs-browser','portable-offline']),
    );
  });

  it('retains both required G15j PlayStation controller paths',()=>{
    expect(G15J_SUPPORTED_PLAYSTATION_ACCEPTANCE.map(item=>item.controllerProfileId)).toEqual(['dualsense','gamesir-x5-lite']);
  });

  it('retains Xbox and governed high-end emulation expansion',()=>{
    expect(G17_G18_ACCEPTANCE.xbox).toContain('home-stream');
    expect(G17_G18_ACCEPTANCE.nativeEmulators).toContain('rpcs3');
  });

  it('keeps external controller-mapper projects before the G13 trust boundary',()=>{
    expect(CONTROLLER_MAPPING_REFERENCES.map(item=>item.repository)).toEqual([
      'mdqinc/SDL_GameControllerDB',
      'AntiMicroX/antimicrox',
    ]);
    expect(CONTROLLER_MAPPING_REFERENCES.every(item=>item.mayInjectRuntimeInput===false)).toBe(true);
  });

  it('retains real-path latency evidence requirements and no-replay recovery',()=>{
    expect(G21_HARDWARE_LATENCY_MATRIX).toContain('gamesir-x5-usb-c-phone');
    expect(G21_HARDWARE_LATENCY_MATRIX).toContain('playstation-remote-play-lan');
    expect(new GamingRecoveryPolicy().drillMatrix().every(plan=>plan.replayInput===false)).toBe(true);
  });

  it('keeps assistant reasoning outside direct controller authority',()=>{
    const plan=new GamingAssistantPlanner().plan({intent:'resume-game',gameId:'g1'});
    expect(plan).toMatchObject({requiresAuthorization:true,controllerInjectionAllowed:false});
  });

  it('requires physical evidence before any G26 route can be marked accepted',()=>{
    for(const testCase of G26_DEVICE_ACCEPTANCE_MATRIX){
      const result=evaluateDeviceAcceptance(testCase,{
        caseId:testCase.id,
        hardwareObserved:false,
        requirementsPassed:testCase.requirements,
        artifactRefs:[],
      });
      expect(result.passed).toBe(false);
      expect(result.hardwareEvidenceMissing).toBe(true);
    }
  });

  it('freezes the complete G27 hardening domains and zero-defect soak gate',()=>{
    expect(G27_PRODUCTION_HARDENING_REQUIREMENTS).toHaveLength(9);
    expect(new GamingProductionHardeningGate().evaluate({
      durationMinutes:240,
      sessionsStarted:25,
      sessionsStopped:25,
      orphanedResources:0,
      inputIntegrityErrors:0,
      saveCorruptions:0,
      unrecoveredCrashes:0,
    })).toEqual({passed:true,reasons:[]});
  });
});

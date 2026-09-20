import {describe,expect,it} from 'vitest';
import {
  DEFAULT_PS5_REMOTE_PLAY_CONTROLLER_REQUIREMENT,
  DUALSENSE_HARDWARE_PROFILE,
  GAMESIR_X5_LITE_HARDWARE_PROFILE,
  PLAYSTATION_ACCEPTANCE_CONTROLLER_MATRIX,
  negotiatePlayStationController,
} from './playstation-controller-hardware-profile.js';

describe('G15f-X5 PlayStation controller hardware profiles',()=>{
  it('keeps DualSense at full PS5 feature fidelity',()=>{
    expect(negotiatePlayStationController(DUALSENSE_HARDWARE_PROFILE,DEFAULT_PS5_REMOTE_PLAY_CONTROLLER_REQUIREMENT))
      .toMatchObject({allowed:true,fallbackMode:'full-dualsense',unavailableOptional:[]});
  });

  it('lets GameSir X5 Lite fall back to generic input when DualSense-only features are absent',()=>{
    const result=negotiatePlayStationController(GAMESIR_X5_LITE_HARDWARE_PROFILE,DEFAULT_PS5_REMOTE_PLAY_CONTROLLER_REQUIREMENT);
    expect(result.allowed).toBe(true);
    expect(result.fallbackMode).toBe('generic-gamepad');
    expect(result.unavailableOptional).toEqual(
      expect.arrayContaining(['analog-triggers','advanced-haptics','adaptive-triggers','gyro','touchpad']),
    );
    expect(GAMESIR_X5_LITE_HARDWARE_PROFILE.triggerMode).toBe('digital');
  });

  it('defines the eventual G15j acceptance matrix for both controller paths',()=>{
    expect(PLAYSTATION_ACCEPTANCE_CONTROLLER_MATRIX.map(entry=>entry.path)).toEqual([
      ['dualsense','jhadina','ps5'],
      ['gamesir-x5-lite','phone','jhadina','ps5'],
    ]);
  });
});

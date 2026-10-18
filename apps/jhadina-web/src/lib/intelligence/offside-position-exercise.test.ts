import {describe,expect,it} from "vitest"
import {assessOffsidePosition} from "./offside-position-exercise"

describe("JLLM-VISUAL.06 offside position teaching exercise",()=>{
  it("labels attacker beyond ball and second-last opponent in opposing half",()=>{
    expect(assessOffsidePosition({attacker:76,ball:62,secondLastDefender:69})).toMatchObject({offsidePosition:true,reason:"BEYOND_BOTH",boundary:69})
  })
  it("requires opposing half and strictly beyond both comparators",()=>{
    expect(assessOffsidePosition({attacker:50,ball:20,secondLastDefender:30}).reason).toBe("OWN_HALF")
    expect(assessOffsidePosition({attacker:70,ball:70,secondLastDefender:60}).reason).toBe("LEVEL_OR_BEHIND_BALL")
    expect(assessOffsidePosition({attacker:70,ball:50,secondLastDefender:70}).reason).toBe("LEVEL_OR_BEHIND_DEFENDER")
    expect(assessOffsidePosition({attacker:71,ball:70,secondLastDefender:70}).offsidePosition).toBe(true)
  })
  it("refuses invalid field positions",()=>{
    for(const bad of [-1,101,NaN,Infinity]){
      expect(()=>assessOffsidePosition({attacker:bad,ball:60,secondLastDefender:70})).toThrow("OFFSIDE_EXERCISE_INVALID_COORDINATE")
    }
  })
})

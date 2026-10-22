import {afterEach,describe,expect,it} from "vitest"
import {
  decryptAyrshareProfileKey,
  encryptAyrshareProfileKey,
} from "./ayrshare-binding-vault"

const original=process.env.JHADINA_SOCIAL_CREDENTIAL_KEY

afterEach(()=>{
  if(original===undefined)delete process.env.JHADINA_SOCIAL_CREDENTIAL_KEY
  else process.env.JHADINA_SOCIAL_CREDENTIAL_KEY=original
})

describe("Ayrshare binding vault crypto",()=>{
  it("round-trips profile keys without plaintext ciphertext",()=>{
    process.env.JHADINA_SOCIAL_CREDENTIAL_KEY=Buffer.alloc(32,7).toString("base64")
    const encrypted=encryptAyrshareProfileKey("profile-secret")
    expect(encrypted).not.toContain("profile-secret")
    expect(encrypted.split(".")).toHaveLength(3)
    expect(decryptAyrshareProfileKey(encrypted)).toBe("profile-secret")
  })

  it("fails closed without a dedicated 32-byte credential key",()=>{
    delete process.env.JHADINA_SOCIAL_CREDENTIAL_KEY
    expect(()=>encryptAyrshareProfileKey("profile-secret"))
      .toThrow("JHADINA_SOCIAL_CREDENTIAL_KEY_NOT_CONFIGURED")

    process.env.JHADINA_SOCIAL_CREDENTIAL_KEY=Buffer.alloc(16).toString("base64")
    expect(()=>encryptAyrshareProfileKey("profile-secret"))
      .toThrow("JHADINA_SOCIAL_CREDENTIAL_KEY_INVALID")
  })
})

import {beforeEach,describe,expect,it,vi} from "vitest";

const mocks=vi.hoisted(()=>({createClient:vi.fn(),getUser:vi.fn(),redirect:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.createClient}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{mocks.redirect(path);throw new Error("TEST_REDIRECT:"+path)}}));
vi.mock("./actions",()=>({login:vi.fn(),sendOwnerSignInLink:vi.fn()}));
vi.mock("./passkey-action",()=>({PasskeyAction:()=>null}));

import LoginPage from "./page";

describe("Jhadina owner build entry",()=>{
 beforeEach(()=>{
  mocks.createClient.mockReset();
  mocks.getUser.mockReset();
  mocks.redirect.mockReset();
  mocks.createClient.mockResolvedValue({auth:{getUser:mocks.getUser}});
 });
 it("skips the login form and deep-links to procurement for a valid owner session",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{
   id:"owner",email:"dorianmorris8@icloud.com",
   email_confirmed_at:"2026-10-20T07:00:00Z",is_anonymous:false,
  }},error:null});
  await expect(LoginPage({searchParams:{next:"/opportunity/procurement?state=CA"}}))
   .rejects.toThrow("TEST_REDIRECT:/opportunity/procurement?state=CA");
  expect(mocks.redirect).toHaveBeenCalledOnce();
 });
 it("keeps the login form for expired or unrelated sessions",async()=>{
  for(const data of [
   {data:{user:null},error:{message:"session expired"}},
   {data:{user:{id:"another",email:"not-owner@example.test",email_confirmed_at:"2026-10-20T07:00:00Z",is_anonymous:false}},error:null},
  ]){
   mocks.getUser.mockResolvedValueOnce(data);
   const page=await LoginPage({searchParams:{next:"/opportunity/procurement"}});
   expect(page).not.toBeNull();
  }
  expect(mocks.redirect).not.toHaveBeenCalled();
 });
 it("does not follow a cross-site next URL even for the valid owner",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:{
   id:"owner",email:"dorianmorris8@icloud.com",
   email_confirmed_at:"2026-10-20T07:00:00Z",is_anonymous:false,
  }},error:null});
  await expect(LoginPage({searchParams:{next:"https://attacker.example/"}}))
   .rejects.toThrow("TEST_REDIRECT:/");
 });
});

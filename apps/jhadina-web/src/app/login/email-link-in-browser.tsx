"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { isVerifiedPersonalOwner } from "@/lib/auth/personal-owner";
import { safeAuthNext } from "@/lib/auth/passkey";
import { parseEmailedMagicLink } from "@/lib/auth/emailed-magic-link";

export function EmailLinkInBrowser({ next }: { next: string }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const { url } = getSupabasePublicConfig();
      const proof = parseEmailedMagicLink(link, url);
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp(proof);
      if (error || !data.session || !isVerifiedPersonalOwner(data.user) ||
          data.session.user.id !== data.user.id) {
        await supabase.auth.signOut();
        throw new Error("EMAIL_MAGIC_LINK_VERIFICATION_FAILED");
      }
      // No emailed redirect URL, copied code or token is added to the destination.
      setLink("");
      window.location.assign(safeAuthNext(next));
    } catch {
      setMessage("That sign-in link could not be verified. Copy a fresh, unused link from your email without opening it in Safari, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return <section style={{marginTop:22,padding:16,border:"1px solid #54765d",borderRadius:16,display:"grid",gap:12}}>
    <h2 style={{margin:0,fontSize:20}}>Signing in from Phantom?</h2>
    <p style={{margin:0}}>Request the email above. In Mail, press and hold the sign-in link, choose Copy Link, then return here inside Phantom. Paste it below instead of opening it in Safari.</p>
    <form onSubmit={verify} style={{display:"grid",gap:10}}>
      <label htmlFor="emailed-login-link">Paste the emailed Jhadina sign-in link</label>
      <input id="emailed-login-link" type="text" inputMode="url" autoComplete="off"
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
        value={link} onChange={e=>setLink(e.target.value)} required
        placeholder="https://…supabase.co/auth/v1/verify?…"
        style={{width:"100%",minHeight:48,padding:12}} />
      <button type="submit" disabled={busy||!link.trim()} style={{minHeight:48,padding:12,fontWeight:700}}>
        {busy?"Verifying in this browser…":"Verify link and open wallet"}
      </button>
    </form>
    <small>Never paste your Phantom recovery phrase, private key or wallet transaction signature here. This accepts only Jhadina’s email sign-in link and does not authorize trading.</small>
    {message&&<p role="alert" style={{color:"#a12c2c",margin:0}}>{message}</p>}
  </section>;
}

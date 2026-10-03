"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { passkeyErrorMessage, performPasskey, safeAuthNext } from "@/lib/auth/passkey";

export function PasskeyAction({ mode = "signin", next = "/" }: { mode?: "signin" | "register"; next?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const active = useRef(false);

  useEffect(() => {
    setSupported(window.isSecureContext && typeof window.PublicKeyCredential !== "undefined" && !!navigator.credentials);
  }, []);

  async function run() {
    if (active.current || !supported) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    setSuccess(false);
    try {
      await performPasskey(createClient().auth, mode);
      if (mode === "signin") {
        // A full navigation lets middleware verify the newly written SSR cookies.
        window.location.assign(safeAuthNext(next));
      } else {
        setSuccess(true);
        setMessage("Passkey added. You can now use it to sign in to Jhadina.");
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message === "PASSKEY_SIGN_IN_REQUIRED"
        ? "Sign in to your account before adding a passkey."
        : passkeyErrorMessage(error));
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 12, margin: "24px 0" }}>
      <button type="button" onClick={run} disabled={!supported || busy} style={{ minHeight: 48, padding: "12px 20px", borderRadius: 12 }}>
        {busy ? "Waiting for your device…" : mode === "register" ? "Add a passkey" : "Sign in with a passkey"}
      </button>
      <p style={{ margin: 0 }}>Use Face ID, Touch ID, or your device’s unlock code. Your biometric data stays on your device.</p>
      {supported === false && <p role="status">Passkeys are unavailable in this browser. Open Jhadina in a supported browser on your device.</p>}
      {message && <p role={success ? "status" : "alert"}>{message}</p>}
    </section>
  );
}

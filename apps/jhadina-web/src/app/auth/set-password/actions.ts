"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/auth/password-recovery";
import { isVerifiedPersonalOwner } from "@/lib/auth/personal-owner";

export async function setNewPassword(formData: FormData) {
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");
  const invalid = validateNewPassword(password, confirmation);
  if (invalid) redirect("/auth/set-password?error=" + invalid);
  let outcome: "password_session_required" | "password_change_failed" | null = null;
  try {
    const supabase = await createClient();
    // Recovery link confirmation must have created a real session first.
    const { data, error } = await supabase.auth.getUser();
    if (error || !isVerifiedPersonalOwner(data.user)) outcome = "password_session_required";
    else {
      const result = await supabase.auth.updateUser({ password: String(password) });
      if (result.error || result.data.user?.id !== data.user?.id) outcome = "password_change_failed";
    }
  } catch {
    outcome = "password_change_failed";
  }
  if (outcome) redirect("/auth/set-password?error=" + outcome);
  revalidatePath("/", "layout");
  redirect("/login?message=password_changed");
}

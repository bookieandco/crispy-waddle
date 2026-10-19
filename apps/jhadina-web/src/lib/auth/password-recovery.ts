/** Pure validation so the password is never echoed into query strings or logs. */
export function validRecoveryEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export type NewPasswordError = "password_requirements" | "password_mismatch";

export function validateNewPassword(password: unknown, confirmation: unknown): NewPasswordError | null {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) return "password_requirements";
  if (password !== confirmation) return "password_mismatch";
  return null;
}

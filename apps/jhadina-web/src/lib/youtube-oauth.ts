import { createHash, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function youtubeRedirectUri() {
  return process.env.YOUTUBE_REDIRECT_URI || `${required("NEXT_PUBLIC_APP_URL")}/api/auth/youtube/callback`;
}

export function youtubeAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: youtubeRedirectUri(),
    response_type: "code",
    scope: YOUTUBE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeYouTubeCode(code: string) {
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_CLIENT_ID"),
      client_secret: required("GOOGLE_CLIENT_SECRET"),
      redirect_uri: youtubeRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== "string") throw new Error("YouTube authorization exchange failed");
  return data as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string };
}

export function newOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function hashState(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function key() {
  return createHash("sha256").update(required("JHADINA_OAUTH_ENCRYPTION_KEY")).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted OAuth secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

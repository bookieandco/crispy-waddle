import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "./public-config";

export function createClient() {
  const { url, key } = getPublicSupabaseConfig();
  return createBrowserClient(url, key);
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cachedSupabaseClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient() {
  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return cachedSupabaseClient;
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let browserClient: SupabaseClient | undefined;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return browserClient;
}

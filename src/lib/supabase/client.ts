import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient<Database>(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
    {
      realtime: {
        worker: true,
      },
    },
  );
}

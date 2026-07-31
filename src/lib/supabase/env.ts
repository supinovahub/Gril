const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const supabaseEnv = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
} as const;

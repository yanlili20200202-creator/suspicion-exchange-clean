import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (
  import.meta.env.DEV &&
  (!supabaseUrl || !supabasePublishableKey)
) {
  console.error(
    "Supabase client was not initialized: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required.",
  );
}

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null;

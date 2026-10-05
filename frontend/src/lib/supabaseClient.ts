import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://tcfvwtdstdxzfwngvuii.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjZnZ3dGRzdGR4emZ3bmd2dWlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyODA4NjIsImV4cCI6MjEwNDg1Njg2Mn0.AsiISVKmMHH3NzxhyBT1GWELmiepWLZTlcv2oh7cs0c";

export const getSupabaseBrowserClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    isSingleton: true,
  });
};

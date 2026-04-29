import { createClient } from '@supabase/supabase-js';

// Supabase's new (2025) sb_ keys: "Publishable" + "Secret" — mirror Stripe's naming.
// The legacy anon / service_role JWT names are still accepted as fallbacks.
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser-safe client. Subject to Row Level Security policies.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  PUBLISHABLE_KEY,
);

// Server-only admin client. Bypasses RLS — never import this in client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SECRET_KEY,
);

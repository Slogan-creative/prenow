// =============================================================================
// CLIENT SUPABASE — LATO BROWSER
// =============================================================================
// Da usare solo dentro componenti con "use client" (interazioni, form,
// sottoscrizioni realtime). Rispetta sempre la RLS: è equivalente per
// sicurezza al client server-side "normale", cambia solo dove gira.
// =============================================================================
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

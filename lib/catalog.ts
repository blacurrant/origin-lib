import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Read-only Supabase client for the public component catalogue. It uses the
 * publishable (anon) key only, so row-level security limits it to published
 * rows. With no env set it returns null and every read degrades to empty.
 */

let client: SupabaseClient | null = null
let resolved = false

export function getCatalogSupabase(): SupabaseClient | null {
  if (!resolved) {
    resolved = true
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY
    if (url && key) {
      client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          // A sick origin should fail fast, not hang the page.
          fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
        },
      })
    }
  }
  return client
}

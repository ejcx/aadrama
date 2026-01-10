import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Edge-compatible Supabase client for read-only operations
// Does not use cookies - suitable for anonymous/public data access
export function createEdgeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }
  
  return createSupabaseClient(url, key)
}





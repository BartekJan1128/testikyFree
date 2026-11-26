import { createClient } from '@supabase/supabase-js'

// Publishable klíč je veřejný – data chrání Row Level Security v databázi.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://bgtkujjukxdkiuuwtjth.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9wmJPJ6W_TU5IaYQPb7EJQ_DjXA1I_k'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

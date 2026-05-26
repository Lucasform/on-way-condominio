import { createClient } from '@supabase/supabase-js'

// Fallback hardcoded pra não quebrar se env var sumir do Vercel.
// Estas duas chaves são PÚBLICAS por design (URL do projeto + publishable/anon key) —
// ficam no JS do browser de qualquer jeito.
const SUPABASE_URL_FALLBACK = 'https://lkxnngzgmyfqgbbpmjvc.supabase.co'
const SUPABASE_ANON_KEY_FALLBACK = 'sb_publishable_o52adZa2cHtX6ywPG7IThg_A17CRkmz'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

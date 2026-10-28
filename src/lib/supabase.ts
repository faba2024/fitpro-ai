import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * Cliente do Supabase, ou null quando as variáveis não estão configuradas.
 * Sem ele o app roda em "modo local" (dados só no navegador), avisando na tela.
 */
export const supabase: SupabaseClient | null =
  url && chave ? createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

export const temNuvem = supabase !== null;

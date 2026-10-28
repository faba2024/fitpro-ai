// Cliente Supabase falso para testes de componentes: guarda o estado em memória
// e imita só as chamadas que o app usa. Nenhuma requisição de rede.
import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import type { LinhaPerfil } from "@/data/perfilMapper";

interface Opcoes {
  logado?: boolean;
  perfil?: LinhaPerfil | null;
  erroLogin?: { code: string; message: string; status: number };
  precisaConfirmar?: boolean;
}

export function supabaseFalso(op: Opcoes = {}) {
  const user = { id: "user-1", email: "aluno@teste.local" };
  let sessao: { user: typeof user } | null = op.logado ? { user } : null;
  let perfil: LinhaPerfil | null = op.perfil ?? null;
  let plano: Record<string, unknown> | null = null;
  const ouvintes = new Set<(evento: string, s: typeof sessao) => void>();
  const emitir = (evento: string) => ouvintes.forEach((f) => f(evento, sessao));

  const chamadas = {
    upsert: vi.fn((linha: LinhaPerfil) => {
      perfil = { ...linha, atualizado_em: "2026-10-28T12:00:00Z" };
      return Promise.resolve({ error: null });
    }),
    rpc: vi.fn(() => {
      perfil = null;
      return Promise.resolve({ error: null });
    }),
    signIn: vi.fn(),
    signUp: vi.fn(),
    upsertPlano: vi.fn((linha: Record<string, unknown>) => {
      plano = { ...linha, revisado_em: null, observacao_profissional: null };
      return Promise.resolve({ error: null });
    }),
  };

  const cliente = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: sessao } }),
      onAuthStateChange: (f: (evento: string, s: typeof sessao) => void) => {
        ouvintes.add(f);
        return { data: { subscription: { unsubscribe: () => ouvintes.delete(f) } } };
      },
      signInWithPassword: async (cred: { email: string; password: string }) => {
        chamadas.signIn(cred);
        if (op.erroLogin) return { data: {}, error: op.erroLogin };
        sessao = { user };
        emitir("SIGNED_IN");
        return { data: { session: sessao }, error: null };
      },
      signUp: async (cred: { email: string; password: string }) => {
        chamadas.signUp(cred);
        if (op.precisaConfirmar) return { data: { session: null, user }, error: null };
        sessao = { user };
        emitir("SIGNED_IN");
        return { data: { session: sessao, user }, error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user }, error: null }),
      signOut: async () => {
        sessao = null;
        emitir("SIGNED_OUT");
        return { error: null };
      },
    },
    from: (tabela: string) =>
      tabela === "planos"
        ? {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: plano, error: null }) }) }) }),
            upsert: chamadas.upsertPlano,
          }
        : tabela === "favoritos"
        ? {
            select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
            upsert: () => Promise.resolve({ error: null }),
            delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
          }
        : {
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: perfil, error: null }) }) }),
            upsert: chamadas.upsert,
          },
    rpc: chamadas.rpc,
  };

  return { cliente: cliente as unknown as SupabaseClient, chamadas };
}

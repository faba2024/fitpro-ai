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
    rpc: vi.fn((_nome?: string, _args?: unknown) => {
      perfil = null;
      return Promise.resolve({ error: null });
    }),
    signIn: vi.fn(),
    signUp: vi.fn(),
    upsertSessao: vi.fn((_linha: unknown) => Promise.resolve({ error: null })),
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
      tabela === "sessoes" || tabela === "series" || tabela === "medidas" || tabela === "fotos"
        ? {
            // consultas encadeadas (eq/neq/in/order/limit) terminam numa lista vazia
            select: () => {
              const q: Record<string, unknown> = {};
              for (const m of ["eq", "neq", "in", "order"]) q[m] = () => q;
              q.limit = () => Promise.resolve({ data: [], error: null });
              return q;
            },
            upsert: chamadas.upsertSessao,
            delete: () => {
              const q: Record<string, unknown> = { then: (r: (v: unknown) => void) => r({ error: null }) };
              q.eq = () => q;
              q.not = () => Promise.resolve({ error: null });
              return q;
            },
          }
        : tabela === "planos"
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
    storage: {
      from: () => ({
        list: () => Promise.resolve({ data: [], error: null }),
        remove: () => Promise.resolve({ data: [], error: null }),
        upload: () => Promise.resolve({ data: {}, error: null }),
        createSignedUrls: () => Promise.resolve({ data: [], error: null }),
      }),
    },
    rpc: (nome: string, args?: unknown) => (nome === "recordes" ? Promise.resolve({ data: [], error: null }) : args === undefined ? chamadas.rpc(nome) : chamadas.rpc(nome, args)),
  };

  return { cliente: cliente as unknown as SupabaseClient, chamadas };
}

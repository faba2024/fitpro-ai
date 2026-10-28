import type { SupabaseClient } from "@supabase/supabase-js";
import type { DadosUsuario, PerfilCompleto } from "@/domain/tipos";
import { deLinha, paraLinha, resumo, type LinhaPerfil } from "./perfilMapper";
import type { Repositorio } from "./repositorio";

export class ErroDados extends Error {}

const SEM_CONEXAO = "Sem conexão com o servidor. Verifique a internet e tente de novo.";

/** Converte erros do PostgREST/rede em mensagens para a pessoa (sem detalhes internos). */
function falha(e: { message?: string; code?: string } | null, padrao: string): never {
  if (e?.message?.includes("Failed to fetch") || e?.message?.includes("NetworkError")) throw new ErroDados(SEM_CONEXAO);
  if (e?.code === "23514") throw new ErroDados("Algum valor está fora do permitido. Revise os campos.");
  throw new ErroDados(padrao);
}

export class SupabaseRepositorio implements Repositorio {
  readonly modo = "nuvem" as const;
  constructor(private db: SupabaseClient, private userId: string) {}

  async carregar(): Promise<DadosUsuario> {
    const { data, error } = await this.db.from("perfis").select("*").eq("id", this.userId).maybeSingle<LinhaPerfil>();
    if (error) falha(error, "Não foi possível carregar seu perfil.");
    const completo = data ? deLinha(data) : null;
    return {
      perfil: completo ? resumo(completo) : null,
      perfilCompleto: completo,
      // fichas (etapa 7), sessões (etapa 8) e histórico de medidas (etapa 9) ainda não estão no banco
      plano: null,
      sessoes: [],
      medidas: completo && data?.atualizado_em ? [{ data: data.atualizado_em.slice(0, 10), pesoKg: completo.pesoKg }] : [],
    };
  }

  async salvarPerfil(perfil: PerfilCompleto): Promise<void> {
    const { error } = await this.db.from("perfis").upsert(paraLinha(this.userId, perfil));
    if (error) falha(error, "Não foi possível salvar seu perfil.");
  }

  async excluirConta(): Promise<void> {
    const { error } = await this.db.rpc("excluir_minha_conta");
    if (error) falha(error, "Não foi possível excluir sua conta. Tente de novo.");
  }
}

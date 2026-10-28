import type { SupabaseClient } from "@supabase/supabase-js";
import { progresso, tempoAtivoMs, volumeKg, type HistoricoExercicio, type SessaoAtiva } from "@/domain/sessao";
import type { DadosUsuario, PerfilCompleto, Plano, SessaoTreino } from "@/domain/tipos";
import { agruparPorSessao, montarHistorico, type RegistroExercicio } from "./repositorio";
import { deLinha, paraLinha, resumo, type LinhaPerfil } from "./perfilMapper";
import { deLinhaPlano, paraLinhaPlano, type LinhaPlano } from "./planoMapper";
import type { Repositorio } from "./repositorio";

export class ErroDados extends Error {}

interface LinhaSessao {
  id: string;
  plano_sessao_id: string;
  titulo: string;
  status: SessaoTreino["status"];
  iniciada_em: string;
  finalizada_em: string | null;
  series_concluidas: number;
  volume_kg: number | string;
}

interface LinhaSerie {
  sessao_id: string;
  exercicio_id: string;
  ordem: number;
  carga_kg: number | string | null;
  reps: number;
  concluida_em: string;
}

const deLinhaSerie = (l: LinhaSerie) => ({
  sessaoId: l.sessao_id,
  concluidaEm: l.concluida_em,
  cargaKg: l.carga_kg == null ? null : Number(l.carga_kg),
  reps: l.reps,
  ordem: l.ordem,
});

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
    const [perfilRes, planoRes, sessoesRes] = await Promise.all([
      this.db.from("perfis").select("*").eq("id", this.userId).maybeSingle<LinhaPerfil>(),
      this.db.from("planos").select("*").eq("aluno_id", this.userId).eq("ativo", true).maybeSingle<LinhaPlano>(),
      // treinos finalizados recentes (o em andamento vive no aparelho)
      this.db
        .from("sessoes")
        .select("id, plano_sessao_id, titulo, status, iniciada_em, finalizada_em, series_concluidas, volume_kg")
        .eq("user_id", this.userId)
        .neq("status", "em_andamento")
        .order("iniciada_em", { ascending: false })
        .limit(120),
    ]);
    if (perfilRes.error) falha(perfilRes.error, "Não foi possível carregar seu perfil.");
    if (planoRes.error) falha(planoRes.error, "Não foi possível carregar sua ficha.");
    if (sessoesRes.error) falha(sessoesRes.error, "Não foi possível carregar seus treinos.");
    const data = perfilRes.data;
    const completo = data ? deLinha(data) : null;
    return {
      perfil: completo ? resumo(completo) : null,
      perfilCompleto: completo,
      // histórico de medidas (etapa 9) ainda não está no banco
      plano: planoRes.data ? deLinhaPlano(planoRes.data) : null,
      sessoes: (sessoesRes.data ?? []).map((l: LinhaSessao) => ({
        id: l.id,
        planoSessaoId: l.plano_sessao_id,
        titulo: l.titulo,
        status: l.status,
        iniciadaEm: l.iniciada_em,
        finalizadaEm: l.finalizada_em,
        seriesConcluidas: l.series_concluidas,
        volumeKg: Number(l.volume_kg),
      })),
      medidas: completo && data?.atualizado_em ? [{ data: data.atualizado_em.slice(0, 10), pesoKg: completo.pesoKg }] : [],
    };
  }

  async salvarPerfil(perfil: PerfilCompleto): Promise<void> {
    const { error } = await this.db.from("perfis").upsert(paraLinha(this.userId, perfil));
    if (error) falha(error, "Não foi possível salvar seu perfil.");
  }

  async salvarSessao(s: SessaoAtiva): Promise<void> {
    const agora = Date.now();
    const { error: e1 } = await this.db.from("sessoes").upsert({
      id: s.id,
      user_id: this.userId,
      plano_id: s.planoId,
      plano_sessao_id: s.planoSessaoId,
      titulo: s.titulo.slice(0, 80),
      status: s.status,
      iniciada_em: s.iniciadaEm,
      finalizada_em: s.finalizadaEm,
      duracao_ativa_s: Math.min(86400, Math.round(tempoAtivoMs(s, agora) / 1000)),
      series_concluidas: progresso(s).seriesFeitas,
      volume_kg: volumeKg(s),
    });
    if (e1) falha(e1, "Não foi possível salvar o treino.");

    const feitas = s.exercicios.flatMap((e, ordemExercicio) =>
      e.series
        .map((x, ordem) => ({ x, ordem }))
        .filter(({ x }) => x.feita && x.reps != null)
        .map(({ x, ordem }) => ({
          id: x.id,
          sessao_id: s.id,
          user_id: this.userId,
          exercicio_id: e.exercicioId,
          ordem_exercicio: ordemExercicio,
          ordem,
          carga_kg: e.porTempo ? null : x.cargaKg,
          reps: x.reps!,
          concluida_em: x.feitaEm!,
        })),
    );
    if (feitas.length) {
      const { error } = await this.db.from("series").upsert(feitas);
      if (error) falha(error, "Não foi possível salvar as séries.");
    }
    // séries desfeitas no aparelho saem do banco
    const remover = this.db.from("series").delete().eq("sessao_id", s.id);
    const { error: e3 } = feitas.length ? await remover.not("id", "in", `(${feitas.map((f) => f.id).join(",")})`) : await remover;
    if (e3) falha(e3, "Não foi possível atualizar as séries.");
  }

  async historico(ids: string[]): Promise<Record<string, HistoricoExercicio>> {
    if (!ids.length) return {};
    const [recentes, recordes] = await Promise.all([
      this.db
        .from("series")
        .select("sessao_id, exercicio_id, ordem, carga_kg, reps, concluida_em")
        .eq("user_id", this.userId)
        .in("exercicio_id", ids)
        .order("concluida_em", { ascending: false })
        .limit(400),
      this.db.rpc("recordes", { p_exercicios: ids }),
    ]);
    if (recentes.error) falha(recentes.error, "Não foi possível carregar o histórico.");
    if (recordes.error) falha(recordes.error, "Não foi possível carregar os recordes.");
    const linhas = (recentes.data ?? []) as LinhaSerie[];
    const porId = Object.fromEntries(ids.map((id) => [id, agruparPorSessao(linhas.filter((l) => l.exercicio_id === id).map(deLinhaSerie), 1)]));
    const max = Object.fromEntries(((recordes.data ?? []) as { exercicio_id: string; max_carga_kg: number | string }[]).map((r) => [r.exercicio_id, Number(r.max_carga_kg)]));
    return montarHistorico(ids, porId, max);
  }

  async historicoExercicio(exercicioId: string, limite = 10): Promise<RegistroExercicio[]> {
    const { data, error } = await this.db
      .from("series")
      .select("sessao_id, exercicio_id, ordem, carga_kg, reps, concluida_em")
      .eq("user_id", this.userId)
      .eq("exercicio_id", exercicioId)
      .order("concluida_em", { ascending: false })
      .limit(limite * 8);
    if (error) falha(error, "Não foi possível carregar o histórico.");
    return agruparPorSessao(((data ?? []) as LinhaSerie[]).map(deLinhaSerie), limite);
  }

  async salvarPlano(plano: Plano): Promise<void> {
    const { error } = await this.db.from("planos").upsert(paraLinhaPlano(this.userId, plano));
    if (error) falha(error, "Não foi possível salvar sua ficha.");
  }

  async favoritos(): Promise<string[]> {
    const { data, error } = await this.db.from("favoritos").select("exercicio_id").eq("user_id", this.userId);
    if (error) falha(error, "Não foi possível carregar seus favoritos.");
    return (data ?? []).map((l: { exercicio_id: string }) => l.exercicio_id);
  }

  async definirFavorito(exercicioId: string, favorito: boolean): Promise<void> {
    const tabela = this.db.from("favoritos");
    const { error } = favorito
      ? await tabela.upsert({ user_id: this.userId, exercicio_id: exercicioId }, { ignoreDuplicates: true })
      : await tabela.delete().eq("user_id", this.userId).eq("exercicio_id", exercicioId);
    if (error) falha(error, "Não foi possível atualizar o favorito.");
  }

  async excluirConta(): Promise<void> {
    const { error } = await this.db.rpc("excluir_minha_conta");
    if (error) falha(error, "Não foi possível excluir sua conta. Tente de novo.");
  }
}

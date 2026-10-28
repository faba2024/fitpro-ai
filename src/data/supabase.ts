import type { SupabaseClient } from "@supabase/supabase-js";
import { progresso, tempoAtivoMs, volumeKg, type HistoricoExercicio, type SessaoAtiva } from "@/domain/sessao";
import type { DadosUsuario, Foto, Medida, PerfilCompleto, Plano, PoseFoto, SessaoTreino } from "@/domain/tipos";
import { agruparPorSessao, montarHistorico, type RegistroExercicio } from "./repositorio";
import { deLinha, paraLinha, resumo, type LinhaPerfil } from "./perfilMapper";
import { deLinhaPlano, paraLinhaPlano, type LinhaPlano } from "./planoMapper";
import type { Repositorio } from "./repositorio";

export class ErroDados extends Error {}

const BUCKET_FOTOS = "fotos-evolucao";

interface LinhaMedida {
  id: string;
  data: string;
  peso_kg: number | string | null;
  gordura_pct: number | string | null;
  cintura_cm: number | string | null;
  quadril_cm: number | string | null;
  peito_cm: number | string | null;
  braco_cm: number | string | null;
  coxa_cm: number | string | null;
  panturrilha_cm: number | string | null;
}

const n = (v: number | string | null | undefined) => (v == null ? null : Number(v));

const deLinhaMedida = (l: LinhaMedida): Medida => ({
  id: l.id,
  data: l.data,
  pesoKg: n(l.peso_kg),
  gorduraPct: n(l.gordura_pct),
  cinturaCm: n(l.cintura_cm),
  quadrilCm: n(l.quadril_cm),
  peitoCm: n(l.peito_cm),
  bracoCm: n(l.braco_cm),
  coxaCm: n(l.coxa_cm),
  panturrilhaCm: n(l.panturrilha_cm),
});

const paraLinhaMedida = (userId: string, m: Medida) => ({
  user_id: userId,
  data: m.data,
  peso_kg: m.pesoKg ?? null,
  gordura_pct: m.gorduraPct ?? null,
  cintura_cm: m.cinturaCm ?? null,
  quadril_cm: m.quadrilCm ?? null,
  peito_cm: m.peitoCm ?? null,
  braco_cm: m.bracoCm ?? null,
  coxa_cm: m.coxaCm ?? null,
  panturrilha_cm: m.panturrilhaCm ?? null,
});

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
    const [perfilRes, planoRes, sessoesRes, medidasRes] = await Promise.all([
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
      this.db.from("medidas").select("*").eq("user_id", this.userId).order("data", { ascending: true }).limit(1000),
    ]);
    if (perfilRes.error) falha(perfilRes.error, "Não foi possível carregar seu perfil.");
    if (planoRes.error) falha(planoRes.error, "Não foi possível carregar sua ficha.");
    if (sessoesRes.error) falha(sessoesRes.error, "Não foi possível carregar seus treinos.");
    if (medidasRes.error) falha(medidasRes.error, "Não foi possível carregar suas medidas.");
    const medidas = ((medidasRes.data ?? []) as LinhaMedida[]).map(deLinhaMedida);
    const data = perfilRes.data;
    const completo = data ? deLinha(data) : null;
    return {
      perfil: completo ? resumo(completo) : null,
      perfilCompleto: completo,
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
      // sem medidas registradas, o peso do cadastro serve de primeiro ponto
      medidas: medidas.length || !completo || !data?.atualizado_em ? medidas : [{ data: data.atualizado_em.slice(0, 10), pesoKg: completo.pesoKg }],
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

  async recordes(ids: string[]): Promise<Record<string, number>> {
    if (!ids.length) return {};
    const { data, error } = await this.db.rpc("recordes", { p_exercicios: ids });
    if (error) falha(error, "Não foi possível carregar os recordes.");
    return Object.fromEntries(((data ?? []) as { exercicio_id: string; max_carga_kg: number | string }[]).map((r) => [r.exercicio_id, Number(r.max_carga_kg)]));
  }

  async salvarMedida(m: Medida): Promise<void> {
    const { error } = await this.db.from("medidas").upsert(paraLinhaMedida(this.userId, m), { onConflict: "user_id,data" });
    if (error) falha(error, "Não foi possível salvar as medidas.");
  }

  async excluirMedida(id: string): Promise<void> {
    const { error } = await this.db.from("medidas").delete().eq("id", id).eq("user_id", this.userId);
    if (error) falha(error, "Não foi possível apagar o registro.");
  }

  readonly suportaFotos = true;

  async listarFotos(): Promise<Foto[]> {
    const { data, error } = await this.db.from("fotos").select("id, data, pose, caminho").eq("user_id", this.userId).order("data", { ascending: false }).limit(200);
    if (error) falha(error, "Não foi possível carregar suas fotos.");
    const linhas = (data ?? []) as { id: string; data: string; pose: PoseFoto; caminho: string }[];
    if (!linhas.length) return [];
    // bucket privado: URLs assinadas valem 1 hora
    const { data: urls, error: e2 } = await this.db.storage.from(BUCKET_FOTOS).createSignedUrls(linhas.map((l) => l.caminho), 3600);
    if (e2) falha(e2, "Não foi possível abrir suas fotos.");
    const porCaminho = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));
    return linhas.filter((l) => porCaminho.get(l.caminho)).map((l) => ({ ...l, url: porCaminho.get(l.caminho)! }));
  }

  async enviarFoto(arquivo: Blob, data: string, pose: PoseFoto): Promise<void> {
    const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg";
    const caminho = `${this.userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await this.db.storage.from(BUCKET_FOTOS).upload(caminho, arquivo, { contentType: arquivo.type || "image/jpeg", upsert: false });
    if (error) falha(error, "Não foi possível enviar a foto.");
    const { error: e2 } = await this.db.from("fotos").insert({ user_id: this.userId, data, pose, caminho });
    if (e2) {
      // não deixa arquivo sem registro
      await this.db.storage.from(BUCKET_FOTOS).remove([caminho]);
      falha(e2, "Não foi possível registrar a foto.");
    }
  }

  async excluirFoto(foto: Foto): Promise<void> {
    const { error } = await this.db.storage.from(BUCKET_FOTOS).remove([foto.caminho]);
    if (error) falha(error, "Não foi possível apagar a foto.");
    const { error: e2 } = await this.db.from("fotos").delete().eq("id", foto.id);
    if (e2) falha(e2, "Não foi possível apagar a foto.");
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
    // arquivos do Storage não somem com a conta: apaga as fotos primeiro
    const { data: arquivos, error: e1 } = await this.db.storage.from(BUCKET_FOTOS).list(this.userId, { limit: 1000 });
    if (e1) falha(e1, "Não foi possível apagar suas fotos. Tente de novo.");
    if (arquivos?.length) {
      const { error: e2 } = await this.db.storage.from(BUCKET_FOTOS).remove(arquivos.map((a) => `${this.userId}/${a.name}`));
      if (e2) falha(e2, "Não foi possível apagar suas fotos. Tente de novo.");
    }
    const { error } = await this.db.rpc("excluir_minha_conta");
    if (error) falha(error, "Não foi possível excluir sua conta. Tente de novo.");
  }
}

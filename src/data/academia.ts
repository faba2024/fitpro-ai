// Dados dos painéis da academia (etapa 11). Só existe com conta: a RLS e as funções do banco
// decidem o que cada papel vê; aqui só convertemos linhas e mensagens de erro.
import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarSlug, type Convite, type FormaPagamento, type Membro, type Pagamento, type Papel } from "@/domain/academia";
import type { Medida, Nivel, Objetivo, PerfilCompleto, Plano, SessaoTreino } from "@/domain/tipos";
import { deLinha, type LinhaPerfil } from "./perfilMapper";
import { deLinhaPlano, paraLinhaPlano, type LinhaPlano } from "./planoMapper";
import { deLinhaMedida, ErroDados, falha, type LinhaMedida } from "./supabase";

export interface Vinculo {
  academiaId: string;
  academiaNome: string;
  papel: Papel;
  ativo: boolean;
  professorId: string | null;
  professorNome: string | null;
}

export interface Academia {
  id: string;
  nome: string;
  mensalidadePadrao: number | null;
}

export interface ResumoAluno {
  id: string;
  academiaId: string;
  nome: string;
  objetivo: Objetivo;
  nivel: Nivel;
  diasSemana: number;
  parqAlerta: boolean;
  temLimitacoes: boolean;
  /** inícios (ISO) dos treinos finalizados nos últimos 30 dias */
  treinos30d: string[];
  ficha: { nome: string; origem: Plano["origem"]; revisadaEm: string | null } | null;
}

export interface DetalheAluno {
  id: string;
  perfil: PerfilCompleto;
  plano: Plano | null;
  sessoes: SessaoTreino[];
  medidas: Medida[];
}

export interface NovoPagamento {
  alunoId: string;
  competencia: string;
  valor: number;
  pagoEm: string;
  forma: FormaPagamento;
  observacao: string;
}

export interface RepoAcademia {
  minhasAcademias(): Promise<Vinculo[]>;
  criarAcademia(nome: string): Promise<string>;
  aceitarConvite(codigo: string): Promise<{ academiaNome: string; papel: Papel }>;
  sairDaAcademia(academiaId: string, papel: Papel): Promise<void>;

  // administração
  academia(id: string): Promise<Academia>;
  salvarMensalidadePadrao(id: string, valor: number | null): Promise<void>;
  membros(academiaId: string): Promise<Membro[]>;
  definirProfessor(academiaId: string, alunoId: string, professorId: string | null): Promise<void>;
  definirAtivo(academiaId: string, userId: string, papel: Papel, ativo: boolean): Promise<void>;
  pagamentos(academiaId: string, competencia: string): Promise<Pagamento[]>;
  registrarPagamento(academiaId: string, p: NovoPagamento): Promise<void>;
  excluirPagamento(id: string): Promise<void>;

  // convites (admin: todos da academia; professor: os que ele criou)
  convites(academiaId: string): Promise<Convite[]>;
  criarConvite(academiaId: string, papel: Exclude<Papel, "admin">, usos: number, dias: number, vincularAMim?: boolean): Promise<string>;
  revogarConvite(codigo: string): Promise<void>;

  // professor
  meusAlunos(): Promise<ResumoAluno[]>;
  aluno(id: string): Promise<DetalheAluno>;
  revisarFicha(planoId: string, observacao: string): Promise<void>;
  salvarFichaDoAluno(alunoId: string, plano: Plano): Promise<void>;
}

type ErroPg = { message?: string; code?: string } | null;

/** Mensagens das funções do banco já são para a pessoa; as de restrição genérica não. */
function falhaAcademia(e: ErroPg, padrao: string): never {
  if (e?.code === "P0002") throw new ErroDados("Convite inválido ou expirado. Confira o código ou peça um novo.");
  if (e?.code === "23505") throw new ErroDados("Já existe um registro igual (por exemplo, pagamento deste aluno neste mês).");
  if (e?.code === "42501") throw new ErroDados("Você não tem permissão para fazer isso.");
  if (e?.code === "23514" && e.message && !/violates|constraint/i.test(e.message)) {
    throw new ErroDados(e.message.charAt(0).toUpperCase() + e.message.slice(1) + ".");
  }
  falha(e, padrao);
}

interface LinhaMembro {
  user_id: string;
  nome: string;
  papel: Papel;
  professor_id: string | null;
  ativo: boolean;
  criado_em: string;
}

interface LinhaPagamento {
  id: string;
  aluno_id: string;
  competencia: string;
  valor: number | string;
  pago_em: string;
  forma: FormaPagamento;
  observacao: string;
}

interface LinhaConvite {
  codigo: string;
  papel: Convite["papel"];
  professor_id: string | null;
  expira_em: string;
  usos: number;
  usos_max: number;
}

const deLinhaSessao = (l: Record<string, unknown>): SessaoTreino => ({
  id: String(l.id),
  planoSessaoId: String(l.plano_sessao_id),
  titulo: String(l.titulo),
  status: l.status as SessaoTreino["status"],
  iniciadaEm: String(l.iniciada_em),
  finalizadaEm: (l.finalizada_em as string | null) ?? null,
  seriesConcluidas: Number(l.series_concluidas),
  volumeKg: Number(l.volume_kg),
});

export class SupabaseRepoAcademia implements RepoAcademia {
  constructor(private db: SupabaseClient, private userId: string) {}

  async minhasAcademias(): Promise<Vinculo[]> {
    const { data, error } = await this.db.rpc("minhas_academias");
    if (error) falhaAcademia(error, "Não foi possível carregar suas academias.");
    return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
      academiaId: String(l.academia_id),
      academiaNome: String(l.academia_nome),
      papel: l.papel as Papel,
      ativo: Boolean(l.ativo),
      professorId: (l.professor_id as string | null) ?? null,
      professorNome: (l.professor_nome as string | null) ?? null,
    }));
  }

  async criarAcademia(nome: string): Promise<string> {
    // o slug não aparece na URL; o sufixo evita colisão entre academias de mesmo nome
    const slug = `${gerarSlug(nome) || "academia"}-${crypto.randomUUID().slice(0, 6)}`;
    const { data, error } = await this.db.rpc("criar_academia", { p_nome: nome.trim(), p_slug: slug });
    if (error) falhaAcademia(error, "Não foi possível criar a academia.");
    return String(data);
  }

  async aceitarConvite(codigo: string) {
    const { data, error } = await this.db.rpc("aceitar_convite", { p_codigo: codigo });
    if (error) falhaAcademia(error, "Não foi possível usar o convite.");
    const l = ((data ?? []) as Record<string, unknown>[])[0];
    if (!l) throw new ErroDados("Não foi possível usar o convite.");
    return { academiaNome: String(l.academia_nome), papel: l.papel as Papel };
  }

  async sairDaAcademia(academiaId: string, papel: Papel): Promise<void> {
    const { error } = await this.db.from("membros_academia").delete().eq("academia_id", academiaId).eq("user_id", this.userId).eq("papel", papel);
    if (error) falhaAcademia(error, "Não foi possível sair da academia.");
  }

  async academia(id: string): Promise<Academia> {
    const { data, error } = await this.db.from("academias").select("id, nome, mensalidade_padrao").eq("id", id).maybeSingle();
    if (error) falhaAcademia(error, "Não foi possível carregar a academia.");
    if (!data) throw new ErroDados("Academia não encontrada ou sem acesso.");
    return { id: data.id, nome: data.nome, mensalidadePadrao: data.mensalidade_padrao == null ? null : Number(data.mensalidade_padrao) };
  }

  async salvarMensalidadePadrao(id: string, valor: number | null): Promise<void> {
    const { error } = await this.db.from("academias").update({ mensalidade_padrao: valor }).eq("id", id);
    if (error) falhaAcademia(error, "Não foi possível salvar a mensalidade.");
  }

  async membros(academiaId: string): Promise<Membro[]> {
    const { data, error } = await this.db.rpc("membros_da_academia", { p_academia: academiaId });
    if (error) falhaAcademia(error, "Não foi possível carregar os membros.");
    return ((data ?? []) as LinhaMembro[]).map((l) => ({
      userId: l.user_id,
      nome: l.nome,
      papel: l.papel,
      professorId: l.professor_id,
      ativo: l.ativo,
      desde: l.criado_em,
    }));
  }

  async definirProfessor(academiaId: string, alunoId: string, professorId: string | null): Promise<void> {
    const { error } = await this.db
      .from("membros_academia")
      .update({ professor_id: professorId })
      .eq("academia_id", academiaId)
      .eq("user_id", alunoId)
      .eq("papel", "aluno");
    if (error) falhaAcademia(error, "Não foi possível trocar o professor.");
  }

  async definirAtivo(academiaId: string, userId: string, papel: Papel, ativo: boolean): Promise<void> {
    const { error } = await this.db.from("membros_academia").update({ ativo }).eq("academia_id", academiaId).eq("user_id", userId).eq("papel", papel);
    if (error) falhaAcademia(error, "Não foi possível alterar o vínculo.");
  }

  async pagamentos(academiaId: string, competencia: string): Promise<Pagamento[]> {
    const { data, error } = await this.db
      .from("pagamentos")
      .select("id, aluno_id, competencia, valor, pago_em, forma, observacao")
      .eq("academia_id", academiaId)
      .eq("competencia", competencia);
    if (error) falhaAcademia(error, "Não foi possível carregar os pagamentos.");
    return ((data ?? []) as LinhaPagamento[]).map((l) => ({
      id: l.id,
      alunoId: l.aluno_id,
      competencia: l.competencia,
      valor: Number(l.valor),
      pagoEm: l.pago_em,
      forma: l.forma,
      observacao: l.observacao,
    }));
  }

  async registrarPagamento(academiaId: string, p: NovoPagamento): Promise<void> {
    const { error } = await this.db.from("pagamentos").insert({
      academia_id: academiaId,
      aluno_id: p.alunoId,
      competencia: p.competencia,
      valor: Math.round(p.valor * 100) / 100,
      pago_em: p.pagoEm,
      forma: p.forma,
      observacao: p.observacao.trim().slice(0, 300),
    });
    if (error) falhaAcademia(error, "Não foi possível registrar o pagamento.");
  }

  async excluirPagamento(id: string): Promise<void> {
    const { error } = await this.db.from("pagamentos").delete().eq("id", id);
    if (error) falhaAcademia(error, "Não foi possível excluir o pagamento.");
  }

  async convites(academiaId: string): Promise<Convite[]> {
    const { data, error } = await this.db
      .from("convites")
      .select("codigo, papel, professor_id, expira_em, usos, usos_max")
      .eq("academia_id", academiaId)
      .order("criado_em", { ascending: false });
    if (error) falhaAcademia(error, "Não foi possível carregar os convites.");
    return ((data ?? []) as LinhaConvite[]).map((l) => ({
      codigo: l.codigo,
      papel: l.papel,
      professorId: l.professor_id,
      expiraEm: l.expira_em,
      usos: l.usos,
      usosMax: l.usos_max,
    }));
  }

  async criarConvite(academiaId: string, papel: Exclude<Papel, "admin">, usos: number, dias: number, vincularAMim = false): Promise<string> {
    const { data, error } = await this.db.rpc("criar_convite", { p_academia: academiaId, p_papel: papel, p_usos: usos, p_dias: dias, p_vincular_a_mim: vincularAMim });
    if (error) falhaAcademia(error, "Não foi possível criar o convite.");
    return String(data);
  }

  async revogarConvite(codigo: string): Promise<void> {
    const { error } = await this.db.from("convites").delete().eq("codigo", codigo);
    if (error) falhaAcademia(error, "Não foi possível revogar o convite.");
  }

  async meusAlunos(): Promise<ResumoAluno[]> {
    const { data: vinculos, error } = await this.db
      .from("membros_academia")
      .select("user_id, academia_id")
      .eq("professor_id", this.userId)
      .eq("papel", "aluno")
      .eq("ativo", true);
    if (error) falhaAcademia(error, "Não foi possível carregar seus alunos.");
    const lista = (vinculos ?? []) as { user_id: string; academia_id: string }[];
    if (!lista.length) return [];
    const ids = [...new Set(lista.map((v) => v.user_id))];
    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [perfis, sessoes, planos] = await Promise.all([
      this.db.from("perfis").select("id, nome, objetivo, nivel, dias_semana, limitacoes, parq_alerta").in("id", ids),
      this.db.from("sessoes").select("user_id, iniciada_em").in("user_id", ids).neq("status", "em_andamento").gte("iniciada_em", desde).limit(2000),
      this.db.from("planos").select("aluno_id, nome, origem, revisado_em").in("aluno_id", ids).eq("ativo", true),
    ]);
    if (perfis.error) falhaAcademia(perfis.error, "Não foi possível carregar seus alunos.");
    if (sessoes.error) falhaAcademia(sessoes.error, "Não foi possível carregar os treinos dos alunos.");
    if (planos.error) falhaAcademia(planos.error, "Não foi possível carregar as fichas dos alunos.");
    const perfilDe = new Map(((perfis.data ?? []) as Record<string, unknown>[]).map((p) => [String(p.id), p]));
    const planoDe = new Map(((planos.data ?? []) as Record<string, unknown>[]).map((p) => [String(p.aluno_id), p]));
    const treinos = new Map<string, string[]>();
    for (const s of (sessoes.data ?? []) as { user_id: string; iniciada_em: string }[]) treinos.set(s.user_id, [...(treinos.get(s.user_id) ?? []), s.iniciada_em]);

    const vistos = new Set<string>();
    const alunos: ResumoAluno[] = [];
    for (const v of lista) {
      const p = perfilDe.get(v.user_id);
      // sem perfil ainda (cadastro incompleto) ou já listado por outra academia
      if (!p || vistos.has(v.user_id)) continue;
      vistos.add(v.user_id);
      const plano = planoDe.get(v.user_id);
      alunos.push({
        id: v.user_id,
        academiaId: v.academia_id,
        nome: String(p.nome),
        objetivo: p.objetivo as Objetivo,
        nivel: p.nivel as Nivel,
        diasSemana: Number(p.dias_semana),
        parqAlerta: Boolean(p.parq_alerta),
        temLimitacoes: String(p.limitacoes ?? "").trim() !== "",
        treinos30d: treinos.get(v.user_id) ?? [],
        ficha: plano ? { nome: String(plano.nome), origem: plano.origem as Plano["origem"], revisadaEm: (plano.revisado_em as string | null) ?? null } : null,
      });
    }
    return alunos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  async aluno(id: string): Promise<DetalheAluno> {
    const [perfil, plano, sessoes, medidas] = await Promise.all([
      this.db.from("perfis").select("*").eq("id", id).maybeSingle<LinhaPerfil>(),
      this.db.from("planos").select("*").eq("aluno_id", id).eq("ativo", true).maybeSingle<LinhaPlano>(),
      this.db
        .from("sessoes")
        .select("id, plano_sessao_id, titulo, status, iniciada_em, finalizada_em, series_concluidas, volume_kg")
        .eq("user_id", id)
        .neq("status", "em_andamento")
        .order("iniciada_em", { ascending: false })
        .limit(20),
      this.db.from("medidas").select("*").eq("user_id", id).order("data", { ascending: false }).limit(12),
    ]);
    if (perfil.error) falhaAcademia(perfil.error, "Não foi possível carregar o aluno.");
    // a RLS esconde quem não é aluno deste professor: para a tela, é como não existir
    if (!perfil.data) throw new ErroDados("Aluno não encontrado entre os seus.");
    if (plano.error) falhaAcademia(plano.error, "Não foi possível carregar a ficha do aluno.");
    if (sessoes.error) falhaAcademia(sessoes.error, "Não foi possível carregar os treinos do aluno.");
    if (medidas.error) falhaAcademia(medidas.error, "Não foi possível carregar as medidas do aluno.");
    return {
      id,
      perfil: deLinha(perfil.data),
      plano: plano.data ? deLinhaPlano(plano.data) : null,
      sessoes: ((sessoes.data ?? []) as Record<string, unknown>[]).map(deLinhaSessao),
      medidas: ((medidas.data ?? []) as LinhaMedida[]).map(deLinhaMedida),
    };
  }

  async revisarFicha(planoId: string, observacao: string): Promise<void> {
    const { error } = await this.db
      .from("planos")
      .update({ revisado_por: this.userId, revisado_em: new Date().toISOString(), observacao_profissional: observacao.trim().slice(0, 2000) || null })
      .eq("id", planoId);
    if (error) falhaAcademia(error, "Não foi possível marcar a ficha como revisada.");
  }

  async salvarFichaDoAluno(alunoId: string, plano: Plano): Promise<void> {
    // ficha salva pelo professor já sai revisada por ele
    const linha = {
      ...paraLinhaPlano(alunoId, { ...plano, origem: "professor" }),
      revisado_por: this.userId,
      revisado_em: new Date().toISOString(),
      observacao_profissional: plano.observacaoProfissional?.trim().slice(0, 2000) || null,
    };
    const { error } = await this.db.from("planos").upsert(linha);
    if (error) falhaAcademia(error, "Não foi possível salvar a ficha do aluno.");
  }
}

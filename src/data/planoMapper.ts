// Conversão entre a linha de public.planos e o tipo Plano do domínio.
import type { ItemPlano, Objetivo, ParametrosPlano, Plano, PlanoSessao } from "@/domain/tipos";

export interface LinhaPlano {
  id: string;
  aluno_id: string;
  nome: string;
  objetivo: Objetivo;
  origem: "motor" | "professor" | "manual";
  ativo: boolean;
  estrutura: unknown;
  parametros: unknown;
  explicacao: string;
  revisado_em: string | null;
  observacao_profissional: string | null;
}

const num = (v: unknown, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
const txt = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);

/** Lê a estrutura com tolerância: campos ausentes ou estranhos viram valores seguros. */
function lerSessoes(estrutura: unknown): PlanoSessao[] {
  if (!Array.isArray(estrutura)) return [];
  return estrutura.map((s: Record<string, unknown>, i) => ({
    id: txt(s?.id, `s${i}`),
    nome: txt(s?.nome, String.fromCharCode(65 + i)),
    titulo: txt(s?.titulo, "Treino"),
    itens: (Array.isArray(s?.itens) ? s.itens : []).map(
      (it: Record<string, unknown>): ItemPlano => ({
        exercicioId: txt(it?.exercicioId),
        nome: txt(it?.nome, txt(it?.exercicioId)),
        grupo: txt(it?.grupo),
        series: num(it?.series, 3),
        repsMin: num(it?.repsMin, 8),
        repsMax: num(it?.repsMax, 12),
        descansoS: num(it?.descansoS, 60),
        cargaKg: typeof it?.cargaKg === "number" ? it.cargaKg : null,
        ...(it?.porTempo === true ? { porTempo: true } : {}),
      }),
    ),
  }));
}

export function deLinhaPlano(l: LinhaPlano): Plano {
  const p = l.parametros as Partial<ParametrosPlano> | null;
  return {
    id: l.id,
    nome: l.nome,
    objetivo: l.objetivo,
    sessoes: lerSessoes(l.estrutura),
    origem: l.origem,
    parametros: p && typeof p === "object" && p.objetivo ? (p as ParametrosPlano) : undefined,
    explicacao: l.explicacao,
    revisadoEm: l.revisado_em,
    observacaoProfissional: l.observacao_profissional,
  };
}

/** Campos gravados pelo aluno (revisão e professor ficam a cargo do banco). */
export function paraLinhaPlano(alunoId: string, p: Plano) {
  return {
    id: p.id,
    aluno_id: alunoId,
    nome: p.nome.trim().slice(0, 80) || "Minha ficha",
    objetivo: p.objetivo,
    origem: p.origem ?? "manual",
    ativo: true,
    estrutura: p.sessoes,
    parametros: p.parametros ?? {},
    explicacao: (p.explicacao ?? "").slice(0, 1000),
  };
}

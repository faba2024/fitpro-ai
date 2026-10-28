// Edição da ficha: operações puras (cada uma devolve um plano novo) e validação dos campos.
import { adequadoAoNivel, disponivel, GRUPOS, grupoDoMusculo, prescricaoDoExercicio, type Exercicio } from "./exercicios";
import type { ItemPlano, Nivel, Objetivo, ParametrosPlano, Perfil, PerfilCompleto, Plano, PlanoSessao } from "./tipos";
import { parqPedeLiberacao } from "./tipos";

/** Parâmetros do motor a partir do perfil completo (conta) ou do resumo (modo local/exemplo). */
export function parametrosDoPerfil(completo: PerfilCompleto | null, resumo: Perfil | null): ParametrosPlano | null {
  if (completo) {
    return {
      objetivo: completo.objetivo,
      nivel: completo.nivel,
      diasSemana: completo.diasSemana,
      minutosSessao: completo.minutosSessao,
      equipamentos: completo.equipamentos,
      conservador: parqPedeLiberacao(completo.parq) || completo.limitacoes.trim() !== "",
    };
  }
  if (resumo) {
    return { objetivo: resumo.objetivo, nivel: resumo.nivel, diasSemana: resumo.metaSemanal, minutosSessao: resumo.minutosSessao, equipamentos: ["academia_completa"], conservador: false };
  }
  return null;
}

export function itemDoExercicio(ex: Exercicio, objetivo: Objetivo, nivel: Nivel, series?: number): ItemPlano {
  const rx = prescricaoDoExercicio(ex, objetivo, nivel);
  return {
    exercicioId: ex.id,
    nome: ex.nome,
    grupo: GRUPOS[grupoDoMusculo(ex.musculosPrincipais[0]!)].rotulo,
    series: series ?? rx.series,
    repsMin: rx.repsMin,
    repsMax: rx.repsMax,
    descansoS: rx.descansoS,
    cargaKg: null,
    ...(ex.porTempo ? { porTempo: true } : {}),
  };
}

const naSessao = (plano: Plano, sessaoId: string, f: (s: PlanoSessao) => PlanoSessao): Plano => ({
  ...plano,
  sessoes: plano.sessoes.map((s) => (s.id === sessaoId ? f(s) : s)),
});

export const atualizarItem = (plano: Plano, sessaoId: string, idx: number, mudancas: Partial<ItemPlano>): Plano =>
  naSessao(plano, sessaoId, (s) => ({ ...s, itens: s.itens.map((it, i) => (i === idx ? { ...it, ...mudancas } : it)) }));

export const removerItem = (plano: Plano, sessaoId: string, idx: number): Plano =>
  naSessao(plano, sessaoId, (s) => ({ ...s, itens: s.itens.filter((_, i) => i !== idx) }));

export function moverItem(plano: Plano, sessaoId: string, idx: number, direcao: -1 | 1): Plano {
  return naSessao(plano, sessaoId, (s) => {
    const alvo = idx + direcao;
    if (alvo < 0 || alvo >= s.itens.length) return s;
    const itens = [...s.itens];
    [itens[idx], itens[alvo]] = [itens[alvo]!, itens[idx]!];
    return { ...s, itens };
  });
}

export const adicionarItem = (plano: Plano, sessaoId: string, item: ItemPlano): Plano =>
  naSessao(plano, sessaoId, (s) => ({ ...s, itens: [...s.itens, item] }));

export const renomearSessao = (plano: Plano, sessaoId: string, titulo: string): Plano => naSessao(plano, sessaoId, (s) => ({ ...s, titulo }));

/** Troca o exercício mantendo o número de séries; faixa e descanso seguem o novo exercício. Carga zera. */
export function trocarExercicio(plano: Plano, sessaoId: string, idx: number, novo: Exercicio, objetivo: Objetivo, nivel: Nivel): Plano {
  return naSessao(plano, sessaoId, (s) => ({
    ...s,
    itens: s.itens.map((it, i) => (i === idx ? itemDoExercicio(novo, objetivo, nivel, it.series) : it)),
  }));
}

/**
 * Substitutos possíveis: primeiro as alternativas cadastradas, depois outros exercícios com o mesmo
 * músculo principal. Só o que a pessoa consegue fazer, adequado ao nível e fora do treino atual.
 */
export function substitutos(ex: Exercicio, catalogo: readonly Exercicio[], p: Pick<ParametrosPlano, "nivel" | "equipamentos">, jaNoTreino: ReadonlySet<string>): Exercicio[] {
  const ok = (e: Exercicio) => e.id !== ex.id && !jaNoTreino.has(e.id) && disponivel(e, p.equipamentos) && adequadoAoNivel(e, p.nivel);
  const porId = new Map(catalogo.map((e) => [e.id, e]));
  const alternativas = ex.alternativas.map((id) => porId.get(id)).filter((e): e is Exercicio => !!e && ok(e));
  const mesmoMusculo = catalogo.filter((e) => ok(e) && !alternativas.includes(e) && e.musculosPrincipais.some((m) => ex.musculosPrincipais.includes(m)));
  return [...alternativas, ...mesmoMusculo];
}

export type ErrosItem = Partial<Record<"series" | "repsMin" | "repsMax" | "descansoS" | "cargaKg", string>>;

export function validarItem(it: ItemPlano): ErrosItem {
  const e: ErrosItem = {};
  const inteiro = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
  if (!inteiro(it.series, 1, 10)) e.series = "De 1 a 10 séries.";
  const lim = it.porTempo ? 600 : 100;
  if (!inteiro(it.repsMin, 1, lim)) e.repsMin = it.porTempo ? "De 1 a 600 s." : "De 1 a 100.";
  if (!inteiro(it.repsMax, 1, lim)) e.repsMax = it.porTempo ? "De 1 a 600 s." : "De 1 a 100.";
  else if (!e.repsMin && it.repsMax < it.repsMin) e.repsMax = "Precisa ser maior ou igual ao mínimo.";
  if (!inteiro(it.descansoS, 0, 600)) e.descansoS = "De 0 a 600 s.";
  if (it.cargaKg != null && (!Number.isFinite(it.cargaKg) || it.cargaKg < 0 || it.cargaKg > 500)) e.cargaKg = "De 0 a 500 kg.";
  return e;
}

export function fichaValida(plano: Plano): boolean {
  return plano.sessoes.length > 0 && plano.sessoes.every((s) => s.itens.length > 0 && s.itens.every((i) => !Object.keys(validarItem(i)).length));
}

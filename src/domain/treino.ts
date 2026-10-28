import type { PlanoSessao, Plano, SessaoTreino } from "./tipos";

/** Tempo médio de execução de uma série, sem contar o descanso. */
const SEGUNDOS_POR_SERIE = 40;
/** Preparar o aparelho, ajustar carga e ir para o próximo exercício. */
const SEGUNDOS_TROCA = 120;

/**
 * Próxima sessão da divisão: a seguinte à última concluída deste plano (A → B → C → A).
 * Sem histórico, começa pela primeira.
 */
export function proximaSessao(plano: Plano, sessoes: SessaoTreino[]): PlanoSessao | null {
  if (!plano.sessoes.length) return null;
  const ids = plano.sessoes.map((s) => s.id);
  const ultima = sessoes
    .filter((s) => s.status === "concluida" && ids.includes(s.planoSessaoId))
    .sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm))[0];
  if (!ultima) return plano.sessoes[0]!;
  const i = ids.indexOf(ultima.planoSessaoId);
  return plano.sessoes[(i + 1) % plano.sessoes.length]!;
}

/** Duração estimada em minutos, arredondada para múltiplos de 5. */
export function duracaoEstimadaMin(sessao: PlanoSessao): number {
  const segundos = sessao.itens.reduce(
    (t, it) => t + SEGUNDOS_TROCA + it.series * SEGUNDOS_POR_SERIE + Math.max(0, it.series - 1) * it.descansoS,
    0,
  );
  return Math.max(5, Math.round(segundos / 60 / 5) * 5);
}

/** Grupos musculares da sessão, sem repetir, na ordem dos exercícios. */
export function gruposDaSessao(sessao: PlanoSessao): string[] {
  return [...new Set(sessao.itens.map((i) => i.grupo))];
}

/** Sessão iniciada e não finalizada (para retomar depois de fechar o app). */
export function sessaoEmAndamento(sessoes: SessaoTreino[]): SessaoTreino | null {
  return sessoes.find((s) => s.status === "em_andamento") ?? null;
}

export function ultimasConcluidas(sessoes: SessaoTreino[], n: number): SessaoTreino[] {
  return sessoes
    .filter((s) => s.status === "concluida")
    .sort((a, b) => b.iniciadaEm.localeCompare(a.iniciadaEm))
    .slice(0, n);
}

export function duracaoRealMin(s: SessaoTreino): number | null {
  if (!s.finalizadaEm) return null;
  return Math.max(1, Math.round((Date.parse(s.finalizadaEm) - Date.parse(s.iniciadaEm)) / 60000));
}

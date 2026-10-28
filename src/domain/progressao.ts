// Progressão de carga por "dupla progressão": primeiro sobem as repetições dentro da faixa,
// depois a carga. Usada pelo modo treino (etapa 8) a partir das séries registradas.

export interface SerieFeita {
  cargaKg: number;
  reps: number;
}

export interface Sugestao {
  acao: "subir" | "manter" | "reduzir" | "definir";
  /** carga sugerida para o próximo treino; null quando ainda não há referência */
  cargaKg: number | null;
  motivo: string;
}

/** Aumento de carga: maior em multiarticulares; nunca abaixo do menor anilha/halter usual. */
export function incremento(tipo: "composto" | "isolado", cargaAtual: number): number {
  const passo = tipo === "composto" ? 2.5 : 1;
  // ~5% em cargas altas, arredondado ao passo
  return Math.max(passo, Math.round((cargaAtual * 0.05) / passo) * passo);
}

const arredondar = (kg: number, passo: number) => Math.round(kg / passo) * passo;

/**
 * - Todas as séries no topo da faixa → sobe a carga e volta para o início da faixa.
 * - Alguma série abaixo do mínimo da faixa → reduz ~10%.
 * - Caso contrário → mantém a carga e tenta 1 repetição a mais.
 * Usa a carga mais comum das séries (ignora aquecimento mais leve).
 */
export function sugerirProximaCarga(faixa: { repsMin: number; repsMax: number }, tipo: "composto" | "isolado", series: readonly SerieFeita[]): Sugestao {
  const validas = series.filter((s) => s.reps > 0 && s.cargaKg >= 0);
  if (!validas.length) return { acao: "definir", cargaKg: null, motivo: "Escolha uma carga que permita terminar a série com técnica boa e 1 a 3 repetições de sobra." };

  const carga = Math.max(...validas.map((s) => s.cargaKg));
  const deTrabalho = validas.filter((s) => s.cargaKg === carga);
  const passo = tipo === "composto" ? 2.5 : 1;

  if (deTrabalho.every((s) => s.reps >= faixa.repsMax)) {
    const nova = carga + incremento(tipo, carga);
    return { acao: "subir", cargaKg: nova, motivo: `Você fez ${faixa.repsMax} repetições em todas as séries. Suba para ${nova} kg e volte para ${faixa.repsMin} repetições.` };
  }
  if (deTrabalho.some((s) => s.reps < faixa.repsMin)) {
    const nova = Math.max(0, arredondar(carga * 0.9, passo));
    return { acao: "reduzir", cargaKg: nova, motivo: `Alguma série ficou abaixo de ${faixa.repsMin} repetições. Use ${nova} kg para treinar na faixa com boa técnica.` };
  }
  return { acao: "manter", cargaKg: carga, motivo: `Mantenha ${carga} kg e tente 1 repetição a mais por série até chegar a ${faixa.repsMax}.` };
}

// Escala "bonita" para o eixo Y: poucos valores redondos que cobrem os dados.

export interface Escala {
  min: number;
  max: number;
  ticks: number[];
}

function passoBonito(bruto: number): number {
  const exp = Math.floor(Math.log10(bruto));
  const base = 10 ** exp;
  const f = bruto / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
}

/**
 * @param zero inclui o zero (barras sempre começam no zero; linhas de peso não precisam)
 */
export function escalaY(valores: readonly number[], opcoes: { zero?: boolean; nTicks?: number } = {}): Escala {
  const n = opcoes.nTicks ?? 4;
  if (!valores.length) return { min: 0, max: 1, ticks: [0, 1] };
  let lo = Math.min(...valores);
  let hi = Math.max(...valores);
  if (opcoes.zero) lo = Math.min(0, lo);
  if (lo === hi) {
    // valor único: abre uma faixa ao redor
    const folga = Math.abs(lo) * 0.05 || 1;
    lo -= opcoes.zero && lo >= 0 ? 0 : folga;
    hi += folga;
  }
  const passo = passoBonito((hi - lo) / (n - 1));
  const min = Math.floor(lo / passo) * passo;
  const max = Math.ceil(hi / passo) * passo;
  const ticks: number[] = [];
  for (let v = min; v <= max + passo / 2; v += passo) ticks.push(Math.round(v * 1000) / 1000);
  return { min, max, ticks };
}

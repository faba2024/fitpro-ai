// Evolução: recortes por período, comparação com o período anterior e séries para os gráficos.
import { chaveDia, inicioDaSemana, inicioDoDia, somarDias } from "./datas";
import type { SerieFeita } from "./progressao";
import { CAMPOS_MEDIDA, type CampoMedida, type Medida, type SessaoTreino } from "./tipos";

export const PERIODOS = { 30: "30 dias", 90: "90 dias", 365: "12 meses", 0: "Tudo" } as const;
export type Periodo = keyof typeof PERIODOS;

export interface Intervalo {
  /** null = desde o começo */
  inicio: Date | null;
  /** exclusivo: começo do dia seguinte a hoje */
  fim: Date;
}

export function intervalo(periodo: Periodo, hoje: Date): Intervalo {
  const fim = somarDias(inicioDoDia(hoje), 1);
  return { inicio: periodo === 0 ? null : somarDias(fim, -periodo), fim };
}

/** O período imediatamente anterior, de mesmo tamanho (não existe para "Tudo"). */
export function intervaloAnterior(periodo: Periodo, hoje: Date): Intervalo | null {
  if (periodo === 0) return null;
  const atual = intervalo(periodo, hoje);
  return { inicio: somarDias(atual.inicio!, -periodo), fim: atual.inicio! };
}

const dentro = (d: Date, i: Intervalo) => (!i.inicio || d >= i.inicio) && d < i.fim;
/** "AAAA-MM-DD" como data local (evita o deslocamento de fuso do Date.parse). */
export const dataLocal = (aaaammdd: string) => {
  const [a, m, d] = aaaammdd.split("-").map(Number) as [number, number, number];
  return new Date(a, m - 1, d);
};

const concluidas = (sessoes: readonly SessaoTreino[]) => sessoes.filter((s) => s.status === "concluida");

export interface NumerosPeriodo {
  treinos: number;
  series: number;
  volumeKg: number;
  /** treinos por semana, em média no período */
  mediaSemanal: number;
}

function numeros(sessoes: readonly SessaoTreino[], i: Intervalo, hoje: Date): NumerosPeriodo {
  const lista = concluidas(sessoes).filter((s) => dentro(new Date(s.iniciadaEm), i));
  const primeira = lista.reduce<Date | null>((m, s) => {
    const d = new Date(s.iniciadaEm);
    return !m || d < m ? d : m;
  }, null);
  // em "Tudo", a média conta a partir do primeiro treino
  const inicio = i.inicio ?? primeira ?? inicioDoDia(hoje);
  const semanas = Math.max(1, (i.fim.getTime() - inicio.getTime()) / (7 * 86400000));
  return {
    treinos: lista.length,
    series: lista.reduce((t, s) => t + s.seriesConcluidas, 0),
    volumeKg: Math.round(lista.reduce((t, s) => t + s.volumeKg, 0)),
    mediaSemanal: Math.round((lista.length / semanas) * 10) / 10,
  };
}

/** Peso mais recente dentro do intervalo (ou antes dele, para servir de referência). */
function pesoEm(medidas: readonly Medida[], ate: Date): number | null {
  const antes = medidas.filter((m) => m.pesoKg != null && dataLocal(m.data) < ate).sort((a, b) => b.data.localeCompare(a.data));
  return antes[0]?.pesoKg ?? null;
}

export interface Comparacao {
  atual: NumerosPeriodo;
  anterior: NumerosPeriodo | null;
  /** variação de peso dentro do período (último menos o primeiro registro) */
  pesoVariacaoKg: number | null;
}

export function compararPeriodos(sessoes: readonly SessaoTreino[], medidas: readonly Medida[], periodo: Periodo, hoje: Date): Comparacao {
  const i = intervalo(periodo, hoje);
  const ant = intervaloAnterior(periodo, hoje);
  const pesos = medidas.filter((m) => m.pesoKg != null && dentro(dataLocal(m.data), i)).sort((a, b) => a.data.localeCompare(b.data));
  // referência: o último peso antes do período, ou o primeiro dentro dele
  const inicial = (i.inicio ? pesoEm(medidas, i.inicio) : null) ?? pesos[0]?.pesoKg ?? null;
  const final = pesos.at(-1)?.pesoKg ?? null;
  return {
    atual: numeros(sessoes, i, hoje),
    anterior: ant ? numeros(sessoes, ant, hoje) : null,
    pesoVariacaoKg: inicial != null && final != null && pesos.length ? Math.round((final - inicial) * 10) / 10 : null,
  };
}

export interface PontoSemana {
  inicio: Date;
  rotulo: string;
  treinos: number;
  volumeKg: number;
}

/** Últimas `n` semanas (segunda a domingo), da mais antiga para a atual. */
export function semanas(sessoes: readonly SessaoTreino[], hoje: Date, n: number): PontoSemana[] {
  const atual = inicioDaSemana(hoje);
  const lista = concluidas(sessoes);
  return Array.from({ length: n }, (_, k) => {
    const inicio = somarDias(atual, -7 * (n - 1 - k));
    const fim = somarDias(inicio, 7);
    const daSemana = lista.filter((s) => {
      const d = new Date(s.iniciadaEm);
      return d >= inicio && d < fim;
    });
    return {
      inicio,
      rotulo: `${String(inicio.getDate()).padStart(2, "0")}/${String(inicio.getMonth() + 1).padStart(2, "0")}`,
      treinos: daSemana.length,
      volumeKg: Math.round(daSemana.reduce((t, s) => t + s.volumeKg, 0)),
    };
  });
}

export interface Ponto {
  data: string;
  valor: number;
}

/** Série de uma medida no intervalo, em ordem de data, sem dias repetidos (fica o último registro). */
export function serieMedida(medidas: readonly Medida[], campo: "pesoKg" | CampoMedida, i: Intervalo): Ponto[] {
  const porDia = new Map<string, number>();
  for (const m of [...medidas].sort((a, b) => a.data.localeCompare(b.data))) {
    const v = m[campo];
    if (v != null && dentro(dataLocal(m.data), i)) porDia.set(m.data, v);
  }
  return [...porDia].map(([data, valor]) => ({ data, valor }));
}

export interface PontoCarga {
  data: string;
  cargaMaxKg: number;
  repsNaCargaMax: number;
  volumeKg: number;
}

/** Progresso de um exercício: maior carga de cada treino (da mais antiga para a mais recente). */
export function progressoCarga(registros: readonly { data: string; series: readonly SerieFeita[] }[]): PontoCarga[] {
  return registros
    .filter((r) => r.series.length)
    .map((r) => {
      const max = r.series.reduce((a, b) => (b.cargaKg > a.cargaKg || (b.cargaKg === a.cargaKg && b.reps > a.reps) ? b : a));
      return {
        data: chaveDia(new Date(r.data)),
        cargaMaxKg: max.cargaKg,
        repsNaCargaMax: max.reps,
        volumeKg: Math.round(r.series.reduce((t, x) => t + x.cargaKg * x.reps, 0)),
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data));
}

export type FormMedida = { data: string } & Record<"pesoKg" | CampoMedida, string>;
export type ErrosMedida = Partial<Record<keyof FormMedida | "geral", string>>;

const CAMPOS_NUM = { pesoKg: { rotulo: "Peso", unidade: "kg", min: 30, max: 300 }, ...CAMPOS_MEDIDA } as const;

const num = (v: string) => (v.trim() === "" ? null : Number(v.trim().replace(",", ".")));

/** Valida o formulário de medidas: data até hoje, valores dentro das faixas, ao menos um preenchido. */
export function validarMedida(f: FormMedida, hoje: Date): ErrosMedida {
  const e: ErrosMedida = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) e.data = "Informe a data.";
  else if (dataLocal(f.data) > inicioDoDia(hoje)) e.data = "A data não pode ser no futuro.";
  let algum = false;
  for (const [campo, def] of Object.entries(CAMPOS_NUM) as [keyof typeof CAMPOS_NUM, (typeof CAMPOS_NUM)[keyof typeof CAMPOS_NUM]][]) {
    const v = num(f[campo]);
    if (v == null) continue;
    algum = true;
    if (!Number.isFinite(v) || v < def.min || v > def.max) e[campo] = `Entre ${def.min} e ${def.max} ${def.unidade}.`;
  }
  if (!algum) e.geral = "Preencha pelo menos uma medida.";
  return e;
}

export function paraMedida(f: FormMedida): Medida {
  const m: Medida = { data: f.data, pesoKg: num(f.pesoKg) };
  for (const c of Object.keys(CAMPOS_MEDIDA) as CampoMedida[]) m[c] = num(f[c]);
  return m;
}

/** Diferença percentual arredondada; null sem base de comparação. */
export function variacaoPct(atual: number, anterior: number | null | undefined): number | null {
  if (anterior == null || anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

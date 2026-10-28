// Modo treino: estado da sessão em andamento e operações puras (cada uma devolve um estado novo).
// O tempo entra como parâmetro (`agora`) para o cronômetro sobreviver a recarregar a página
// e para os testes serem determinísticos.
import { sugerirProximaCarga, type SerieFeita, type Sugestao } from "./progressao";
import type { PlanoSessao, SessaoTreino } from "./tipos";

export interface SerieRegistro {
  id: string;
  cargaKg: number | null;
  /** repetições feitas (ou segundos, em isometria) */
  reps: number | null;
  feita: boolean;
  feitaEm: string | null;
}

export interface ExercicioSessao {
  exercicioId: string;
  nome: string;
  tipo: "composto" | "isolado";
  porTempo: boolean;
  alvo: { series: number; repsMin: number; repsMax: number; descansoS: number };
  /** sugestão de carga calculada do treino anterior */
  sugestao: Sugestao | null;
  series: SerieRegistro[];
  pulado: boolean;
}

export interface SessaoAtiva {
  id: string;
  planoId: string | null;
  planoSessaoId: string;
  letra: string;
  titulo: string;
  status: "em_andamento" | "concluida" | "abandonada";
  iniciadaEm: string;
  finalizadaEm: string | null;
  /** quando pausada, o instante da pausa */
  pausadaEm: string | null;
  /** soma das pausas já encerradas */
  pausaMs: number;
  atual: number;
  descanso: { inicio: string; fim: string } | null;
  exercicios: ExercicioSessao[];
  atualizadoEm: string;
}

/** Histórico resumido de um exercício para sugerir carga e detectar recordes. */
export interface HistoricoExercicio {
  /** séries do último treino em que o exercício foi feito */
  ultimas: SerieFeita[];
  /** maior carga já registrada (kg) */
  maxCargaKg: number | null;
}

const ms = (iso: string) => Date.parse(iso);
const iso = (t: number) => new Date(t).toISOString();

const tocar = (s: SessaoAtiva, agora: number, mud: Partial<SessaoAtiva>): SessaoAtiva => ({ ...s, ...mud, atualizadoEm: iso(agora) });

const noExercicio = (s: SessaoAtiva, ei: number, f: (e: ExercicioSessao) => ExercicioSessao) => s.exercicios.map((e, i) => (i === ei ? f(e) : e));

export function iniciarSessao(args: {
  sessao: PlanoSessao;
  planoId: string | null;
  tipoDe: (exercicioId: string) => "composto" | "isolado";
  historico: Readonly<Record<string, HistoricoExercicio>>;
  agora: number;
  novoId: () => string;
}): SessaoAtiva {
  const { sessao, agora, novoId } = args;
  return {
    id: novoId(),
    planoId: args.planoId,
    planoSessaoId: sessao.id,
    letra: sessao.nome,
    titulo: sessao.titulo,
    status: "em_andamento",
    iniciadaEm: iso(agora),
    finalizadaEm: null,
    pausadaEm: null,
    pausaMs: 0,
    atual: 0,
    descanso: null,
    atualizadoEm: iso(agora),
    exercicios: sessao.itens.map((it) => {
      const tipo = args.tipoDe(it.exercicioId);
      const hist = args.historico[it.exercicioId];
      const sugestao = hist?.ultimas.length && !it.porTempo ? sugerirProximaCarga(it, tipo, hist.ultimas) : null;
      const carga = sugestao?.cargaKg ?? it.cargaKg ?? null;
      return {
        exercicioId: it.exercicioId,
        nome: it.nome,
        tipo,
        porTempo: !!it.porTempo,
        alvo: { series: it.series, repsMin: it.repsMin, repsMax: it.repsMax, descansoS: it.descansoS },
        sugestao,
        pulado: false,
        series: Array.from({ length: it.series }, () => ({ id: novoId(), cargaKg: it.porTempo ? null : carga, reps: null, feita: false, feitaEm: null })),
      };
    }),
  };
}

export function atualizarSerie(s: SessaoAtiva, ei: number, si: number, mud: Partial<Pick<SerieRegistro, "cargaKg" | "reps">>, agora: number): SessaoAtiva {
  return tocar(s, agora, {
    exercicios: noExercicio(s, ei, (e) => ({ ...e, series: e.series.map((x, i) => (i === si ? { ...x, ...mud } : x)) })),
  });
}

/** Erro que impede concluir a série, ou null. */
export function validarSerie(serie: SerieRegistro, porTempo: boolean): string | null {
  if (serie.reps == null || !Number.isInteger(serie.reps) || serie.reps < 1) return porTempo ? "Informe os segundos." : "Informe as repetições.";
  if (serie.reps > (porTempo ? 3600 : 200)) return "Valor alto demais.";
  if (serie.cargaKg != null && (!Number.isFinite(serie.cargaKg) || serie.cargaKg < 0 || serie.cargaKg > 1000)) return "Carga inválida.";
  return null;
}

const exercicioCompleto = (e: ExercicioSessao) => e.pulado || e.series.every((x) => x.feita);

/** Próximo exercício não concluído a partir de `de` (dando a volta); -1 se todos concluídos. */
function proximoPendente(exs: ExercicioSessao[], de: number): number {
  for (let k = 0; k < exs.length; k++) {
    const i = (de + k) % exs.length;
    if (!exercicioCompleto(exs[i]!)) return i;
  }
  return -1;
}

/** Marca a série como feita, inicia o descanso e avança quando o exercício termina. */
export function concluirSerie(s: SessaoAtiva, ei: number, si: number, agora: number): SessaoAtiva {
  const ex = s.exercicios[ei];
  const serie = ex?.series[si];
  if (!ex || !serie || serie.feita || validarSerie(serie, ex.porTempo)) return s;
  const exercicios = noExercicio(s, ei, (e) => ({ ...e, series: e.series.map((x, i) => (i === si ? { ...x, feita: true, feitaEm: iso(agora) } : x)) }));
  const prox = exercicioCompleto(exercicios[ei]!) ? proximoPendente(exercicios, ei + 1) : ei;
  const acabou = prox === -1;
  // a próxima série herda a carga, se ainda estiver vazia
  const comCarga = exercicios.map((e, i) =>
    i === ei ? { ...e, series: e.series.map((x, j) => (j === si + 1 && !x.feita && x.cargaKg == null ? { ...x, cargaKg: serie.cargaKg } : x)) } : e,
  );
  return tocar(s, agora, {
    exercicios: comCarga,
    atual: acabou ? ei : prox,
    descanso: acabou || ex.alvo.descansoS <= 0 ? null : { inicio: iso(agora), fim: iso(agora + ex.alvo.descansoS * 1000) },
  });
}

export function desfazerSerie(s: SessaoAtiva, ei: number, si: number, agora: number): SessaoAtiva {
  return tocar(s, agora, {
    exercicios: noExercicio(s, ei, (e) => ({ ...e, pulado: false, series: e.series.map((x, i) => (i === si ? { ...x, feita: false, feitaEm: null } : x)) })),
    atual: ei,
  });
}

export function adicionarSerie(s: SessaoAtiva, ei: number, novoId: () => string, agora: number): SessaoAtiva {
  return tocar(s, agora, {
    exercicios: noExercicio(s, ei, (e) => ({
      ...e,
      pulado: false,
      series: [...e.series, { id: novoId(), cargaKg: e.series.at(-1)?.cargaKg ?? null, reps: null, feita: false, feitaEm: null }],
    })),
  });
}

/** Remove a última série se ainda não foi feita (mantém ao menos uma). */
export function removerSerie(s: SessaoAtiva, ei: number, agora: number): SessaoAtiva {
  const e = s.exercicios[ei];
  if (!e || e.series.length <= 1 || e.series.at(-1)!.feita) return s;
  return tocar(s, agora, { exercicios: noExercicio(s, ei, (x) => ({ ...x, series: x.series.slice(0, -1) })) });
}

export const irPara = (s: SessaoAtiva, ei: number, agora: number): SessaoAtiva =>
  ei >= 0 && ei < s.exercicios.length ? tocar(s, agora, { atual: ei }) : s;

export function pularExercicio(s: SessaoAtiva, ei: number, agora: number): SessaoAtiva {
  const exercicios = noExercicio(s, ei, (e) => ({ ...e, pulado: true }));
  const prox = proximoPendente(exercicios, ei + 1);
  return tocar(s, agora, { exercicios, atual: prox === -1 ? ei : prox, descanso: null });
}

/** Troca o exercício (só se nenhuma série dele foi feita). */
export function trocarNaSessao(s: SessaoAtiva, ei: number, novo: Pick<ExercicioSessao, "exercicioId" | "nome" | "tipo" | "porTempo" | "alvo">, novoId: () => string, agora: number): SessaoAtiva {
  const e = s.exercicios[ei];
  if (!e || e.series.some((x) => x.feita)) return s;
  return tocar(s, agora, {
    exercicios: noExercicio(s, ei, () => ({
      ...novo,
      sugestao: null,
      pulado: false,
      series: Array.from({ length: novo.alvo.series }, () => ({ id: novoId(), cargaKg: null, reps: null, feita: false, feitaEm: null })),
    })),
  });
}

export function pausar(s: SessaoAtiva, agora: number): SessaoAtiva {
  return s.pausadaEm || s.status !== "em_andamento" ? s : tocar(s, agora, { pausadaEm: iso(agora) });
}

/** Retoma: soma a pausa e empurra o fim do descanso pelo mesmo tempo. */
export function retomar(s: SessaoAtiva, agora: number): SessaoAtiva {
  if (!s.pausadaEm) return s;
  const pausa = Math.max(0, agora - ms(s.pausadaEm));
  return tocar(s, agora, {
    pausadaEm: null,
    pausaMs: s.pausaMs + pausa,
    descanso: s.descanso ? { inicio: s.descanso.inicio, fim: iso(ms(s.descanso.fim) + pausa) } : null,
  });
}

export const pularDescanso = (s: SessaoAtiva, agora: number): SessaoAtiva => (s.descanso ? tocar(s, agora, { descanso: null }) : s);

export function ajustarDescanso(s: SessaoAtiva, deltaS: number, agora: number): SessaoAtiva {
  if (!s.descanso) return s;
  const fim = Math.max(agora, ms(s.descanso.fim) + deltaS * 1000);
  return tocar(s, agora, { descanso: { ...s.descanso, fim: iso(fim) } });
}

/** Encerra: "concluida" se houve alguma série feita, senão "abandonada". */
export function encerrar(s: SessaoAtiva, agora: number): SessaoAtiva {
  const base = s.pausadaEm ? retomar(s, agora) : s;
  const algumaFeita = base.exercicios.some((e) => e.series.some((x) => x.feita));
  return tocar(base, agora, { status: algumaFeita ? "concluida" : "abandonada", finalizadaEm: iso(agora), descanso: null });
}

// ───────────────────────── derivados ─────────────────────────

/** Tempo de treino sem contar pausas. */
export function tempoAtivoMs(s: SessaoAtiva, agora: number): number {
  const fim = s.finalizadaEm ? ms(s.finalizadaEm) : s.pausadaEm ? ms(s.pausadaEm) : agora;
  return Math.max(0, fim - ms(s.iniciadaEm) - s.pausaMs);
}

/** Descanso restante (congela durante a pausa); 0 sem descanso. */
export function descansoRestanteMs(s: SessaoAtiva, agora: number): number {
  if (!s.descanso) return 0;
  const ref = s.pausadaEm ? ms(s.pausadaEm) : agora;
  return Math.max(0, ms(s.descanso.fim) - ref);
}

export function progresso(s: SessaoAtiva) {
  const series = s.exercicios.flatMap((e) => e.series);
  return {
    seriesFeitas: series.filter((x) => x.feita).length,
    seriesTotal: series.length,
    exerciciosConcluidos: s.exercicios.filter(exercicioCompleto).length,
    exerciciosTotal: s.exercicios.length,
  };
}

const volumeSerie = (x: SerieRegistro, porTempo: boolean) => (x.feita && !porTempo && x.cargaKg && x.reps ? x.cargaKg * x.reps : 0);

export function volumeKg(s: SessaoAtiva): number {
  return Math.round(s.exercicios.reduce((t, e) => t + e.series.reduce((u, x) => u + volumeSerie(x, e.porTempo), 0), 0) * 10) / 10;
}

export interface ResumoExercicio {
  exercicioId: string;
  nome: string;
  seriesFeitas: number;
  melhor: SerieFeita | null;
  recorde: boolean;
  proxima: Sugestao | null;
}

export interface ResumoSessao {
  duracaoMin: number;
  seriesFeitas: number;
  volumeKg: number;
  exercicios: ResumoExercicio[];
  recordes: number;
}

export function resumoSessao(s: SessaoAtiva, historico: Readonly<Record<string, HistoricoExercicio>>, agora: number): ResumoSessao {
  const exercicios = s.exercicios
    .map((e): ResumoExercicio => {
      const feitas = e.series.filter((x) => x.feita && x.reps != null).map((x) => ({ cargaKg: x.cargaKg ?? 0, reps: x.reps! }));
      const melhor = feitas.length ? feitas.reduce((a, b) => (b.cargaKg > a.cargaKg || (b.cargaKg === a.cargaKg && b.reps > a.reps) ? b : a)) : null;
      const anterior = historico[e.exercicioId]?.maxCargaKg ?? null;
      return {
        exercicioId: e.exercicioId,
        nome: e.nome,
        seriesFeitas: feitas.length,
        melhor,
        recorde: !!melhor && !e.porTempo && melhor.cargaKg > 0 && (anterior == null ? false : melhor.cargaKg > anterior),
        proxima: feitas.length && !e.porTempo ? sugerirProximaCarga(e.alvo, e.tipo, feitas) : null,
      };
    })
    .filter((r) => r.seriesFeitas > 0);
  return {
    duracaoMin: Math.max(1, Math.round(tempoAtivoMs(s, agora) / 60000)),
    seriesFeitas: progresso(s).seriesFeitas,
    volumeKg: volumeKg(s),
    exercicios,
    recordes: exercicios.filter((e) => e.recorde).length,
  };
}

/** Linha de histórico (para dashboard e semana). */
export function paraSessaoTreino(s: SessaoAtiva): SessaoTreino {
  return {
    id: s.id,
    planoSessaoId: s.planoSessaoId,
    titulo: s.titulo,
    status: s.status,
    iniciadaEm: s.iniciadaEm,
    finalizadaEm: s.finalizadaEm,
    seriesConcluidas: progresso(s).seriesFeitas,
    volumeKg: volumeKg(s),
  };
}

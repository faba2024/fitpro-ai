import type { SerieFeita } from "@/domain/progressao";
import type { HistoricoExercicio, SessaoAtiva } from "@/domain/sessao";
import type { DadosUsuario, Plano } from "@/domain/tipos";

/**
 * Acesso a dados do usuário. As telas só conhecem esta interface;
 * LocalRepositorio (navegador) e SupabaseRepositorio (conta na nuvem) a implementam.
 */
export interface Repositorio {
  /** "local" = dados só neste navegador; "nuvem" = Supabase com login */
  readonly modo: "local" | "nuvem";
  carregar(): Promise<DadosUsuario>;
  /** ids dos exercícios favoritos */
  favoritos(): Promise<string[]>;
  definirFavorito(exercicioId: string, favorito: boolean): Promise<void>;
  /** grava a ficha e a torna a ativa (as anteriores ficam no histórico) */
  salvarPlano(plano: Plano): Promise<void>;
  /** grava a sessão e as séries feitas; idempotente (pode ser chamada várias vezes) */
  salvarSessao(sessao: SessaoAtiva): Promise<void>;
  /** últimas séries e maior carga de cada exercício, para sugerir carga e achar recordes */
  historico(exercicioIds: string[]): Promise<Record<string, HistoricoExercicio>>;
  /** treinos recentes com este exercício (mais recente primeiro) */
  historicoExercicio(exercicioId: string, limite?: number): Promise<RegistroExercicio[]>;
}

export interface RegistroExercicio {
  sessaoId: string;
  /** ISO da primeira série do dia */
  data: string;
  series: SerieFeita[];
}

/** Agrupa séries (mais recentes primeiro) por sessão, preservando a ordem. */
export function agruparPorSessao(linhas: { sessaoId: string; concluidaEm: string; cargaKg: number | null; reps: number; ordem: number }[], limite: number): RegistroExercicio[] {
  const mapa = new Map<string, RegistroExercicio & { ordens: number[] }>();
  for (const l of linhas) {
    const r = mapa.get(l.sessaoId) ?? { sessaoId: l.sessaoId, data: l.concluidaEm, series: [], ordens: [] };
    r.series.push({ cargaKg: l.cargaKg ?? 0, reps: l.reps });
    r.ordens.push(l.ordem);
    if (l.concluidaEm < r.data) r.data = l.concluidaEm;
    mapa.set(l.sessaoId, r);
  }
  return [...mapa.values()].slice(0, limite).map(({ ordens, ...r }) => ({
    ...r,
    series: r.series.map((x, i) => ({ x, o: ordens[i]! })).sort((a, b) => a.o - b.o).map((y) => y.x),
  }));
}

/** Monta o histórico resumido a partir das séries mais recentes e dos recordes. */
export function montarHistorico(ids: string[], porId: Record<string, RegistroExercicio[]>, recordes: Record<string, number>): Record<string, HistoricoExercicio> {
  return Object.fromEntries(ids.map((id) => [id, { ultimas: porId[id]?.[0]?.series ?? [], maxCargaKg: recordes[id] ?? null }]));
}

export const DADOS_VAZIOS: DadosUsuario = { perfil: null, perfilCompleto: null, plano: null, sessoes: [], medidas: [] };

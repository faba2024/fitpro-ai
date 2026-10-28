// Treino em andamento e fila de sincronização guardados no aparelho, separados por conta.
// Gravação síncrona a cada toque: fechar ou recarregar a página não perde nada.
import type { HistoricoExercicio, ResumoSessao, SessaoAtiva } from "@/domain/sessao";

export interface TreinoGuardado {
  sessao: SessaoAtiva;
  /** histórico antes do treino (para sugestões e recordes no resumo) */
  historico: Record<string, HistoricoExercicio>;
}

export interface ResultadoGuardado {
  sessao: SessaoAtiva;
  resumo: ResumoSessao;
}

const chave = (tipo: string, dono: string) => `fitpro:${tipo}:${dono}`;

function ler<T>(k: string, valido: (v: unknown) => v is T): T | null {
  try {
    const bruto = localStorage.getItem(k);
    if (!bruto) return null;
    const v = JSON.parse(bruto) as unknown;
    return valido(v) ? v : null;
  } catch {
    return null;
  }
}

/** true quando conseguiu gravar (modo privado ou cota cheia podem impedir). */
function gravar(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

function apagar(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {}
}

const ehSessao = (v: unknown): v is SessaoAtiva =>
  !!v && typeof v === "object" && typeof (v as SessaoAtiva).id === "string" && Array.isArray((v as SessaoAtiva).exercicios) && typeof (v as SessaoAtiva).iniciadaEm === "string";

const ehTreino = (v: unknown): v is TreinoGuardado => !!v && typeof v === "object" && ehSessao((v as TreinoGuardado).sessao);
const ehResultado = (v: unknown): v is ResultadoGuardado => !!v && typeof v === "object" && ehSessao((v as ResultadoGuardado).sessao) && !!(v as ResultadoGuardado).resumo;
const ehLista = (v: unknown): v is SessaoAtiva[] => Array.isArray(v) && v.every(ehSessao);

export const lerTreinoAtivo = (dono: string) => ler(chave("treino-ativo", dono), ehTreino);
export const gravarTreinoAtivo = (dono: string, t: TreinoGuardado) => gravar(chave("treino-ativo", dono), t);
export const limparTreinoAtivo = (dono: string) => apagar(chave("treino-ativo", dono));

export const lerResultado = (dono: string) => ler(chave("ultimo-resultado", dono), ehResultado);
export const gravarResultado = (dono: string, r: ResultadoGuardado) => gravar(chave("ultimo-resultado", dono), r);

/** Sessões finalizadas ainda não enviadas para a conta. */
export const lerPendentes = (dono: string) => ler(chave("sync-pendente", dono), ehLista) ?? [];

export function adicionarPendente(dono: string, s: SessaoAtiva) {
  gravar(chave("sync-pendente", dono), [...lerPendentes(dono).filter((x) => x.id !== s.id), s]);
}

export function removerPendente(dono: string, id: string) {
  const resto = lerPendentes(dono).filter((x) => x.id !== id);
  if (resto.length) gravar(chave("sync-pendente", dono), resto);
  else apagar(chave("sync-pendente", dono));
}

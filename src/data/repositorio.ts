import type { DadosUsuario } from "@/domain/tipos";

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
}

export const DADOS_VAZIOS: DadosUsuario = { perfil: null, perfilCompleto: null, plano: null, sessoes: [], medidas: [] };

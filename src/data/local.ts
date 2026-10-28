import type { DadosUsuario } from "@/domain/tipos";
import { gerarExemplo } from "./exemplo";
import { DADOS_VAZIOS, type Repositorio } from "./repositorio";

const CHAVE = "fitpro:dados:v1";
const CHAVE_FAVORITOS = "fitpro:favoritos:v1";

interface Armazenado extends DadosUsuario {
  exemplo: boolean;
}

/** Leitura tolerante: dado corrompido ou storage bloqueado viram "sem dados", nunca erro de tela. */
function ler(storage: Storage): Armazenado | null {
  try {
    const bruto = storage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<Armazenado>;
    if (!dados || !Array.isArray(dados.sessoes) || !Array.isArray(dados.medidas)) return null;
    return {
      perfil: dados.perfil ?? null,
      perfilCompleto: null,
      plano: dados.plano ?? null,
      sessoes: dados.sessoes,
      medidas: dados.medidas,
      exemplo: !!dados.exemplo,
    };
  } catch {
    return null;
  }
}

function gravar(storage: Storage, dados: Armazenado) {
  try {
    storage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    // modo privado / cota cheia: segue em memória nesta visita
  }
}

export class LocalRepositorio implements Repositorio {
  readonly modo = "local" as const;
  constructor(private storage: Storage = localStorage, private agora: () => Date = () => new Date()) {}

  /** Se os dados atuais são de exemplo (a interface mostra um aviso). */
  ehExemplo(): boolean {
    return ler(this.storage)?.exemplo ?? false;
  }

  async carregar(): Promise<DadosUsuario> {
    const d = ler(this.storage);
    return d ? { perfil: d.perfil, perfilCompleto: null, plano: d.plano, sessoes: d.sessoes, medidas: d.medidas } : DADOS_VAZIOS;
  }

  async carregarExemplo(): Promise<DadosUsuario> {
    const dados = gerarExemplo(this.agora());
    gravar(this.storage, { ...dados, exemplo: true });
    return dados;
  }

  async limpar(): Promise<DadosUsuario> {
    try {
      this.storage.removeItem(CHAVE);
      this.storage.removeItem(CHAVE_FAVORITOS);
    } catch {}
    return DADOS_VAZIOS;
  }

  async favoritos(): Promise<string[]> {
    try {
      const lista = JSON.parse(this.storage.getItem(CHAVE_FAVORITOS) ?? "[]") as unknown;
      return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  async definirFavorito(exercicioId: string, favorito: boolean): Promise<void> {
    const atual = new Set(await this.favoritos());
    if (favorito) atual.add(exercicioId);
    else atual.delete(exercicioId);
    try {
      this.storage.setItem(CHAVE_FAVORITOS, JSON.stringify([...atual]));
    } catch {}
  }
}

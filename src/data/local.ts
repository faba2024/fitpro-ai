import { paraSessaoTreino, type HistoricoExercicio, type SessaoAtiva } from "@/domain/sessao";
import type { DadosUsuario, Foto, Medida, Plano } from "@/domain/tipos";
import { gerarExemplo } from "./exemplo";
import { agruparPorSessao, DADOS_VAZIOS, montarHistorico, type RegistroExercicio, type Repositorio } from "./repositorio";

const CHAVE = "fitpro:dados:v1";
const CHAVE_FAVORITOS = "fitpro:favoritos:v1";
const CHAVE_SERIES = "fitpro:series:v1";

interface SerieLocal {
  id: string;
  sessaoId: string;
  exercicioId: string;
  ordem: number;
  cargaKg: number | null;
  reps: number;
  concluidaEm: string;
}

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
      this.storage.removeItem(CHAVE_SERIES);
    } catch {}
    return DADOS_VAZIOS;
  }

  private series(): SerieLocal[] {
    try {
      const l = JSON.parse(this.storage.getItem(CHAVE_SERIES) ?? "[]") as unknown;
      return Array.isArray(l) ? (l as SerieLocal[]) : [];
    } catch {
      return [];
    }
  }

  async salvarSessao(s: SessaoAtiva): Promise<void> {
    const feitas: SerieLocal[] = s.exercicios.flatMap((e) =>
      e.series
        .map((x, ordem) => ({ x, ordem }))
        .filter(({ x }) => x.feita && x.reps != null)
        .map(({ x, ordem }) => ({ id: x.id, sessaoId: s.id, exercicioId: e.exercicioId, ordem, cargaKg: x.cargaKg, reps: x.reps!, concluidaEm: x.feitaEm! })),
    );
    // substitui as séries desta sessão (séries desfeitas somem)
    const outras = this.series().filter((x) => x.sessaoId !== s.id);
    try {
      this.storage.setItem(CHAVE_SERIES, JSON.stringify([...outras, ...feitas]));
    } catch {}
    if (s.status === "em_andamento") return;
    const atual = ler(this.storage) ?? { ...DADOS_VAZIOS, exemplo: false };
    const resumo = paraSessaoTreino(s);
    gravar(this.storage, { ...atual, sessoes: [resumo, ...atual.sessoes.filter((x) => x.id !== s.id)] });
  }

  private registros(exercicioId: string): RegistroExercicio[] {
    const linhas = this.series()
      .filter((x) => x.exercicioId === exercicioId)
      .sort((a, b) => b.concluidaEm.localeCompare(a.concluidaEm));
    return agruparPorSessao(linhas, Number.POSITIVE_INFINITY);
  }

  async historico(ids: string[]): Promise<Record<string, HistoricoExercicio>> {
    const porId = Object.fromEntries(ids.map((id) => [id, this.registros(id)]));
    const recordes: Record<string, number> = {};
    for (const x of this.series()) if (ids.includes(x.exercicioId) && x.cargaKg != null) recordes[x.exercicioId] = Math.max(recordes[x.exercicioId] ?? 0, x.cargaKg);
    return montarHistorico(ids, porId, recordes);
  }

  async historicoExercicio(exercicioId: string, limite = 10): Promise<RegistroExercicio[]> {
    return this.registros(exercicioId).slice(0, limite);
  }

  async recordes(ids: string[]): Promise<Record<string, number>> {
    const r: Record<string, number> = {};
    for (const x of this.series()) if (ids.includes(x.exercicioId) && x.cargaKg != null) r[x.exercicioId] = Math.max(r[x.exercicioId] ?? 0, x.cargaKg);
    return r;
  }

  async salvarMedida(m: Medida): Promise<void> {
    const atual = ler(this.storage) ?? { ...DADOS_VAZIOS, exemplo: false };
    // um registro por dia: salvar de novo na mesma data substitui
    const nova = { ...m, id: m.id ?? `local-${m.data}` };
    gravar(this.storage, { ...atual, medidas: [...atual.medidas.filter((x) => x.data !== m.data), nova].sort((a, b) => a.data.localeCompare(b.data)) });
  }

  async excluirMedida(id: string): Promise<void> {
    const atual = ler(this.storage);
    if (atual) gravar(this.storage, { ...atual, medidas: atual.medidas.filter((x) => (x.id ?? `local-${x.data}`) !== id) });
  }

  readonly suportaFotos = false;
  async listarFotos(): Promise<Foto[]> {
    return [];
  }
  async enviarFoto(): Promise<void> {
    throw new Error("Fotos de evolução ficam disponíveis com uma conta, para ficarem protegidas e privadas.");
  }
  async excluirFoto(): Promise<void> {}

  async salvarPlano(plano: Plano): Promise<void> {
    const atual = ler(this.storage) ?? { ...DADOS_VAZIOS, exemplo: false };
    gravar(this.storage, { ...atual, plano });
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

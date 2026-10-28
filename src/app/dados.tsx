import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LocalRepositorio } from "@/data/local";
import { DADOS_VAZIOS, type Repositorio } from "@/data/repositorio";
import { SupabaseRepositorio } from "@/data/supabase";
import type { DadosUsuario, PerfilCompleto } from "@/domain/tipos";
import { useAuth } from "./auth";

type Estado = { status: "carregando" } | { status: "erro"; mensagem: string } | { status: "pronto"; dados: DadosUsuario };

interface Ctx {
  estado: Estado;
  modo: "local" | "nuvem";
  exemplo: boolean;
  recarregar: () => void;
  /** só no modo local */
  carregarExemplo: () => Promise<void>;
  /** só no modo local */
  limpar: () => Promise<void>;
  /** só com conta na nuvem */
  salvarPerfil: (p: PerfilCompleto) => Promise<void>;
  /** só com conta na nuvem; depois a sessão é encerrada */
  excluirConta: () => Promise<void>;
  favoritos: ReadonlySet<string>;
  /** atualiza na hora e desfaz se o servidor recusar (o erro é repassado) */
  alternarFavorito: (exercicioId: string) => Promise<void>;
}

const DadosCtx = createContext<Ctx | null>(null);

export function DadosProvider({ children, repositorio }: { children: ReactNode; repositorio?: Repositorio }) {
  const auth = useAuth();
  const userId = auth.estado.status === "logado" ? auth.estado.user.id : null;

  // repositório conforme o modo: injetado (testes), local (sem Supabase) ou da conta logada
  const repo = useMemo<Repositorio | null>(() => {
    if (repositorio) return repositorio;
    if (auth.estado.status === "desativado") return new LocalRepositorio();
    if (userId && auth.cliente) return new SupabaseRepositorio(auth.cliente, userId);
    return null;
  }, [repositorio, auth.estado.status, auth.cliente, userId]);

  const [estado, setEstado] = useState<Estado>({ status: "carregando" });
  const [exemplo, setExemplo] = useState(false);

  const executar = useCallback(
    async (acao: () => Promise<DadosUsuario>) => {
      try {
        const dados = await acao();
        setEstado({ status: "pronto", dados });
        setExemplo(repo instanceof LocalRepositorio && repo.ehExemplo());
      } catch (e) {
        setEstado({ status: "erro", mensagem: e instanceof Error ? e.message : "Não foi possível carregar seus dados." });
      }
    },
    [repo],
  );

  const recarregar = useCallback(() => {
    if (!repo) {
      // sem login ainda: nada para carregar
      setEstado(auth.estado.status === "carregando" ? { status: "carregando" } : { status: "pronto", dados: DADOS_VAZIOS });
      return;
    }
    setEstado({ status: "carregando" });
    void executar(() => repo.carregar());
  }, [executar, repo, auth.estado.status]);

  useEffect(recarregar, [recarregar]);

  const [favoritos, setFavoritos] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    setFavoritos(new Set());
    if (!repo) return;
    let vivo = true;
    repo
      .favoritos()
      .then((ids) => vivo && setFavoritos(new Set(ids)))
      .catch(() => {}); // sem favoritos não impede o uso; a próxima ação mostra o erro
    return () => {
      vivo = false;
    };
  }, [repo]);

  const alternarFavorito = useCallback(
    async (id: string) => {
      if (!repo) return;
      const marcar = !favoritos.has(id);
      const trocar = (sim: boolean) =>
        setFavoritos((atual) => {
          const novo = new Set(atual);
          if (sim) novo.add(id);
          else novo.delete(id);
          return novo;
        });
      trocar(marcar);
      try {
        await repo.definirFavorito(id, marcar);
      } catch (e) {
        trocar(!marcar);
        throw e;
      }
    },
    [repo, favoritos],
  );

  const valor: Ctx = {
    estado,
    modo: repo?.modo ?? (auth.estado.status === "desativado" ? "local" : "nuvem"),
    exemplo,
    recarregar,
    carregarExemplo: async () => {
      if (repo instanceof LocalRepositorio) await executar(() => repo.carregarExemplo());
    },
    limpar: async () => {
      if (repo instanceof LocalRepositorio) await executar(() => repo.limpar());
    },
    salvarPerfil: async (p) => {
      if (!(repo instanceof SupabaseRepositorio)) throw new Error("Entre na sua conta para salvar o perfil.");
      await repo.salvarPerfil(p);
      await executar(() => repo.carregar());
    },
    excluirConta: async () => {
      if (!(repo instanceof SupabaseRepositorio)) throw new Error("Entre na sua conta para excluí-la.");
      await repo.excluirConta();
      await auth.sair();
    },
    favoritos,
    alternarFavorito,
  };

  return <DadosCtx.Provider value={valor}>{children}</DadosCtx.Provider>;
}

export function useDados() {
  const ctx = useContext(DadosCtx);
  if (!ctx) throw new Error("useDados fora do DadosProvider");
  return ctx;
}

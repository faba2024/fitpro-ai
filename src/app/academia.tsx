import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SupabaseRepoAcademia, type RepoAcademia, type Vinculo } from "@/data/academia";
import { useAuth } from "./auth";

type EstadoVinculos = { status: "carregando" } | { status: "erro"; mensagem: string } | { status: "pronto"; lista: Vinculo[] };

interface Ctx {
  /** null no modo local: academias exigem conta */
  repo: RepoAcademia | null;
  vinculos: EstadoVinculos;
  recarregarVinculos: () => void;
}

const AcademiaCtx = createContext<Ctx>({ repo: null, vinculos: { status: "pronto", lista: [] }, recarregarVinculos: () => {} });

/** Vínculos da pessoa com academias (aluno, professor, admin) e o acesso aos dados dos painéis. */
export function AcademiaProvider({ children, repo: injetado }: { children: ReactNode; repo?: RepoAcademia }) {
  const auth = useAuth();
  const userId = auth.estado.status === "logado" ? auth.estado.user.id : null;
  const repo = useMemo<RepoAcademia | null>(() => {
    if (injetado) return injetado;
    return userId && auth.cliente ? new SupabaseRepoAcademia(auth.cliente, userId) : null;
  }, [injetado, userId, auth.cliente]);

  const [vinculos, setVinculos] = useState<EstadoVinculos>({ status: "carregando" });
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!repo) {
      setVinculos({ status: "pronto", lista: [] });
      return;
    }
    let vivo = true;
    setVinculos({ status: "carregando" });
    repo.minhasAcademias().then(
      (lista) => vivo && setVinculos({ status: "pronto", lista }),
      (e: unknown) => vivo && setVinculos({ status: "erro", mensagem: e instanceof Error ? e.message : "Não foi possível carregar suas academias." }),
    );
    return () => {
      vivo = false;
    };
  }, [repo, versao]);

  const recarregarVinculos = useCallback(() => setVersao((v) => v + 1), []);
  const valor = useMemo(() => ({ repo, vinculos, recarregarVinculos }), [repo, vinculos, recarregarVinculos]);
  return <AcademiaCtx.Provider value={valor}>{children}</AcademiaCtx.Provider>;
}

export const useAcademia = () => useContext(AcademiaCtx);

/** Vínculos ativos com um papel (ex.: academias em que a pessoa é professora). */
export function vinculosCom(v: EstadoVinculos, papel: Vinculo["papel"]): Vinculo[] {
  return v.status === "pronto" ? v.lista.filter((x) => x.papel === papel && x.ativo) : [];
}

/**
 * Carrega dados assíncronos de uma tela, com recarga. A função `f` deve ser estável
 * (useCallback) para não recarregar a cada render.
 */
export function useCarga<T>(f: (() => Promise<T>) | null) {
  const [estado, setEstado] = useState<{ status: "carregando" } | { status: "erro"; mensagem: string } | { status: "pronto"; dados: T }>({ status: "carregando" });
  const [versao, setVersao] = useState(0);
  const anterior = useRef(f);
  useEffect(() => {
    if (!f) return;
    let vivo = true;
    // recarga mantém os dados na tela; outra consulta (ex.: outro aluno) começa do zero
    if (anterior.current !== f) setEstado({ status: "carregando" });
    anterior.current = f;
    f().then(
      (dados) => vivo && setEstado({ status: "pronto", dados }),
      (e: unknown) => vivo && setEstado({ status: "erro", mensagem: e instanceof Error ? e.message : "Não foi possível carregar." }),
    );
    return () => {
      vivo = false;
    };
  }, [f, versao]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { estado, recarregar };
}

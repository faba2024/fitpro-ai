import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  adicionarPendente,
  gravarResultado,
  gravarTreinoAtivo,
  lerPendentes,
  lerResultado,
  lerTreinoAtivo,
  limparTreinoAtivo,
  removerPendente,
  type ResultadoGuardado,
  type TreinoGuardado,
} from "@/data/sessaoLocal";
import { encerrar, iniciarSessao, resumoSessao, type SessaoAtiva } from "@/domain/sessao";
import type { PlanoSessao } from "@/domain/tipos";
import { useAuth } from "./auth";
import { useDados } from "./dados";

export type StatusSync = "local" | "enviando" | "sincronizado" | "pendente" | "sem-armazenamento";

interface Ctx {
  treino: TreinoGuardado | null;
  sync: StatusSync;
  /** começa o treino de uma sessão da ficha (busca o histórico para sugerir carga) */
  iniciar: (sessao: PlanoSessao, planoId: string | null, tipoDe: (id: string) => "composto" | "isolado") => Promise<void>;
  /** aplica uma mudança: grava no aparelho na hora e sincroniza em seguida */
  atualizar: (f: (s: SessaoAtiva, agora: number) => SessaoAtiva) => void;
  /** encerra, gera o resumo e envia; o treino ativo sai do aparelho */
  finalizar: () => Promise<ResultadoGuardado | null>;
  /** descarta um treino sem nenhuma série feita */
  descartar: () => void;
  ultimoResultado: ResultadoGuardado | null;
}

const TreinoCtx = createContext<Ctx | null>(null);
const ESPERA_SYNC_MS = 1500;

export function TreinoProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { estado, historico, salvarSessao, recarregar } = useDados();
  const dono = auth.estado.status === "logado" ? auth.estado.user.id : auth.estado.status === "desativado" ? "local" : null;

  const [treino, setTreino] = useState<TreinoGuardado | null>(null);
  const [ultimoResultado, setUltimo] = useState<ResultadoGuardado | null>(null);
  const [sync, setSync] = useState<StatusSync>("local");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prontoParaSync = estado.status === "pronto";

  // recupera o treino em andamento e o último resultado ao abrir o app (ou trocar de conta)
  useEffect(() => {
    setTreino(dono ? lerTreinoAtivo(dono) : null);
    setUltimo(dono ? lerResultado(dono) : null);
  }, [dono]);

  const enviar = useCallback(
    async (s: SessaoAtiva) => {
      setSync("enviando");
      try {
        await salvarSessao(s);
        setSync("sincronizado");
        return true;
      } catch {
        setSync("pendente");
        return false;
      }
    },
    [salvarSessao],
  );

  // envia o que ficou pendente (sem internet antes) ao abrir e quando a conexão volta
  const enviarPendentes = useCallback(async () => {
    if (!dono || !prontoParaSync) return;
    let enviou = false;
    for (const s of lerPendentes(dono)) {
      if (await enviar(s)) {
        removerPendente(dono, s.id);
        enviou = true;
      }
    }
    if (enviou) recarregar();
  }, [dono, prontoParaSync, enviar, recarregar]);

  useEffect(() => {
    void enviarPendentes();
    window.addEventListener("online", enviarPendentes);
    return () => window.removeEventListener("online", enviarPendentes);
  }, [enviarPendentes]);

  const agendarSync = useCallback(
    (s: SessaoAtiva) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void enviar(s), ESPERA_SYNC_MS);
    },
    [enviar],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const guardar = useCallback(
    (t: TreinoGuardado) => {
      if (!dono) return;
      setSync(gravarTreinoAtivo(dono, t) ? "local" : "sem-armazenamento");
      setTreino(t);
    },
    [dono],
  );

  const valor = useMemo<Ctx>(
    () => ({
      treino,
      sync,
      ultimoResultado,
      async iniciar(sessao, planoId, tipoDe) {
        const ids = sessao.itens.map((i) => i.exercicioId);
        // sem histórico (ex.: sem internet) o treino começa assim mesmo, só sem sugestão
        const hist = await historico(ids).catch(() => ({}));
        const s = iniciarSessao({ sessao, planoId, tipoDe, historico: hist, agora: Date.now(), novoId: () => crypto.randomUUID() });
        guardar({ sessao: s, historico: hist });
        agendarSync(s);
      },
      atualizar(f) {
        setTreino((atual) => {
          if (!atual) return atual;
          const s = f(atual.sessao, Date.now());
          if (s === atual.sessao) return atual;
          const novo = { ...atual, sessao: s };
          if (dono) setSync(gravarTreinoAtivo(dono, novo) ? "local" : "sem-armazenamento");
          agendarSync(s);
          return novo;
        });
      },
      async finalizar() {
        if (!treino || !dono) return null;
        if (timer.current) clearTimeout(timer.current);
        const agora = Date.now();
        const s = encerrar(treino.sessao, agora);
        const resultado = { sessao: s, resumo: resumoSessao(s, treino.historico, agora) };
        // primeiro garante no aparelho, depois tenta enviar
        gravarResultado(dono, resultado);
        adicionarPendente(dono, s);
        limparTreinoAtivo(dono);
        setTreino(null);
        setUltimo(resultado);
        if (await enviar(s)) removerPendente(dono, s.id);
        recarregar();
        return resultado;
      },
      descartar() {
        if (!dono || !treino) return;
        if (timer.current) clearTimeout(timer.current);
        const s = encerrar(treino.sessao, Date.now());
        // sem séries não há o que guardar; se o início já tinha sido enviado, marca como abandonado
        adicionarPendente(dono, s);
        void enviar(s).then((ok) => ok && removerPendente(dono, s.id));
        limparTreinoAtivo(dono);
        setTreino(null);
      },
    }),
    [treino, sync, ultimoResultado, historico, guardar, agendarSync, dono, enviar, recarregar],
  );

  return <TreinoCtx.Provider value={valor}>{children}</TreinoCtx.Provider>;
}

export function useTreino() {
  const ctx = useContext(TreinoCtx);
  if (!ctx) throw new Error("useTreino fora do TreinoProvider");
  return ctx;
}

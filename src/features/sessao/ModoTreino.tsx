import { Check, ChevronLeft, ChevronRight, Cloud, CloudOff, Dumbbell, HardDrive, Minus, Pause, Play, Plus, Replace, RotateCcw, SkipForward, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useDados } from "@/app/dados";
import { useTreino, type StatusSync } from "@/app/treinoAtivo";
import { Badge, Button, ButtonLink, Card, EmptyState, ProgressBar } from "@/components/ui";
import { CATALOGO, EXERCICIOS } from "@/data/catalogo";
import { prescricaoDoExercicio } from "@/domain/exercicios";
import { parametrosDoPerfil, substitutos } from "@/domain/ficha";
import {
  adicionarSerie,
  ajustarDescanso,
  atualizarSerie,
  concluirSerie,
  descansoRestanteMs,
  desfazerSerie,
  irPara,
  pausar,
  progresso,
  pularDescanso,
  pularExercicio,
  removerSerie,
  retomar,
  tempoAtivoMs,
  trocarNaSessao,
  validarSerie,
  type ExercicioSessao,
  type SessaoAtiva,
} from "@/domain/sessao";
import { duracaoEstimadaMin, proximaSessao } from "@/domain/treino";
import { ImagemExercicio } from "@/features/exercicios/comuns";
import { Carregando } from "@/features/Estados";
import s from "./ModoTreino.module.css";

const tipoDe = (id: string) => CATALOGO.get(id)?.tipo ?? "isolado";
const novoId = () => crypto.randomUUID();

export function relogio(msTotal: number): string {
  const t = Math.max(0, Math.round(msTotal / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sg = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sg}` : `${m}:${sg}`;
}

export function ModoTreino() {
  const { treino } = useTreino();
  return treino ? <TreinoEmAndamento sessao={treino.sessao} /> : <EscolherTreino />;
}

// ───────────────────────── antes de começar ─────────────────────────

function EscolherTreino() {
  const { estado } = useDados();
  const { iniciar } = useTreino();
  const [params] = useSearchParams();
  const [iniciando, setIniciando] = useState(false);
  if (estado.status === "carregando") return <Carregando />;
  const dados = estado.status === "pronto" ? estado.dados : null;
  const plano = dados?.plano;

  if (!plano) {
    return (
      <Card>
        <EmptyState icone={<Dumbbell />} titulo="Você ainda não tem uma ficha" texto="Monte seu treino para começar a registrar as séries." acao={<ButtonLink to="/treino/novo">Montar meu treino</ButtonLink>} />
      </Card>
    );
  }

  const escolhida = plano.sessoes.find((x) => x.id === params.get("sessao")) ?? proximaSessao(plano, dados!.sessoes) ?? plano.sessoes[0]!;

  return (
    <div className={s.pagina}>
      <h1 className={s.titulo}>Começar treino</h1>
      <div className={s.chips} role="group" aria-label="Escolher treino">
        {plano.sessoes.map((x) => (
          <Link key={x.id} to={`/treino/sessao?sessao=${x.id}`} replace className={x.id === escolhida.id ? `${s.chip} ${s.chipAtivo}` : s.chip} aria-current={x.id === escolhida.id}>
            {x.nome} · {x.titulo}
          </Link>
        ))}
      </div>
      <Card titulo={`${escolhida.nome} · ${escolhida.titulo}`} acao={<span className={s.mini}>~{duracaoEstimadaMin(escolhida)} min</span>}>
        <ol className={s.previa}>
          {escolhida.itens.map((it, i) => (
            <li key={`${it.exercicioId}-${i}`}>
              <strong>{it.nome}</strong>
              <span>{it.series} × {it.repsMin}–{it.repsMax}{it.porTempo ? " s" : ""}</span>
            </li>
          ))}
        </ol>
      </Card>
      <p className={s.mini}>Tudo o que você registrar é salvo neste aparelho na hora e enviado para sua conta. Se fechar o app, o treino continua de onde parou.</p>
      <Button
        bloco
        icone={<Play />}
        disabled={iniciando}
        onClick={() => {
          setIniciando(true);
          void iniciar(escolhida, plano.id, tipoDe).finally(() => setIniciando(false));
        }}
      >
        {iniciando ? "Preparando…" : "Começar treino"}
      </Button>
    </div>
  );
}

// ───────────────────────── durante o treino ─────────────────────────

const TEXTO_SYNC: Record<StatusSync, { texto: string; icone: typeof Cloud }> = {
  local: { texto: "Salvo neste aparelho", icone: HardDrive },
  enviando: { texto: "Enviando…", icone: Cloud },
  sincronizado: { texto: "Salvo na sua conta", icone: Cloud },
  pendente: { texto: "Sem conexão: salvo no aparelho, envia depois", icone: CloudOff },
  "sem-armazenamento": { texto: "Não foi possível salvar no aparelho. Não feche o app.", icone: CloudOff },
};

function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(t);
  }, [ativo]);
  return agora;
}

/** Mantém a tela ligada durante o treino, quando o navegador permite. */
function useTelaLigada(ativo: boolean) {
  useEffect(() => {
    if (!ativo || !("wakeLock" in navigator)) return;
    let trava: WakeLockSentinel | null = null;
    const pedir = () => navigator.wakeLock.request("screen").then((t) => (trava = t)).catch(() => {});
    void pedir();
    const voltar = () => document.visibilityState === "visible" && void pedir();
    document.addEventListener("visibilitychange", voltar);
    return () => {
      document.removeEventListener("visibilitychange", voltar);
      void trava?.release().catch(() => {});
    };
  }, [ativo]);
}

function avisarFimDescanso() {
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.15, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => void ctx.close();
  } catch {}
}

function TreinoEmAndamento({ sessao }: { sessao: SessaoAtiva }) {
  const { atualizar, finalizar, descartar, sync } = useTreino();
  const { estado } = useDados();
  const navegar = useNavigate();
  const pausado = !!sessao.pausadaEm;
  const agora = useAgora(!pausado);
  const [encerrando, setEncerrando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  useTelaLigada(!pausado);

  const restante = descansoRestanteMs(sessao, agora);
  const avisou = useRef<string | null>(null);
  useEffect(() => {
    // descanso acabou: avisa uma vez e fecha o cronômetro
    if (sessao.descanso && !pausado && restante === 0 && avisou.current !== sessao.descanso.fim) {
      avisou.current = sessao.descanso.fim;
      avisarFimDescanso();
      atualizar(pularDescanso);
    }
  }, [restante, sessao.descanso, pausado, atualizar]);

  const prog = progresso(sessao);
  const tudoFeito = prog.exerciciosConcluidos === prog.exerciciosTotal;
  const algumaFeita = prog.seriesFeitas > 0;
  const ex = sessao.exercicios[sessao.atual]!;
  const dados = estado.status === "pronto" ? estado.dados : null;
  const params = dados ? (dados.plano?.parametros ?? parametrosDoPerfil(dados.perfilCompleto, dados.perfil)) : null;
  const Sync = TEXTO_SYNC[sync];

  async function concluir() {
    setFinalizando(true);
    const r = await finalizar();
    if (r) navegar("/treino/resumo", { replace: true });
  }

  return (
    <div className={s.pagina}>
      <header className={s.topo}>
        <div className={s.topoTexto}>
          <h1 className={s.titulo}>{sessao.letra} · {sessao.titulo}</h1>
          <p className={s.mini} aria-live="off">
            <span className={s.tempo}>{relogio(tempoAtivoMs(sessao, agora))}</span> · {prog.seriesFeitas}/{prog.seriesTotal} séries
          </p>
        </div>
        <button type="button" className={s.botaoRedondo} onClick={() => atualizar(pausado ? retomar : pausar)} aria-label={pausado ? "Retomar treino" : "Pausar treino"}>
          {pausado ? <Play /> : <Pause />}
        </button>
        <button type="button" className={s.botaoRedondo} onClick={() => setEncerrando(true)} aria-label="Encerrar treino">
          <Square />
        </button>
      </header>
      <ProgressBar valor={prog.seriesFeitas} max={prog.seriesTotal} rotulo="Séries concluídas" />
      <p className={sync === "pendente" || sync === "sem-armazenamento" ? `${s.sync} ${s.syncAlerta}` : s.sync}>
        <Sync.icone aria-hidden="true" /> {Sync.texto}
      </p>

      {encerrando && (
        <Card className={s.confirmar}>
          {algumaFeita ? (
            <>
              <p><b>Concluir o treino?</b> {tudoFeito ? "Todas as séries foram feitas." : `Faltam ${prog.seriesTotal - prog.seriesFeitas} séries; elas ficam como não feitas.`}</p>
              <div className={s.acoes}>
                <Button variante="secundario" onClick={() => setEncerrando(false)}>Continuar treinando</Button>
                <Button onClick={() => void concluir()} disabled={finalizando}>{finalizando ? "Salvando…" : "Concluir treino"}</Button>
              </div>
            </>
          ) : (
            <>
              <p><b>Descartar o treino?</b> Nenhuma série foi registrada.</p>
              <div className={s.acoes}>
                <Button variante="secundario" onClick={() => setEncerrando(false)}>Continuar</Button>
                <Button onClick={() => { descartar(); navegar("/treino", { replace: true }); }}>Descartar</Button>
              </div>
            </>
          )}
        </Card>
      )}

      <nav className={s.chips} aria-label="Exercícios do treino">
        {sessao.exercicios.map((e, i) => {
          const feitas = e.series.filter((x) => x.feita).length;
          const completo = e.pulado || feitas === e.series.length;
          return (
            <button key={i} type="button" className={[s.chip, i === sessao.atual && s.chipAtivo, completo && s.chipFeito].filter(Boolean).join(" ")} aria-current={i === sessao.atual} onClick={() => atualizar((x, t) => irPara(x, i, t))}>
              {completo && !e.pulado ? <Check aria-hidden="true" /> : null}
              {i + 1}. {e.nome}
              <span className="sr-only">{e.pulado ? " (pulado)" : completo ? " (concluído)" : ` (${feitas} de ${e.series.length})`}</span>
            </button>
          );
        })}
      </nav>

      <Exercicio key={`${sessao.atual}-${ex.exercicioId}`} ex={ex} ei={sessao.atual} sessao={sessao} params={params} />

      <div className={s.navegacao}>
        <Button variante="secundario" icone={<ChevronLeft />} disabled={sessao.atual === 0} onClick={() => atualizar((x, t) => irPara(x, sessao.atual - 1, t))}>Anterior</Button>
        {tudoFeito ? (
          <Button icone={<Check />} onClick={() => setEncerrando(true)}>Concluir treino</Button>
        ) : (
          <Button variante="secundario" disabled={sessao.atual === sessao.exercicios.length - 1} onClick={() => atualizar((x, t) => irPara(x, sessao.atual + 1, t))}>
            Próximo <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>

      {restante > 0 && !pausado && (
        <div className={s.descanso} role="timer" aria-live="polite" aria-label="Descanso">
          <span className={s.descansoRotulo}>Descanso</span>
          <span className={s.descansoTempo}>{relogio(restante)}</span>
          <div className={s.descansoBotoes}>
            <button type="button" onClick={() => atualizar((x, t) => ajustarDescanso(x, -15, t))} aria-label="Menos 15 segundos de descanso">−15 s</button>
            <button type="button" onClick={() => atualizar((x, t) => ajustarDescanso(x, 15, t))} aria-label="Mais 15 segundos de descanso">+15 s</button>
            <button type="button" onClick={() => atualizar(pularDescanso)} aria-label="Pular descanso"><SkipForward aria-hidden="true" /> Pular</button>
          </div>
        </div>
      )}

      {pausado && (
        <div className={s.pausa} role="dialog" aria-modal="true" aria-label="Treino pausado">
          <div className={s.pausaCaixa}>
            <Pause aria-hidden="true" />
            <h2>Treino pausado</h2>
            <p>O tempo e o descanso estão parados.</p>
            <Button icone={<Play />} onClick={() => atualizar(retomar)} autoFocus>Retomar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Exercicio({ ex, ei, sessao, params }: { ex: ExercicioSessao; ei: number; sessao: SessaoAtiva; params: ReturnType<typeof parametrosDoPerfil> }) {
  const { atualizar } = useTreino();
  const [trocando, setTrocando] = useState(false);
  const [erros, setErros] = useState<Record<number, string>>({});
  const info = CATALOGO.get(ex.exercicioId);
  const algumaFeita = ex.series.some((x) => x.feita);
  const naSessao = new Set(sessao.exercicios.map((e) => e.exercicioId));
  const opcoes = info && params ? substitutos(info, EXERCICIOS, params, naSessao).slice(0, 5) : [];
  const unidade = ex.porTempo ? "s" : "reps";

  function concluir(si: number) {
    const erro = validarSerie(ex.series[si]!, ex.porTempo);
    setErros((e) => ({ ...e, [si]: erro ?? "" }));
    if (!erro) atualizar((x, t) => concluirSerie(x, ei, si, t));
  }

  return (
    <Card as="section" aria-label={`Exercício ${ei + 1}: ${ex.nome}`}>
      <div className={s.exTopo}>
        {info && <div className={s.exFoto}><ImagemExercicio ex={info} /></div>}
        <div className={s.exInfo}>
          <h2>{ex.nome}</h2>
          <p className={s.mini}>Meta: {ex.alvo.series} × {ex.alvo.repsMin}–{ex.alvo.repsMax} {unidade} · descanso {ex.alvo.descansoS}s</p>
          {ex.pulado && <Badge tom="alerta">Pulado</Badge>}
          {info && <Link to={`/exercicios/${info.id}`} className={s.link}>Como fazer</Link>}
        </div>
      </div>
      {ex.sugestao && <p className={s.sugestao}>{ex.sugestao.motivo}</p>}

      <table className={s.series}>
        <thead>
          <tr><th scope="col">Série</th>{!ex.porTempo && <th scope="col">kg</th>}<th scope="col">{ex.porTempo ? "Segundos" : "Reps"}</th><th scope="col"><span className="sr-only">Concluir</span></th></tr>
        </thead>
        <tbody>
          {ex.series.map((sr, si) => (
            <tr key={sr.id} className={sr.feita ? s.feita : undefined}>
              <th scope="row">{si + 1}</th>
              {!ex.porTempo && (
                <td>
                  <CampoNumero rotulo={`Carga da série ${si + 1}`} valor={sr.cargaKg} decimal desabilitado={sr.feita} aoMudar={(v) => atualizar((x, t) => atualizarSerie(x, ei, si, { cargaKg: v }, t))} />
                </td>
              )}
              <td>
                <CampoNumero
                  rotulo={`${ex.porTempo ? "Segundos" : "Repetições"} da série ${si + 1}`}
                  valor={sr.reps}
                  dica={`${ex.alvo.repsMin}–${ex.alvo.repsMax}`}
                  desabilitado={sr.feita}
                  aoMudar={(v) => atualizar((x, t) => atualizarSerie(x, ei, si, { reps: v }, t))}
                />
                {erros[si] && <small className={s.erro} role="alert">{erros[si]}</small>}
              </td>
              <td>
                {sr.feita ? (
                  <button type="button" className={`${s.check} ${s.checkFeito}`} aria-label={`Desfazer série ${si + 1}`} onClick={() => atualizar((x, t) => desfazerSerie(x, ei, si, t))}><RotateCcw /></button>
                ) : (
                  <button type="button" className={s.check} aria-label={`Concluir série ${si + 1}`} onClick={() => concluir(si)}><Check /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={s.exAcoes}>
        <button type="button" onClick={() => atualizar((x, t) => adicionarSerie(x, ei, novoId, t))}><Plus aria-hidden="true" /> Série</button>
        <button type="button" onClick={() => atualizar((x, t) => removerSerie(x, ei, t))} disabled={ex.series.length <= 1 || ex.series.at(-1)!.feita}><Minus aria-hidden="true" /> Série</button>
        <button type="button" onClick={() => setTrocando(!trocando)} disabled={algumaFeita} aria-expanded={trocando}><Replace aria-hidden="true" /> Trocar</button>
        <button type="button" onClick={() => atualizar((x, t) => pularExercicio(x, ei, t))} disabled={ex.pulado} aria-label="Pular exercício"><SkipForward aria-hidden="true" /> Pular</button>
      </div>

      {trocando && (
        <div className={s.trocas}>
          {opcoes.length ? (
            opcoes.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  const rx = prescricaoDoExercicio(o, params!.objetivo, params!.nivel);
                  atualizar((x, t) =>
                    trocarNaSessao(x, ei, { exercicioId: o.id, nome: o.nome, tipo: o.tipo, porTempo: !!o.porTempo, alvo: { series: ex.alvo.series, repsMin: rx.repsMin, repsMax: rx.repsMax, descansoS: rx.descansoS } }, novoId, t),
                  );
                  setTrocando(false);
                }}
              >
                {o.nome}
              </button>
            ))
          ) : (
            <p className={s.mini}>Nenhum substituto possível com seus equipamentos.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function CampoNumero({ rotulo, valor, aoMudar, decimal, dica, desabilitado }: { rotulo: string; valor: number | null; aoMudar: (v: number | null) => void; decimal?: boolean; dica?: string; desabilitado?: boolean }) {
  const [texto, setTexto] = useState(valor == null ? "" : String(valor).replace(".", ","));
  useEffect(() => {
    setTexto((t) => {
      const atual = t === "" ? null : Number(t.replace(",", "."));
      return atual === valor ? t : valor == null ? "" : String(valor).replace(".", ",");
    });
  }, [valor]);
  return (
    <input
      className={s.numero}
      aria-label={rotulo}
      inputMode={decimal ? "decimal" : "numeric"}
      placeholder={dica ?? "—"}
      value={texto}
      disabled={desabilitado}
      onChange={(e) => {
        const t = e.target.value.replace(decimal ? /[^\d,.]/g : /\D/g, "");
        setTexto(t);
        if (t === "") return aoMudar(null);
        const n = Number(t.replace(",", "."));
        if (Number.isFinite(n)) aoMudar(n);
      }}
    />
  );
}


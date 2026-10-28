import { ArrowDownRight, ArrowUpRight, Minus, Plus, Target, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { GraficoBarras, GraficoLinha, type PontoGrafico } from "@/components/graficos/Graficos";
import { Button, Card, Campo, EmptyState } from "@/components/ui";
import { CATALOGO, EXERCICIOS } from "@/data/catalogo";
import { compararPeriodos, dataLocal, intervalo, PERIODOS, progressoCarga, semanas, serieMedida, variacaoPct, type Periodo, type PontoCarga } from "@/domain/evolucao";
import { CAMPOS_MEDIDA, type CampoMedida, type Medida } from "@/domain/tipos";
import { Carregando, ErroCarga } from "@/features/Estados";
import { AvisoExemplo } from "@/features/AvisoExemplo";
import { Fotos } from "./Fotos";
import { FormularioMedidas, HistoricoMedidas } from "./Medidas";
import s from "./Evolucao.module.css";

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const fmtKg = (v: number) => `${fmt.format(v)} kg`;
const fmtT = (v: number) => (v >= 1000 ? `${fmt.format(v / 1000)} t` : `${fmt.format(v)} kg`);
const curta = (d: string) => dataLocal(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const longa = (d: string) => dataLocal(d).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
const ehPeriodo = (v: string | null): v is `${Periodo}` => v === "30" || v === "90" || v === "365" || v === "0";

export function Evolucao() {
  const { estado, recarregar } = useDados();
  const [params, setParams] = useSearchParams();
  const periodo = (ehPeriodo(params.get("periodo")) ? Number(params.get("periodo")) : 90) as Periodo;

  if (estado.status === "carregando") return <Carregando />;
  if (estado.status === "erro") return <ErroCarga mensagem={estado.mensagem} tentar={recarregar} />;
  const { sessoes, medidas, perfil, perfilCompleto } = estado.dados;
  const hoje = new Date();
  const comp = compararPeriodos(sessoes, medidas, periodo, hoje);
  const meta = perfil?.metaSemanal ?? null;

  return (
    <div className={s.pagina}>
      <AvisoExemplo />
      <PageHeader titulo="Evolução" subtitulo="Seus treinos, medidas e cargas ao longo do tempo." />

      <div className={s.periodos} role="group" aria-label="Período">
        {(["30", "90", "365", "0"] as const).map((p) => (
          <button key={p} type="button" aria-pressed={Number(p) === periodo} className={Number(p) === periodo ? `${s.chip} ${s.chipAtivo}` : s.chip} onClick={() => setParams({ periodo: p }, { replace: true })}>
            {PERIODOS[Number(p) as Periodo]}
          </button>
        ))}
      </div>

      <section className={s.numeros} aria-label="Resumo do período">
        <Numero rotulo="Treinos" valor={String(comp.atual.treinos)} delta={variacaoPct(comp.atual.treinos, comp.anterior?.treinos)} />
        <Numero rotulo="Volume levantado" valor={fmtT(comp.atual.volumeKg)} delta={variacaoPct(comp.atual.volumeKg, comp.anterior?.volumeKg)} />
        <Numero rotulo="Treinos por semana" valor={fmt.format(comp.atual.mediaSemanal)} extra={meta ? `meta ${meta}` : undefined} />
        <Numero rotulo="Peso no período" valor={comp.pesoVariacaoKg == null ? "—" : `${comp.pesoVariacaoKg > 0 ? "+" : ""}${fmt.format(comp.pesoVariacaoKg)} kg`} />
      </section>
      {comp.anterior && (variacaoPct(comp.atual.treinos, comp.anterior.treinos) != null || variacaoPct(comp.atual.volumeKg, comp.anterior.volumeKg) != null) && <p className={s.mini}>Setas comparam com os {PERIODOS[periodo]} anteriores.</p>}

      <div className={s.grade}>
        <PainelPeso medidas={medidas} periodo={periodo} metaPesoKg={perfilCompleto?.metaPesoKg ?? null} podeMeta={!!perfilCompleto} />
        <PainelSemanas sessoes={sessoes} meta={meta} />
        <PainelCargas />
        <PainelRecordes />
        <PainelMedidas medidas={medidas} periodo={periodo} />
        <Card titulo="Fotos de evolução" className={s.largo}>
          <Fotos />
        </Card>
      </div>
    </div>
  );
}

function Numero({ rotulo, valor, delta, extra }: { rotulo: string; valor: string; delta?: number | null; extra?: string }) {
  const Icone = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={s.numero}>
      <span className={s.numRotulo}>{rotulo}</span>
      <strong>{valor}</strong>
      {delta != null && (
        <span className={s.delta}><Icone aria-hidden="true" /> {delta > 0 ? "+" : ""}{delta}%<span className="sr-only"> em relação ao período anterior</span></span>
      )}
      {extra && <span className={s.delta}>{extra}</span>}
    </div>
  );
}

function PainelPeso({ medidas, periodo, metaPesoKg, podeMeta }: { medidas: Medida[]; periodo: Periodo; metaPesoKg: number | null; podeMeta: boolean }) {
  const [registrando, setRegistrando] = useState(false);
  const serie = serieMedida(medidas, "pesoKg", intervalo(periodo, new Date()));
  const pontos: PontoGrafico[] = serie.map((p) => ({ rotulo: curta(p.data), valor: p.valor, detalhe: longa(p.data) }));
  return (
    <Card titulo="Peso corporal" acao={<Button variante="fantasma" icone={<Plus />} onClick={() => setRegistrando(!registrando)} aria-expanded={registrando}>Registrar</Button>}>
      {registrando && <FormularioMedidas aoSalvar={() => setRegistrando(false)} />}
      {pontos.length ? (
        <GraficoLinha titulo="Peso (kg)" pontos={pontos} formatar={fmtKg} referencia={metaPesoKg ? { valor: metaPesoKg, rotulo: `Meta ${fmt.format(metaPesoKg)} kg` } : undefined} />
      ) : (
        !registrando && <p className={s.mini}>Nenhum peso registrado neste período. Toque em “Registrar” para começar.</p>
      )}
      {podeMeta && <MetaPeso atual={metaPesoKg} />}
    </Card>
  );
}

function MetaPeso({ atual }: { atual: number | null }) {
  const { estado, salvarPerfil } = useDados();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(atual ? String(atual).replace(".", ",") : "");
  const [erro, setErro] = useState<string | null>(null);
  const perfil = estado.status === "pronto" ? estado.dados.perfilCompleto : null;
  if (!perfil) return null;

  async function salvar() {
    const n = valor.trim() === "" ? null : Number(valor.replace(",", "."));
    if (n != null && (!Number.isFinite(n) || n < 30 || n > 300)) return setErro("Entre 30 e 300 kg.");
    try {
      await salvarPerfil({ ...perfil!, metaPesoKg: n });
      setEditando(false);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }

  if (!editando) {
    return (
      <button type="button" className={s.linkBotao} onClick={() => setEditando(true)}>
        <Target aria-hidden="true" /> {atual ? `Meta de peso: ${fmt.format(atual)} kg (alterar)` : "Definir meta de peso"}
      </button>
    );
  }
  return (
    <div className={s.meta}>
      <Campo rotulo="Meta de peso (kg)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} erro={erro ?? undefined} dica="Deixe vazio para remover a meta." />
      <div className={s.acoes}>
        <Button variante="secundario" onClick={() => setEditando(false)}>Cancelar</Button>
        <Button onClick={() => void salvar()}>Salvar meta</Button>
      </div>
    </div>
  );
}

function PainelSemanas({ sessoes, meta }: { sessoes: Parameters<typeof semanas>[0]; meta: number | null }) {
  const lista = semanas(sessoes, new Date(), 12);
  const detalhe = (d: Date) => `semana de ${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
  const temTreino = lista.some((x) => x.treinos);
  return (
    <>
      <Card titulo="Frequência semanal">
        {temTreino ? (
          <GraficoBarras
            titulo="Treinos por semana"
            pontos={lista.map((x) => ({ rotulo: x.rotulo, valor: x.treinos, detalhe: detalhe(x.inicio) }))}
            formatar={(v) => fmt.format(v)}
            referencia={meta ? { valor: meta, rotulo: `Meta ${meta}` } : undefined}
          />
        ) : (
          <p className={s.mini}>Seus treinos concluídos aparecem aqui, semana a semana.</p>
        )}
      </Card>
      <Card titulo="Volume semanal">
        {temTreino ? (
          <GraficoBarras titulo="Volume (kg)" pontos={lista.map((x) => ({ rotulo: x.rotulo, valor: x.volumeKg, detalhe: detalhe(x.inicio) }))} formatar={fmtT} />
        ) : (
          <p className={s.mini}>Volume = carga × repetições somadas de todas as séries da semana.</p>
        )}
      </Card>
    </>
  );
}

function PainelCargas() {
  const { estado, historicoExercicio, recordes } = useDados();
  const plano = estado.status === "pronto" ? estado.dados.plano : null;
  const [comHistorico, setComHistorico] = useState<string[] | null>(null);
  const [escolhido, setEscolhido] = useState<string>("");
  const [pontos, setPontos] = useState<PontoCarga[] | null>(null);

  // exercícios com registro (pelos recordes), começando pelos da ficha
  useEffect(() => {
    let vivo = true;
    recordes(EXERCICIOS.map((e) => e.id))
      .then((r) => {
        if (!vivo) return;
        const daFicha = plano?.sessoes.flatMap((x) => x.itens.map((i) => i.exercicioId)) ?? [];
        const ids = [...new Set([...daFicha, ...Object.keys(r)])].filter((id) => id in r);
        setComHistorico(ids);
        setEscolhido((atual) => atual || ids[0] || "");
      })
      .catch(() => vivo && setComHistorico([]));
    return () => {
      vivo = false;
    };
  }, [recordes, plano]);

  useEffect(() => {
    if (!escolhido) return;
    let vivo = true;
    setPontos(null);
    historicoExercicio(escolhido, 30)
      .then((r) => vivo && setPontos(progressoCarga(r)))
      .catch(() => vivo && setPontos([]));
    return () => {
      vivo = false;
    };
  }, [escolhido, historicoExercicio]);

  return (
    <Card titulo="Cargas por exercício">
      {comHistorico == null ? (
        <p className={s.mini}>Carregando…</p>
      ) : !comHistorico.length ? (
        <p className={s.mini}>Registre séries no modo treino para acompanhar a evolução das cargas.</p>
      ) : (
        <>
          <label className={s.selectLinha}>
            <span className="sr-only">Exercício</span>
            <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
              {comHistorico.map((id) => <option key={id} value={id}>{CATALOGO.get(id)?.nome ?? id}</option>)}
            </select>
          </label>
          {pontos == null ? (
            <p className={s.mini}>Carregando…</p>
          ) : (
            <GraficoLinha
              titulo={`Maior carga — ${CATALOGO.get(escolhido)?.nome ?? ""}`}
              pontos={pontos.map((p) => ({ rotulo: curta(p.data), valor: p.cargaMaxKg, detalhe: `${longa(p.data)} · ${p.repsNaCargaMax} reps` }))}
              formatar={fmtKg}
            />
          )}
        </>
      )}
    </Card>
  );
}

function PainelRecordes() {
  const { recordes } = useDados();
  const [lista, setLista] = useState<[string, number][] | null>(null);
  useEffect(() => {
    let vivo = true;
    recordes(EXERCICIOS.map((e) => e.id))
      .then((r) => vivo && setLista(Object.entries(r).filter(([, v]) => v > 0).sort((a, b) => (CATALOGO.get(a[0])?.nome ?? "").localeCompare(CATALOGO.get(b[0])?.nome ?? "", "pt-BR"))))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [recordes]);

  return (
    <Card titulo="Recordes pessoais">
      {lista == null && <p className={s.mini}>Carregando…</p>}
      {lista && !lista.length && <EmptyState icone={<Trophy />} titulo="Nenhum recorde ainda" texto="A maior carga de cada exercício aparece aqui depois dos primeiros treinos." />}
      {lista && lista.length > 0 && (
        <ul className={s.recordes}>
          {lista.map(([id, kg]) => (
            <li key={id}>
              <Link to={`/exercicios/${id}`}>{CATALOGO.get(id)?.nome ?? id}</Link>
              <strong>{fmtKg(kg)}</strong>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PainelMedidas({ medidas, periodo }: { medidas: Medida[]; periodo: Periodo }) {
  const comDados = useMemo(() => (Object.keys(CAMPOS_MEDIDA) as CampoMedida[]).filter((c) => medidas.some((m) => m[c] != null)), [medidas]);
  const [campo, setCampo] = useState<CampoMedida | "">("");
  const atual = campo && comDados.includes(campo) ? campo : comDados[0];
  const def = atual ? CAMPOS_MEDIDA[atual] : null;
  const serie = atual ? serieMedida(medidas, atual, intervalo(periodo, new Date())) : [];

  return (
    <Card titulo="Medidas corporais" className={s.largo}>
      {atual && def ? (
        <>
          <label className={s.selectLinha}>
            <span className="sr-only">Medida</span>
            <select value={atual} onChange={(e) => setCampo(e.target.value as CampoMedida)}>
              {comDados.map((c) => <option key={c} value={c}>{CAMPOS_MEDIDA[c].rotulo}</option>)}
            </select>
          </label>
          {serie.length ? (
            <GraficoLinha
              titulo={`${def.rotulo} (${def.unidade})`}
              pontos={serie.map((p) => ({ rotulo: curta(p.data), valor: p.valor, detalhe: longa(p.data) }))}
              formatar={(v) => `${fmt.format(v)} ${def.unidade}`}
            />
          ) : (
            <p className={s.mini}>Sem registros desta medida no período.</p>
          )}
        </>
      ) : (
        <p className={s.mini}>Registre cintura, braço, gordura e outras medidas em “Peso corporal → Registrar → Mais medidas”.</p>
      )}
      <h3 className={s.subtitulo}>Histórico</h3>
      <HistoricoMedidas medidas={medidas} />
    </Card>
  );
}

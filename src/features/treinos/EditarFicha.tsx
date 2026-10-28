import { ArrowDown, ArrowUp, Plus, Replace, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink, Card } from "@/components/ui";
import { CATALOGO, EXERCICIOS } from "@/data/catalogo";
import { disponivel, GRUPOS, grupoDoExercicio, MUSCULOS, type Grupo } from "@/domain/exercicios";
import {
  adicionarItem,
  atualizarItem,
  fichaValida,
  itemDoExercicio,
  moverItem,
  parametrosDoPerfil,
  removerItem,
  renomearSessao,
  substitutos,
  trocarExercicio,
  validarItem,
} from "@/domain/ficha";
import { conferirPlano } from "@/domain/motor";
import { duracaoEstimadaMin } from "@/domain/treino";
import type { ItemPlano, ParametrosPlano, Plano, PlanoSessao } from "@/domain/tipos";
import { Carregando } from "@/features/Estados";
import { ListaAvisos } from "./comuns";
import s from "./Treino.module.css";

/** Editor da ficha ativa: ajustar séries/reps/descanso/carga, trocar, reordenar, remover e adicionar. */
export function EditarFicha() {
  const { estado } = useDados();
  if (estado.status === "carregando") return <Carregando />;
  const plano = estado.status === "pronto" ? estado.dados.plano : null;
  if (!plano) return <Navigate to="/treino" replace />;
  // o editor só começa com os dados prontos: a cópia local da ficha nasce da versão carregada
  return <Editor key={plano.id} inicial={plano} />;
}

function Editor({ inicial }: { inicial: Plano }) {
  const { estado, salvarPlano } = useDados();
  const navegar = useNavigate();
  const dados = estado.status === "pronto" ? estado.dados : null;
  const [ficha, setFicha] = useState<Plano>(inicial);
  const [mudou, setMudou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const params: ParametrosPlano | null = ficha?.parametros ?? (dados ? parametrosDoPerfil(dados.perfilCompleto, dados.perfil) : null);

  // avisa antes de sair da página com alterações não salvas
  useEffect(() => {
    if (!mudou) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [mudou]);

  const avisos = useMemo(() => (params ? conferirPlano(ficha, params, CATALOGO) : []), [ficha, params]);

  if (!params) return <Navigate to="/treino" replace />;

  const aplicar = (f: (p: Plano) => Plano) => {
    setFicha((atual) => f(atual));
    setMudou(true);
  };

  async function salvar() {
    if (!fichaValida(ficha)) {
      setErro("Corrija os campos destacados e deixe pelo menos um exercício em cada treino.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      // editada pela pessoa vira "manual"; ficha de professor continua sendo dele (a revisão o banco desfaz)
      await salvarPlano({ ...ficha, origem: ficha.origem === "professor" ? "professor" : "manual" });
      setMudou(false);
      navegar("/treino", { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
      setSalvando(false);
    }
  }

  return (
    <div className={s.pagina}>
      <PageHeader titulo="Editar ficha" subtitulo={ficha.revisadoEm ? "Alterar a ficha desfaz a revisão do profissional." : ficha.nome} />
      <ListaAvisos avisos={avisos} />

      {ficha.sessoes.map((sessao) => (
        <EditorSessao key={sessao.id} sessao={sessao} params={params} aplicar={aplicar} />
      ))}

      {erro && <p className={s.erroGeral} role="alert">{erro}</p>}
      <div className={s.salvar}>
        <ButtonLink to="/treino" variante="secundario">Cancelar</ButtonLink>
        <Button onClick={() => void salvar()} disabled={!mudou || salvando}>{salvando ? "Salvando…" : "Salvar ficha"}</Button>
      </div>
    </div>
  );
}

function EditorSessao({ sessao, params, aplicar }: { sessao: PlanoSessao; params: ParametrosPlano; aplicar: (f: (p: Plano) => Plano) => void }) {
  const [trocando, setTrocando] = useState<number | null>(null);
  const [novo, setNovo] = useState("");
  const noTreino = new Set(sessao.itens.map((i) => i.exercicioId));
  const possiveis = EXERCICIOS.filter((e) => disponivel(e, params.equipamentos) && !noTreino.has(e.id));
  const porGrupo = (Object.keys(GRUPOS) as Grupo[]).map((g) => [g, possiveis.filter((e) => grupoDoExercicio(e) === g)] as const).filter(([, l]) => l.length);

  return (
    <Card as="section" aria-label={`Treino ${sessao.nome}`}>
      <div className={s.itemTopo} style={{ marginBottom: 6 }}>
        <span className={s.letra} aria-hidden="true">{sessao.nome}</span>
        <label className="sr-only" htmlFor={`titulo-${sessao.id}`}>Nome do treino {sessao.nome}</label>
        <input id={`titulo-${sessao.id}`} className={s.tituloSessao} value={sessao.titulo} maxLength={60} onChange={(e) => aplicar((p) => renomearSessao(p, sessao.id, e.target.value))} />
        <span className={s.notaPequena}>~{duracaoEstimadaMin(sessao)} min</span>
      </div>

      {sessao.itens.map((it, idx) => {
        const ex = CATALOGO.get(it.exercicioId);
        const erros = validarItem(it);
        const mudarItem = (m: Partial<ItemPlano>) => aplicar((p) => atualizarItem(p, sessao.id, idx, m));
        const opcoes = ex ? substitutos(ex, EXERCICIOS, params, noTreino) : [];
        return (
          <div key={`${it.exercicioId}-${idx}`} className={s.itemEdicao}>
            <div className={s.itemTopo}>
              <strong className={s.nome}>{it.nome}</strong>
              <button type="button" className={s.iconeBtn} aria-label={`Subir ${it.nome}`} disabled={idx === 0} onClick={() => aplicar((p) => moverItem(p, sessao.id, idx, -1))}><ArrowUp /></button>
              <button type="button" className={s.iconeBtn} aria-label={`Descer ${it.nome}`} disabled={idx === sessao.itens.length - 1} onClick={() => aplicar((p) => moverItem(p, sessao.id, idx, 1))}><ArrowDown /></button>
              <button type="button" className={s.iconeBtn} aria-label={`Trocar ${it.nome}`} aria-expanded={trocando === idx} onClick={() => setTrocando(trocando === idx ? null : idx)}><Replace /></button>
              <button type="button" className={`${s.iconeBtn} ${s.perigo}`} aria-label={`Remover ${it.nome}`} onClick={() => aplicar((p) => removerItem(p, sessao.id, idx))}><Trash2 /></button>
            </div>

            <div className={s.campos}>
              <Numero rotulo="Séries" valor={it.series} erro={erros.series} aoMudar={(v) => mudarItem({ series: v ?? 0 })} />
              <Numero rotulo={it.porTempo ? "Mín. (s)" : "Reps mín."} valor={it.repsMin} erro={erros.repsMin} aoMudar={(v) => mudarItem({ repsMin: v ?? 0 })} />
              <Numero rotulo={it.porTempo ? "Máx. (s)" : "Reps máx."} valor={it.repsMax} erro={erros.repsMax} aoMudar={(v) => mudarItem({ repsMax: v ?? 0 })} />
              <Numero rotulo="Descanso (s)" valor={it.descansoS} erro={erros.descansoS} aoMudar={(v) => mudarItem({ descansoS: v ?? 0 })} />
              <Numero rotulo="Carga (kg)" valor={it.cargaKg ?? null} erro={erros.cargaKg} decimal aoMudar={(v) => mudarItem({ cargaKg: v })} />
            </div>

            {trocando === idx && (
              <div className={s.trocas}>
                <p>{opcoes.length ? "Trocar por:" : "Nenhum substituto possível com seus equipamentos e nível."}</p>
                {opcoes.slice(0, 6).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={s.troca}
                    onClick={() => {
                      aplicar((p) => trocarExercicio(p, sessao.id, idx, o, params.objetivo, params.nivel));
                      setTrocando(null);
                    }}
                  >
                    {o.nome}
                    <small>{ex?.alternativas.includes(o.id) ? "Alternativa indicada" : `Mesmo músculo: ${o.musculosPrincipais.map((m) => MUSCULOS[m]).join(", ")}`}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className={s.adicionar}>
        <label className="sr-only" htmlFor={`novo-${sessao.id}`}>Adicionar exercício ao treino {sessao.nome}</label>
        <select id={`novo-${sessao.id}`} value={novo} onChange={(e) => setNovo(e.target.value)}>
          <option value="">Adicionar exercício…</option>
          {porGrupo.map(([g, lista]) => (
            <optgroup key={g} label={GRUPOS[g].rotulo}>
              {lista.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </optgroup>
          ))}
        </select>
        <Button
          variante="secundario"
          icone={<Plus />}
          disabled={!novo}
          onClick={() => {
            const ex = CATALOGO.get(novo);
            if (ex) aplicar((p) => adicionarItem(p, sessao.id, itemDoExercicio(ex, params.objetivo, params.nivel)));
            setNovo("");
          }}
        >
          Adicionar
        </Button>
      </div>
    </Card>
  );
}

function Numero({ rotulo, valor, erro, aoMudar, decimal }: { rotulo: string; valor: number | null; erro?: string; aoMudar: (v: number | null) => void; decimal?: boolean }) {
  const [texto, setTexto] = useState(valor == null ? "" : String(valor).replace(".", ","));
  useEffect(() => {
    setTexto((t) => (Number(t.replace(",", ".")) === valor || (valor == null && t === "") ? t : valor == null ? "" : String(valor).replace(".", ",")));
  }, [valor]);
  return (
    <label className={s.num}>
      {rotulo}
      <input
        inputMode={decimal ? "decimal" : "numeric"}
        value={texto}
        aria-invalid={!!erro}
        placeholder={decimal ? "—" : undefined}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d,.]/g, "");
          setTexto(t);
          if (t === "") return aoMudar(decimal ? null : NaN);
          const n = Number(t.replace(",", "."));
          aoMudar(Number.isFinite(n) ? n : NaN);
        }}
      />
      {erro && <small>{erro}</small>}
    </label>
  );
}

import { ChevronLeft, ChevronRight, Info, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router";
import { useAcademia, useCarga, vinculosCom } from "@/app/academia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, ButtonLink, Campo, Card } from "@/components/ui";
import type { Academia } from "@/data/academia";
import {
  competenciaDe,
  deslocarCompetencia,
  FORMAS_PAGAMENTO,
  formatarReais,
  resumirMembros,
  rotuloCompetencia,
  situacaoMensalidades,
  validarPagamento,
  type FormaPagamento,
  type Membro,
} from "@/domain/academia";
import { BlocoConvites, CargaOuErro, dataCurta, SoComConta } from "./comuns";
import s from "./Academia.module.css";

const ABAS = { resumo: "Resumo", membros: "Membros", convites: "Convites", mensalidades: "Mensalidades" } as const;
type Aba = keyof typeof ABAS;

export function Gestao() {
  return (
    <SoComConta titulo="Gestão da academia">
      <Conteudo />
    </SoComConta>
  );
}

function Conteudo() {
  const { id = "" } = useParams();
  const { repo } = useAcademia();
  const carregar = useCallback(async () => {
    const [academia, membros] = await Promise.all([repo!.academia(id), repo!.membros(id)]);
    return { academia, membros };
  }, [repo, id]);
  const { estado, recarregar } = useCarga(carregar);
  return (
    <CargaOuErro estado={estado} tentar={recarregar}>
      {({ academia, membros }) => <Painel academia={academia} membros={membros} recarregar={recarregar} />}
    </CargaOuErro>
  );
}

function Painel({ academia, membros, recarregar }: { academia: Academia; membros: Membro[]; recarregar: () => void }) {
  const [params, setParams] = useSearchParams();
  const aba: Aba = (params.get("aba") as Aba) in ABAS ? (params.get("aba") as Aba) : "resumo";
  const { vinculos } = useAcademia();
  const souProfessor = vinculosCom(vinculos, "professor").some((v) => v.academiaId === academia.id);

  return (
    <div className={s.pagina}>
      <PageHeader titulo={academia.nome} subtitulo="Administração" acao={<ButtonLink to="/academia" variante="secundario">Academias</ButtonLink>} />
      <div className={s.abas} role="tablist" aria-label="Seções da gestão">
        {(Object.keys(ABAS) as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            id={`aba-${a}`}
            aria-selected={aba === a}
            aria-controls="painel-gestao"
            className={s.aba}
            onClick={() => setParams(a === "resumo" ? {} : { aba: a }, { replace: true })}
          >
            {ABAS[a]}
          </button>
        ))}
      </div>
      <div id="painel-gestao" role="tabpanel" aria-labelledby={`aba-${aba}`} className={s.pagina}>
        {aba === "resumo" && <Resumo academia={academia} membros={membros} recarregar={recarregar} />}
        {aba === "membros" && <Membros academia={academia} membros={membros} recarregar={recarregar} />}
        {aba === "convites" && <BlocoConvites academiaId={academia.id} podeConvidarProfessor ehProfessor={souProfessor} />}
        {aba === "mensalidades" && <Mensalidades academia={academia} membros={membros} />}
      </div>
    </div>
  );
}

function Resumo({ academia, membros, recarregar }: { academia: Academia; membros: Membro[]; recarregar: () => void }) {
  const { repo } = useAcademia();
  const r = resumirMembros(membros);
  const competencia = competenciaDe(new Date());
  const carregar = useCallback(() => repo!.pagamentos(academia.id, competencia), [repo, academia.id, competencia]);
  const { estado } = useCarga(carregar);
  const sit = estado.status === "pronto" ? situacaoMensalidades(membros, estado.dados) : null;

  return (
    <>
      <Card titulo="Hoje">
        <dl className={s.numeros}>
          <div className={s.numero}><dt>Alunos ativos</dt><dd>{r.alunosAtivos}</dd></div>
          <div className={s.numero}><dt>Professores</dt><dd>{r.professoresAtivos}</dd></div>
          <div className={s.numero}><dt>Alunos sem professor</dt><dd>{r.alunosSemProfessor}</dd></div>
          <div className={s.numero}>
            <dt>Pagaram em {rotuloCompetencia(competencia).split(" ")[0]!.toLowerCase()}</dt>
            <dd>{sit ? `${sit.pagos.length}/${r.alunosAtivos}` : "…"}</dd>
          </div>
        </dl>
        {sit && <p className={s.nota} style={{ marginTop: 10 }}>Recebido no mês (registrado): {formatarReais(sit.total)}.</p>}
      </Card>
      <MensalidadePadrao academia={academia} recarregar={recarregar} />
      <div className={s.privacidade}>
        <Info aria-hidden="true" />
        <p>A administração vê nomes, vínculos e pagamentos. Perfil, dados de saúde, fichas, treinos e fotos dos alunos ficam só com o aluno e o professor responsável.</p>
      </div>
    </>
  );
}

const paraNumero = (t: string) => Number(t.replace(/\./g, "").replace(",", "."));

function MensalidadePadrao({ academia, recarregar }: { academia: Academia; recarregar: () => void }) {
  const { repo } = useAcademia();
  const [texto, setTexto] = useState(academia.mensalidadePadrao == null ? "" : String(academia.mensalidadePadrao).replace(".", ","));
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setSalvo(false);
    const valor = texto.trim() === "" ? null : paraNumero(texto);
    if (valor != null && (!Number.isFinite(valor) || valor < 0 || valor > 100000)) {
      setErro("Valor inválido.");
      return;
    }
    setErro(null);
    try {
      await repo!.salvarMensalidadePadrao(academia.id, valor);
      setSalvo(true);
      recarregar();
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não foi possível salvar.");
    }
  }

  return (
    <Card titulo="Mensalidade padrão">
      <form className={s.linha} onSubmit={(e) => void salvar(e)} noValidate>
        <Campo rotulo="Valor (R$)" inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} dica="Sugerido ao registrar um pagamento. Deixe vazio se não houver valor fixo." erro={erro ?? undefined} />
        <Button type="submit" variante="secundario">{salvo ? "Salvo" : "Salvar"}</Button>
      </form>
    </Card>
  );
}

function Membros({ academia, membros, recarregar }: { academia: Academia; membros: Membro[]; recarregar: () => void }) {
  const { repo } = useAcademia();
  const [erro, setErro] = useState<string | null>(null);
  const professores = membros.filter((m) => m.papel === "professor" && m.ativo);
  const r = resumirMembros(membros);
  const grupos: [string, Membro[]][] = [
    ["Administração", membros.filter((m) => m.papel === "admin" && m.ativo)],
    ["Professores", professores],
    ["Alunos", membros.filter((m) => m.papel === "aluno" && m.ativo)],
    ["Inativos", membros.filter((m) => !m.ativo)],
  ];

  async function agir(f: () => Promise<void>) {
    setErro(null);
    try {
      await f();
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar.");
    }
  }

  return (
    <>
      {erro && <p className={s.erro} role="alert">{erro}</p>}
      {grupos.map(([titulo, lista]) =>
        lista.length ? (
          <Card key={titulo} titulo={`${titulo} (${lista.length})`}>
            <ul className={s.lista}>
              {lista.map((m) => (
                <li key={`${m.userId}-${m.papel}`}>
                  <div className={s.info}>
                    <strong>{m.nome}</strong>
                    <span>
                      desde {dataCurta(m.desde)}
                      {m.papel === "professor" && ` · ${r.porProfessor.get(m.userId) ?? 0} alunos`}
                      {!m.ativo && ` · ${m.papel === "aluno" ? "aluno" : m.papel === "professor" ? "professor" : "administração"} inativo`}
                    </span>
                  </div>
                  <div className={s.acoes}>
                    {m.papel === "aluno" && m.ativo && (
                      <label>
                        <span className="sr-only">Professor de {m.nome}</span>
                        <select
                          className={s.select}
                          value={m.professorId ?? ""}
                          onChange={(e) => void agir(() => repo!.definirProfessor(academia.id, m.userId, e.target.value || null))}
                        >
                          <option value="">Sem professor</option>
                          {professores.map((p) => <option key={p.userId} value={p.userId}>{p.nome}</option>)}
                        </select>
                      </label>
                    )}
                    {m.ativo ? (
                      <Button
                        variante="fantasma"
                        aria-label={`Desativar ${m.nome}`}
                        onClick={() => {
                          const aviso = m.papel === "professor" ? `Desativar ${m.nome}? Os alunos vinculados ficam sem professor.` : `Desativar ${m.nome}?`;
                          if (window.confirm(aviso)) void agir(() => repo!.definirAtivo(academia.id, m.userId, m.papel, false));
                        }}
                      >
                        Desativar
                      </Button>
                    ) : (
                      <Button variante="secundario" aria-label={`Reativar ${m.nome}`} onClick={() => void agir(() => repo!.definirAtivo(academia.id, m.userId, m.papel, true))}>Reativar</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null,
      )}
      <p className={s.nota}>Para adicionar alguém, crie um convite na aba Convites. Quem sai da academia pelo próprio app some desta lista.</p>
    </>
  );
}

function Mensalidades({ academia, membros }: { academia: Academia; membros: Membro[] }) {
  const { repo } = useAcademia();
  const atual = competenciaDe(new Date());
  const [competencia, setCompetencia] = useState(atual);
  const carregar = useCallback(() => repo!.pagamentos(academia.id, competencia), [repo, academia.id, competencia]);
  const { estado, recarregar } = useCarga(carregar);
  const [erro, setErro] = useState<string | null>(null);
  const nomes = useMemo(() => new Map(membros.map((m) => [m.userId, m.nome])), [membros]);

  async function excluir(id: string, nome: string) {
    if (!window.confirm(`Excluir o pagamento de ${nome}?`)) return;
    setErro(null);
    try {
      await repo!.excluirPagamento(id);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <>
      <div className={s.privacidade}>
        <Info aria-hidden="true" />
        <p>O app não faz cobranças nem recebe pagamentos. Aqui você registra as mensalidades que já recebeu (Pix, dinheiro, cartão…) para acompanhar quem está em dia.</p>
      </div>
      <div className={s.mes}>
        <button type="button" className={s.iconeBtn} aria-label="Mês anterior" onClick={() => setCompetencia((c) => deslocarCompetencia(c, -1))}><ChevronLeft /></button>
        <strong aria-live="polite">{rotuloCompetencia(competencia)}</strong>
        <button type="button" className={s.iconeBtn} aria-label="Próximo mês" disabled={competencia >= atual} onClick={() => setCompetencia((c) => deslocarCompetencia(c, 1))}><ChevronRight /></button>
      </div>
      {erro && <p className={s.erro} role="alert">{erro}</p>}
      <CargaOuErro estado={estado} tentar={recarregar}>
        {(pagamentos) => {
          const sit = situacaoMensalidades(membros, pagamentos);
          const deQuemSaiu = pagamentos.filter((p) => !sit.pagos.some((x) => x.pagamento.id === p.id));
          return (
            <>
              <Card titulo={`Em aberto (${sit.pendentes.length})`}>
                {sit.pendentes.length ? (
                  <ul className={s.lista}>
                    {sit.pendentes.map((m) => <LinhaPendente key={m.userId} m={m} academia={academia} competencia={competencia} aoRegistrar={recarregar} />)}
                  </ul>
                ) : (
                  <p className={s.nota}>Todos os alunos ativos têm pagamento registrado neste mês.</p>
                )}
              </Card>
              <Card titulo={`Pagos (${pagamentos.length}) · ${formatarReais(sit.total)}`}>
                {pagamentos.length ? (
                  <div className={s.rolagem}>
                    <table className={s.tabela}>
                      <thead>
                        <tr><th scope="col">Aluno</th><th scope="col">Data</th><th scope="col">Forma</th><th scope="col" style={{ textAlign: "right" }}>Valor</th><th scope="col"><span className="sr-only">Ações</span></th></tr>
                      </thead>
                      <tbody>
                        {[...sit.pagos.map((x) => x.pagamento), ...deQuemSaiu].map((p) => {
                          const nome = nomes.get(p.alunoId) ?? "Ex-aluno";
                          return (
                            <tr key={p.id}>
                              <td>{nome}{p.observacao && <><br /><small className={s.nota}>{p.observacao}</small></>}</td>
                              <td>{dataCurta(`${p.pagoEm}T12:00:00`)}</td>
                              <td>{FORMAS_PAGAMENTO[p.forma]}</td>
                              <td className={s.num}>{formatarReais(p.valor)}</td>
                              <td><button type="button" className={s.iconeBtn} aria-label={`Excluir pagamento de ${nome}`} onClick={() => void excluir(p.id, nome)}><Trash2 /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={s.nota}>Nenhum pagamento registrado neste mês.</p>
                )}
              </Card>
            </>
          );
        }}
      </CargaOuErro>
    </>
  );
}

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function LinhaPendente({ m, academia, competencia, aoRegistrar }: { m: Membro; academia: Academia; competencia: string; aoRegistrar: () => void }) {
  const { repo } = useAcademia();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(academia.mensalidadePadrao == null ? "" : String(academia.mensalidadePadrao).replace(".", ","));
  const [pagoEm, setPagoEm] = useState(hojeISO());
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function registrar(e: FormEvent) {
    e.preventDefault();
    const v = paraNumero(valor);
    const problema = validarPagamento({ valor: v, pagoEm });
    if (problema) {
      setErro(problema);
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await repo!.registrarPagamento(academia.id, { alunoId: m.userId, competencia, valor: v, pagoEm, forma, observacao: obs });
      aoRegistrar();
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não foi possível registrar.");
      setEnviando(false);
    }
  }

  return (
    <li>
      <div className={s.info}>
        <strong>{m.nome}</strong>
        {!aberto && <span><Badge tom="alerta">Sem pagamento registrado</Badge></span>}
      </div>
      {!aberto ? (
        <Button variante="secundario" aria-label={`Registrar pagamento de ${m.nome}`} onClick={() => setAberto(true)}>Registrar</Button>
      ) : (
        <form className={s.form} style={{ flexBasis: "100%" }} onSubmit={(e) => void registrar(e)} noValidate aria-label={`Pagamento de ${m.nome}`}>
          <div className={s.linha}>
            <Campo rotulo="Valor (R$)" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
            <Campo rotulo="Pago em" type="date" value={pagoEm} max={hojeISO()} onChange={(e) => setPagoEm(e.target.value)} />
            <label className={s.texto}>
              Forma
              <br />
              <select className={s.select} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
                {(Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).map((f) => <option key={f} value={f}>{FORMAS_PAGAMENTO[f]}</option>)}
              </select>
            </label>
          </div>
          <Campo rotulo="Observação (opcional)" value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} />
          {erro && <p className={s.erro} role="alert">{erro}</p>}
          <div className={s.acoes}>
            <Button type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar pagamento"}</Button>
          </div>
        </form>
      )}
    </li>
  );
}

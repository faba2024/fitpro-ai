import { Check, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink, Card, Opcao } from "@/components/ui";
import { CATALOGO, EXERCICIOS } from "@/data/catalogo";
import { parametrosDoPerfil } from "@/domain/ficha";
import { conferirPlano, gerarPlano, treinosPorSemana } from "@/domain/motor";
import { duracaoEstimadaMin } from "@/domain/treino";
import { EQUIPAMENTOS, NIVEIS, OBJETIVOS, type Equipamento, type ParametrosPlano } from "@/domain/tipos";
import { Carregando } from "@/features/Estados";
import { ListaAvisos, TabelaVolume, textoFaixa } from "./comuns";
import s from "./Treino.module.css";

const DURACOES = [30, 45, 60, 75, 90, 120];
const novoId = () => crypto.randomUUID();

/** Monta uma ficha a partir do perfil, com ajustes só para esta ficha e prévia ao vivo. */
export function CriarTreino() {
  const { estado } = useDados();
  if (estado.status === "carregando") return <Carregando />;
  const inicial = estado.status === "pronto" ? parametrosDoPerfil(estado.dados.perfilCompleto, estado.dados.perfil) : null;
  if (!inicial) return <Navigate to="/perfil" replace />;
  return <Montador inicial={inicial} />;
}

function Montador({ inicial }: { inicial: ParametrosPlano }) {
  const { estado, salvarPlano } = useDados();
  const navegar = useNavigate();
  const dados = estado.status === "pronto" ? estado.dados : null;
  const [params, setParams] = useState<ParametrosPlano>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const plano = useMemo(() => (params.equipamentos.length ? gerarPlano(params, EXERCICIOS, novoId) : null), [params]);
  const avisos = useMemo(() => (plano ? conferirPlano(plano, params, CATALOGO) : []), [plano, params]);

  const mudar = (parcial: Partial<ParametrosPlano>) => setParams((p) => ({ ...p, ...parcial }));
  const alternarEquip = (e: Equipamento, sim: boolean) => mudar({ equipamentos: sim ? [...params.equipamentos, e] : params.equipamentos.filter((x) => x !== e) });

  async function salvar() {
    if (!plano) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvarPlano(plano);
      navegar("/treino", { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a ficha.");
      setSalvando(false);
    }
  }

  const treinos = treinosPorSemana(params.diasSemana, params.nivel);

  return (
    <div className={s.pagina}>
      <PageHeader titulo="Montar treino" subtitulo={`${OBJETIVOS[params.objetivo]} · ${NIVEIS[params.nivel]}${params.conservador ? " · modo conservador" : ""}`} />

      <div className={s.duasColunas}>
        <div className={s.coluna}>
          <Card titulo="Ajustes desta ficha">
            <p className={s.rotulo}>Dias por semana</p>
            <div className={s.botoes} role="group" aria-label="Dias por semana">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <button key={d} type="button" className={s.opcaoNum} aria-pressed={params.diasSemana === d} onClick={() => mudar({ diasSemana: d })}>{d}</button>
              ))}
            </div>
            <p className={s.rotulo} style={{ marginTop: 14 }}>Tempo por treino</p>
            <div className={s.botoes} role="group" aria-label="Tempo por treino">
              {DURACOES.map((m) => (
                <button key={m} type="button" className={s.opcaoNum} aria-pressed={params.minutosSessao === m} onClick={() => mudar({ minutosSessao: m })}>{m} min</button>
              ))}
            </div>
            <p className={s.rotulo} style={{ marginTop: 14 }}>Equipamentos</p>
            <div className={s.gradeEquip}>
              {(Object.keys(EQUIPAMENTOS) as Equipamento[]).map((e) => (
                <Opcao key={e} tipo="checkbox" rotulo={EQUIPAMENTOS[e]} checked={params.equipamentos.includes(e)} onChange={(ev) => alternarEquip(e, ev.target.checked)} />
              ))}
            </div>
            {!params.equipamentos.length && <p className={s.erroGeral} role="alert" style={{ marginTop: 10 }}>Marque pelo menos um equipamento.</p>}
            <p className={s.notaPequena} style={{ textAlign: "left", marginTop: 12 }}>
              <Info aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: -2 }} /> Estes ajustes valem só para esta ficha. Para mudar de vez, edite seu perfil.
            </p>
          </Card>

          {plano && (
            <Card titulo="Volume semanal">
              <TabelaVolume plano={plano} diasSemana={params.diasSemana} nivel={params.nivel} />
            </Card>
          )}
        </div>

        <div className={s.coluna}>
          {plano ? (
            <>
              <Card titulo={plano.nome}>
                <p className={s.explicacao}>{plano.explicacao}</p>
                <p className={s.notaPequena} style={{ textAlign: "left", marginTop: 8 }}>
                  {treinos} {treinos === 1 ? "treino" : "treinos"} por semana. A carga inicial fica para você definir no primeiro treino: escolha um peso que permita terminar cada série com técnica boa e 1 a 3 repetições de sobra.
                </p>
              </Card>
              <ListaAvisos avisos={avisos} />
              {plano.sessoes.map((sessao) => (
                <Card key={sessao.id} titulo={`${sessao.nome} · ${sessao.titulo}`} acao={<span className={s.notaPequena}>~{duracaoEstimadaMin(sessao)} min</span>}>
                  <ol className={s.itens}>
                    {sessao.itens.map((it) => (
                      <li key={it.exercicioId}>
                        <span className={s.nome}>{it.nome}</span>
                        <span className={s.meta}>{textoFaixa(it)}</span>
                      </li>
                    ))}
                  </ol>
                </Card>
              ))}
            </>
          ) : (
            <Card><p className={s.explicacao}>Marque os equipamentos para ver a prévia da ficha.</p></Card>
          )}
        </div>
      </div>

      {erro && <p className={s.erroGeral} role="alert">{erro}</p>}
      <div className={s.salvar}>
        <ButtonLink to="/treino" variante="secundario">Cancelar</ButtonLink>
        <Button icone={<Check />} onClick={() => void salvar()} disabled={!plano || salvando}>
          {salvando ? "Salvando…" : dados?.plano ? "Usar esta ficha (substitui a atual)" : "Usar esta ficha"}
        </Button>
      </div>
    </div>
  );
}

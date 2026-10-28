import { ArrowLeft, History, Pause, Play, ShieldAlert, TriangleAlert, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useDados } from "@/app/dados";
import { Badge, Card } from "@/components/ui";
import { CATALOGO } from "@/data/catalogo";
import {
  alternativasPossiveis,
  disponivel,
  GRUPOS,
  grupoDoExercicio,
  LICENCA_ACERVO,
  MUSCULOS,
  prescricaoDoExercicio,
  type Exercicio,
} from "@/domain/exercicios";
import { EQUIPAMENTOS, NIVEIS, OBJETIVOS } from "@/domain/tipos";
import { NaoEncontrada } from "@/features/NaoEncontrada";
import { BotaoFavorito, ImagemExercicio, TOM_NIVEL } from "./comuns";
import s from "./Exercicios.module.css";

const reduzMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Alterna as fotos de início e fim do movimento como uma animação simples. */
function Demonstracao({ ex }: { ex: Exercicio }) {
  const [quadro, setQuadro] = useState<0 | 1>(0);
  const [tocando, setTocando] = useState(() => !reduzMovimento());

  useEffect(() => {
    if (!tocando) return;
    const t = setInterval(() => setQuadro((q) => (q === 0 ? 1 : 0)), 1200);
    return () => clearInterval(t);
  }, [tocando]);

  return (
    <figure className={s.demo}>
      <div className={s.demoFoto}>
        <ImagemExercicio ex={ex} quadro={quadro} prioridade />
      </div>
      <figcaption className={s.demoBarra}>
        <span>{quadro === 0 ? "Posição inicial" : "Posição final"}</span>
        <div className={s.demoBotoes}>
          <button type="button" onClick={() => setQuadro(0)} aria-pressed={quadro === 0}>Início</button>
          <button type="button" onClick={() => setQuadro(1)} aria-pressed={quadro === 1}>Fim</button>
          <button type="button" onClick={() => setTocando(!tocando)} aria-label={tocando ? "Pausar animação" : "Animar movimento"}>
            {tocando ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
        </div>
      </figcaption>
    </figure>
  );
}

export function Detalhe() {
  const { id = "" } = useParams();
  const { estado } = useDados();
  const [erro, setErro] = useState<string | null>(null);
  const ex = CATALOGO.get(id);
  if (!ex) return <NaoEncontrada />;

  const perfil = estado.status === "pronto" ? estado.dados.perfilCompleto : null;
  const objetivo = perfil?.objetivo ?? "hipertrofia";
  const nivel = perfil?.nivel ?? "intermediario";
  const p = prescricaoDoExercicio(ex, objetivo, nivel);
  const meus = perfil?.equipamentos ?? null;
  const possoFazer = !meus || disponivel(ex, meus);
  const alternativas = ex.alternativas.map((a) => CATALOGO.get(a)!).filter(Boolean);
  const possiveis = new Set(alternativasPossiveis(ex, CATALOGO, meus).map((a) => a.id));
  const descanso = p.descansoS >= 120 ? `${p.descansoS / 60} min` : `${p.descansoS} s`;

  return (
    <article className={s.detalhe}>
      <div className={s.topo}>
        <Link to="/exercicios" className={s.voltar}><ArrowLeft aria-hidden="true" /> Exercícios</Link>
        <BotaoFavorito ex={ex} aoErro={setErro} />
      </div>
      <h1 className={s.titulo}>{ex.nome}</h1>
      <div className={s.badges}>
        <Badge tom="destaque">{GRUPOS[grupoDoExercicio(ex)].rotulo}</Badge>
        <Badge tom={TOM_NIVEL[ex.dificuldade]}>{NIVEIS[ex.dificuldade]}</Badge>
        <Badge>{ex.tipo === "composto" ? "Multiarticular" : "Isolado"}</Badge>
      </div>
      {erro && <p className={s.erro} role="alert">{erro}</p>}

      <div className={s.colunas}>
        <div className={s.coluna}>
          <Demonstracao ex={ex} />

          <Card titulo="Para você">
            <p className={s.prescricao}>
              {p.series} × {p.repsMin}–{p.repsMax} {p.unidade === "s" ? "segundos" : "repetições"}
              <span> · descanso {descanso}</span>
            </p>
            <p className={s.mini}>
              Sugestão para {OBJETIVOS[objetivo].toLowerCase()}, nível {NIVEIS[nivel].toLowerCase()}
              {!perfil && " (padrão; complete seu perfil para personalizar)"}. Escolha a carga que permita terminar a última série com técnica boa e 1 a 3 repetições de sobra.
            </p>
            {!possoFazer && (
              <p className={s.aviso}><TriangleAlert aria-hidden="true" /> Precisa de: {ex.equipamentos.map((e) => EQUIPAMENTOS[e]).join(", ")}. Veja as alternativas abaixo.</p>
            )}
            {perfil?.limitacoes && (
              <p className={s.aviso}><ShieldAlert aria-hidden="true" /> Você informou limitações no perfil. Se este movimento causar dor, pare e converse com um profissional.</p>
            )}
          </Card>

          <Card titulo="Músculos trabalhados">
            <p className={s.rotuloLista}>Principais</p>
            <div className={s.badges}>{ex.musculosPrincipais.map((m) => <Badge key={m} tom="destaque">{MUSCULOS[m]}</Badge>)}</div>
            {ex.musculosSecundarios.length > 0 && (
              <>
                <p className={s.rotuloLista}>Secundários</p>
                <div className={s.badges}>{ex.musculosSecundarios.map((m) => <Badge key={m}>{MUSCULOS[m]}</Badge>)}</div>
              </>
            )}
            <p className={s.rotuloLista}>Equipamento</p>
            <p className={s.texto}>{ex.equipamentos.map((e) => (e === "academia_completa" ? "Barras paralelas (academia)" : EQUIPAMENTOS[e])).join(", ")}</p>
          </Card>
        </div>

        <div className={s.coluna}>
          <Card titulo="Para que serve">
            <p className={s.texto}>{ex.finalidade}</p>
          </Card>

          <Card titulo="Passo a passo">
            <ol className={s.passos}>{ex.passos.map((t, i) => <li key={i}>{t}</li>)}</ol>
            <p className={s.respiracao}><Wind aria-hidden="true" /> {ex.respiracao}</p>
          </Card>

          <Card titulo="Técnica e postura">
            <ul className={s.lista}>{ex.tecnica.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Card>

          <Card titulo="Erros comuns">
            <ul className={`${s.lista} ${s.listaErro}`}>{ex.errosComuns.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </Card>

          <div className={s.seguranca} role="note">
            <ShieldAlert aria-hidden="true" />
            <p><b>Segurança.</b> {ex.seguranca}</p>
          </div>
        </div>
      </div>

      {alternativas.length > 0 && (
        <section aria-labelledby="alternativas">
          <h2 id="alternativas" className={s.subtitulo}>Alternativas</h2>
          <ul className={s.alternativas}>
            {alternativas.map((a) => (
              <li key={a.id}>
                <Link to={`/exercicios/${a.id}`} className={s.alternativa}>
                  <div className={s.altFoto}><ImagemExercicio ex={a} /></div>
                  <div>
                    <strong>{a.nome}</strong>
                    <span>{possiveis.has(a.id) ? a.equipamentos.map((e) => EQUIPAMENTOS[e]).join(", ") : "Precisa de outro equipamento"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <p className={s.linhaIcone}><History aria-hidden="true" /> Seu histórico com este exercício (cargas e repetições) aparece quando o modo treino, da etapa 8, estiver pronto.</p>
      </Card>

      <p className={s.credito}>{LICENCA_ACERVO}</p>
    </article>
  );
}

import { Activity, Bot, Check, ChevronRight, Flame, History, PersonStanding, Play, RotateCcw, Sparkles, Target, Trophy } from "lucide-react";
import { Link } from "react-router";
import { useDados } from "@/app/dados";
import { Badge, Button, ButtonLink, Card, EmptyState, ProgressBar } from "@/components/ui";
import { OBJETIVOS, type DadosUsuario } from "@/domain/tipos";
import { resumoSemanal, type DiaSemana } from "@/domain/semana";
import { duracaoEstimadaMin, duracaoRealMin, gruposDaSessao, proximaSessao, sessaoEmAndamento, ultimasConcluidas } from "@/domain/treino";
import { AvisoExemplo } from "@/features/AvisoExemplo";
import { Carregando, ErroCarga } from "@/features/Estados";
import s from "./Dashboard.module.css";

const fmtData = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const fmtCurta = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function saudacao(h: number) {
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Dashboard() {
  const { estado, carregarExemplo, recarregar } = useDados();

  if (estado.status === "carregando") return <Carregando />;
  if (estado.status === "erro") return <ErroCarga mensagem={estado.mensagem} tentar={recarregar} />;

  const { dados } = estado;
  if (!dados.perfil) return <BoasVindas carregarExemplo={carregarExemplo} />;
  return <Painel dados={dados} />;
}

function BoasVindas({ carregarExemplo }: { carregarExemplo: () => Promise<void> }) {
  return (
    <Card className={s.boasVindas}>
      <EmptyState
        icone={<Sparkles />}
        titulo="Boas-vindas ao FitPro AI"
        texto="O cadastro e a montagem da sua ficha chegam nas próximas etapas. Por enquanto, explore o app com dados de exemplo: nada é enviado para a internet."
        acao={<Button icone={<Play />} onClick={() => void carregarExemplo()}>Explorar com exemplo</Button>}
      />
    </Card>
  );
}

function Painel({ dados }: { dados: DadosUsuario }) {
  const perfil = dados.perfil!;
  const plano = dados.plano;
  const hoje = new Date();
  const semana = resumoSemanal(dados.sessoes, hoje, perfil.metaSemanal);
  const emAndamento = sessaoEmAndamento(dados.sessoes);
  const proxima = plano ? proximaSessao(plano, dados.sessoes) : null;
  const ultimas = ultimasConcluidas(dados.sessoes, 3);
  const pesos = [...dados.medidas].sort((a, b) => a.data.localeCompare(b.data));
  const pesoAtual = pesos.at(-1);
  const variacao = pesoAtual && pesos.length > 1 ? pesoAtual.pesoKg - pesos[0]!.pesoKg : null;

  return (
    <div className={s.pagina}>
      <AvisoExemplo />

      <header className={s.cab}>
        <p className={s.data}>{fmtData.format(hoje)}</p>
        <h1 className={s.ola}>
          {saudacao(hoje.getHours())}, {perfil.nome}
        </h1>
      </header>

      <div className={s.grade}>
        <section className={s.hero} aria-labelledby="treino-dia">
          {emAndamento ? (
            <>
              <p className={s.heroRotulo}>Treino em andamento</p>
              <h2 id="treino-dia" className={s.heroTitulo}>{emAndamento.titulo}</h2>
              <p className={s.heroInfo}>{emAndamento.seriesConcluidas} séries registradas</p>
              <ButtonLink to="/treino/sessao" className={s.heroBtn} icone={<RotateCcw />}>Retomar treino</ButtonLink>
            </>
          ) : proxima ? (
            <>
              <p className={s.heroRotulo}>Treino do dia</p>
              <h2 id="treino-dia" className={s.heroTitulo}>
                {proxima.nome} · {proxima.titulo}
              </h2>
              <p className={s.heroInfo}>
                {proxima.itens.length} exercícios · ~{duracaoEstimadaMin(proxima)} min
              </p>
              <div className={s.grupos}>
                {gruposDaSessao(proxima).map((g) => <span key={g}>{g}</span>)}
              </div>
              <ButtonLink to="/treino/sessao" className={s.heroBtn} icone={<Play />}>Iniciar treino</ButtonLink>
            </>
          ) : (
            <>
              <p className={s.heroRotulo}>Treino do dia</p>
              <h2 id="treino-dia" className={s.heroTitulo}>Sua ficha está a caminho</h2>
              <p className={s.heroInfo}>
                Seu perfil está salvo. O criador de treinos (etapa 7) vai montar sua divisão para {perfil.metaSemanal} dias por semana, com {perfil.minutosSessao} min por treino.
              </p>
            </>
          )}
        </section>

        <Card titulo="Sua semana" className={s.semana}>
          <ol className={s.dias}>
            {semana.dias.map((d) => <Dia key={d.rotulo} dia={d} />)}
          </ol>
          <div className={s.stats}>
            <div className={s.stat}>
              <Target aria-hidden="true" />
              <div>
                <span className={s.statValor}>{semana.feitos}/{semana.meta}</span>
                <span className={s.statRotulo}>treinos na semana</span>
              </div>
            </div>
            <div className={s.stat}>
              <Flame aria-hidden="true" />
              <div>
                <span className={s.statValor}>{semana.sequenciaSemanas} {semana.sequenciaSemanas === 1 ? "semana" : "semanas"}</span>
                <span className={s.statRotulo}>batendo a meta</span>
              </div>
            </div>
          </div>
        </Card>

        <Card titulo="Seu objetivo" className={s.objetivo}>
          <div className={s.objetivoLinha}>
            <span className={s.objetivoNome}>{OBJETIVOS[perfil.objetivo]}</span>
            {plano && <Badge tom="destaque">{plano.nome}</Badge>}
          </div>
          <ProgressBar valor={semana.feitos} max={semana.meta} rotulo="Meta semanal de treinos" />
          <p className={s.mini}>
            {semana.feitos >= semana.meta ? "Meta da semana batida. Descanse bem!" : `Faltam ${semana.meta - semana.feitos} treino(s) para a meta da semana.`}
          </p>
          {pesoAtual && (
            <div className={s.peso}>
              <span className={s.mini}>Peso atual</span>
              <strong>{fmtNum.format(pesoAtual.pesoKg)} kg</strong>
              {variacao !== null && variacao !== 0 && (
                <Badge tom={variacao < 0 ? "sucesso" : "neutro"}>
                  {variacao > 0 ? "+" : ""}
                  {fmtNum.format(variacao)} kg
                </Badge>
              )}
            </div>
          )}
        </Card>

        <Card titulo="Últimas atividades" acao={<Link to="/evolucao" className={s.verTodas}>Ver histórico</Link>} className={s.ultimas}>
          {ultimas.length ? (
            <ul className={s.lista}>
              {ultimas.map((u) => (
                <li key={u.id} className={s.atividade}>
                  <span className={s.atvIcone} aria-hidden="true"><Check /></span>
                  <div className={s.atvTexto}>
                    <strong>{u.titulo}</strong>
                    <span>
                      {fmtCurta.format(new Date(u.iniciadaEm))} · {duracaoRealMin(u) ?? "—"} min · {fmtNum.format(u.volumeKg / 1000)} t de volume
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.mini}>Seus treinos concluídos aparecem aqui.</p>
          )}
        </Card>

        <nav className={s.atalhos} aria-label="Atalhos">
          <Atalho para="/exercicios" icone={<Activity />} rotulo="Exercícios" />
          <Atalho para="/anatomia" icone={<PersonStanding />} rotulo="Mapa muscular" />
          <Atalho para="/evolucao" icone={<History />} rotulo="Histórico" />
          <Atalho para="/assistente" icone={<Bot />} rotulo="Assistente IA" />
          <Atalho para="/treino" icone={<Trophy />} rotulo="Plano semanal" />
        </nav>
      </div>
    </div>
  );
}

const ROTULO_DIA: Record<DiaSemana["status"], string> = { feito: "treino feito", hoje: "hoje", futuro: "", passado: "sem treino" };

function Dia({ dia }: { dia: DiaSemana }) {
  return (
    <li className={`${s.dia} ${s[dia.status]}`}>
      <span className={s.bolinha} aria-hidden="true">{dia.status === "feito" && <Check />}</span>
      <span className={s.diaRotulo}>{dia.rotulo}</span>
      {ROTULO_DIA[dia.status] && <span className="sr-only">{ROTULO_DIA[dia.status]}</span>}
    </li>
  );
}

function Atalho({ para, icone, rotulo }: { para: string; icone: React.ReactNode; rotulo: string }) {
  return (
    <Link to={para} className={s.atalho}>
      <span className={s.atalhoIcone} aria-hidden="true">{icone}</span>
      {rotulo}
      <ChevronRight className={s.seta} aria-hidden="true" />
    </Link>
  );
}

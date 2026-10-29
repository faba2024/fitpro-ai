import { AlertTriangle, ChevronRight, Users } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router";
import { useAcademia, useCarga, vinculosCom } from "@/app/academia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { treinosRecentes } from "@/domain/academia";
import { NIVEIS, OBJETIVOS } from "@/domain/tipos";
import type { ResumoAluno } from "@/data/academia";
import { Carregando, ErroCarga } from "@/features/Estados";
import { BlocoConvites, CargaOuErro, SoComConta } from "./comuns";
import s from "./Academia.module.css";

export function Professor() {
  return (
    <SoComConta titulo="Meus alunos">
      <Conteudo />
    </SoComConta>
  );
}

function Conteudo() {
  const { repo, vinculos, recarregarVinculos } = useAcademia();
  const academias = vinculosCom(vinculos, "professor");
  const admins = new Set(vinculosCom(vinculos, "admin").map((v) => v.academiaId));
  const carregar = useCallback(() => repo!.meusAlunos(), [repo]);
  const { estado, recarregar } = useCarga(academias.length ? carregar : null);

  if (vinculos.status === "carregando") return <Carregando />;
  if (vinculos.status === "erro") return <ErroCarga mensagem={vinculos.mensagem} tentar={recarregarVinculos} />;
  if (!academias.length) {
    return (
      <>
        <PageHeader titulo="Meus alunos" />
        <Card>
          <EmptyState
            icone={<Users />}
            titulo="Você ainda não é professor em nenhuma academia"
            texto="Peça um convite de professor à administração da academia e digite o código em Academias."
            acao={<ButtonLink to="/academia">Ir para Academias</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  return (
    <div className={s.pagina}>
      <PageHeader titulo="Meus alunos" subtitulo={academias.map((a) => a.academiaNome).join(" · ")} />
      <CargaOuErro estado={estado} tentar={recarregar}>
        {(alunos) =>
          alunos.length ? (
            <Card titulo={`${alunos.length} ${alunos.length === 1 ? "aluno" : "alunos"}`}>
              <ul className={s.lista}>{alunos.map((a) => <LinhaAluno key={a.id} a={a} />)}</ul>
            </Card>
          ) : (
            <Card>
              <EmptyState icone={<Users />} titulo="Nenhum aluno ainda" texto="Crie um convite abaixo e passe o código para seus alunos. Quem entrar por ele fica com você como professor." />
            </Card>
          )
        }
      </CargaOuErro>
      {academias.map((a) => (
        <section key={a.academiaId} aria-label={`Convites de ${a.academiaNome}`} className={s.pagina}>
          {academias.length > 1 && <h2 className={s.texto}><b>{a.academiaNome}</b></h2>}
          <BlocoConvites academiaId={a.academiaId} podeConvidarProfessor={admins.has(a.academiaId)} ehProfessor />
        </section>
      ))}
    </div>
  );
}

function LinhaAluno({ a }: { a: ResumoAluno }) {
  const semana = treinosRecentes(a.treinos30d, 7);
  return (
    <li>
      <div className={s.info}>
        <strong>
          <Link to={`/professor/alunos/${a.id}`} className={s.texto} style={{ color: "var(--text)" }}>{a.nome}</Link>
        </strong>
        <span>
          {OBJETIVOS[a.objetivo]} · {NIVEIS[a.nivel]} · meta {a.diasSemana}×/semana · {semana} {semana === 1 ? "treino" : "treinos"} em 7 dias, {a.treinos30d.length} em 30
        </span>
        <div className={s.selos}>
          {(a.parqAlerta || a.temLimitacoes) && (
            <Badge tom="alerta"><AlertTriangle aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: "-2px" }} /> {a.parqAlerta ? "Questionário de saúde pede atenção" : "Tem limitações"}</Badge>
          )}
          {!a.ficha ? <Badge>Sem ficha</Badge> : a.ficha.revisadaEm ? <Badge tom="sucesso">Ficha revisada</Badge> : <Badge tom="destaque">Ficha para revisar</Badge>}
        </div>
      </div>
      <Link to={`/professor/alunos/${a.id}`} aria-hidden="true" tabIndex={-1} className={s.iconeBtn}><ChevronRight /></Link>
    </li>
  );
}

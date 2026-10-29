import { useCallback, useMemo } from "react";
import { useParams } from "react-router";
import { useAcademia, useCarga } from "@/app/academia";
import { EXERCICIOS } from "@/data/catalogo";
import type { DetalheAluno } from "@/data/academia";
import { parametrosDoPerfil } from "@/domain/ficha";
import { gerarPlano } from "@/domain/motor";
import { EditorFicha } from "@/features/treinos/EditarFicha";
import { CargaOuErro, SoComConta } from "./comuns";

/** Professor edita a ficha ativa do aluno ou monta uma nova a partir do perfil dele. */
export function FichaAluno() {
  return (
    <SoComConta titulo="Ficha do aluno">
      <Conteudo />
    </SoComConta>
  );
}

function Conteudo() {
  const { id = "" } = useParams();
  const { repo } = useAcademia();
  const carregar = useCallback(() => repo!.aluno(id), [repo, id]);
  const { estado, recarregar } = useCarga(carregar);
  return (
    <CargaOuErro estado={estado} tentar={recarregar}>
      {(a) => <Editor a={a} />}
    </CargaOuErro>
  );
}

function Editor({ a }: { a: DetalheAluno }) {
  const { repo } = useAcademia();
  // limitações e PAR-Q do aluno deixam o motor no modo conservador, como na ficha que o próprio aluno monta
  const params = useMemo(() => parametrosDoPerfil(a.perfil, null)!, [a.perfil]);
  const inicial = useMemo(
    () => a.plano ?? { ...gerarPlano(params, EXERCICIOS, () => crypto.randomUUID()), origem: "professor" as const },
    [a.plano, params],
  );
  const primeiroNome = a.perfil.nome.trim().split(/\s+/)[0];

  return (
    <EditorFicha
      inicial={inicial}
      params={a.plano?.parametros ?? params}
      voltarPara={`/professor/alunos/${a.id}`}
      titulo={a.plano ? `Ficha de ${primeiroNome}` : `Nova ficha para ${primeiroNome}`}
      subtitulo={a.plano ? "Ao salvar, a ficha fica marcada como revisada por você." : "Montada a partir do perfil do aluno. Ajuste o que precisar; ao salvar, ela vira a ficha ativa do aluno, já revisada por você."}
      rotuloSalvar={a.plano ? "Salvar ficha" : "Salvar e enviar ao aluno"}
      nova={!a.plano}
      salvar={(ficha) => repo!.salvarFichaDoAluno(a.id, ficha)}
    />
  );
}

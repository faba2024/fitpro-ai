import { ChevronDown, Dumbbell, Pencil, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { CATALOGO } from "@/data/catalogo";
import { parametrosDoPerfil } from "@/domain/ficha";
import { conferirPlano } from "@/domain/motor";
import { duracaoEstimadaMin, proximaSessao } from "@/domain/treino";
import type { PlanoSessao } from "@/domain/tipos";
import { AvisoExemplo } from "@/features/AvisoExemplo";
import { Carregando, ErroCarga } from "@/features/Estados";
import { ListaAvisos, SeloFicha, textoFaixa } from "./comuns";
import s from "./Treino.module.css";

export function PlanoSemanal() {
  const { estado, recarregar } = useDados();

  if (estado.status === "carregando") return <Carregando />;
  if (estado.status === "erro") return <ErroCarga mensagem={estado.mensagem} tentar={recarregar} />;

  const { plano, sessoes, perfil, perfilCompleto } = estado.dados;
  const params = plano?.parametros ?? parametrosDoPerfil(perfilCompleto, perfil);

  if (!plano) {
    return (
      <>
        <PageHeader titulo="Treino" />
        <Card>
          <EmptyState
            icone={<Dumbbell />}
            titulo="Monte seu treino"
            texto="O app monta sua divisão semanal a partir do seu objetivo, nível, tempo e equipamentos. Depois você pode trocar exercícios e ajustar tudo."
            acao={params ? <ButtonLink to="/treino/novo">Montar meu treino</ButtonLink> : <ButtonLink to="/perfil" variante="secundario">Completar perfil</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const proxima = proximaSessao(plano, sessoes);
  const avisos = params ? conferirPlano(plano, params, CATALOGO) : [];

  return (
    <div className={s.pagina}>
      <AvisoExemplo />
      <PageHeader
        titulo="Treino"
        subtitulo={`${plano.nome} · ${plano.sessoes.length} ${plano.sessoes.length === 1 ? "treino" : "treinos em rodízio"}`}
        acao={<ButtonLink to="/treino/editar" variante="secundario" icone={<Pencil />}>Editar</ButtonLink>}
      />
      <div className={s.selos}>
        <SeloFicha plano={plano} />
      </div>
      {plano.observacaoProfissional && <p className={s.observacao}><b>Observação do profissional:</b> {plano.observacaoProfissional}</p>}
      {plano.explicacao && <p className={s.explicacao}>{plano.explicacao}</p>}
      <ListaAvisos avisos={avisos} />

      <div className={s.lista}>
        {plano.sessoes.map((sessao) => (
          <Sessao key={sessao.id} sessao={sessao} proxima={sessao.id === proxima?.id} />
        ))}
      </div>

      <div className={s.rodape}>
        <ButtonLink to="/treino/novo" variante="fantasma" icone={<RefreshCw />}>Montar uma ficha nova</ButtonLink>
      </div>
      <p className={s.notaPequena}>
        A ficha é uma sugestão baseada em regras de treinamento e não substitui a avaliação de um profissional de educação física.
      </p>
    </div>
  );
}

function Sessao({ sessao, proxima }: { sessao: PlanoSessao; proxima: boolean }) {
  const [aberta, setAberta] = useState(proxima);
  const idCorpo = `sessao-${sessao.id}`;
  return (
    <Card as="article" className={proxima ? s.destaque : undefined}>
      <button type="button" className={s.cab} onClick={() => setAberta(!aberta)} aria-expanded={aberta} aria-controls={idCorpo}>
        <span className={s.letra} aria-hidden="true">{sessao.nome}</span>
        <span className={s.info}>
          <strong>{sessao.titulo}</strong>
          <span>{sessao.itens.length} exercícios · ~{duracaoEstimadaMin(sessao)} min</span>
        </span>
        {proxima && <Badge tom="destaque">Próximo</Badge>}
        <ChevronDown className={aberta ? `${s.seta} ${s.girada}` : s.seta} aria-hidden="true" />
      </button>
      {aberta && (
        <div id={idCorpo}>
          <ol className={s.itens}>
            {sessao.itens.map((it, i) => (
              <li key={`${it.exercicioId}-${i}`}>
                {CATALOGO.has(it.exercicioId) ? (
                  <Link to={`/exercicios/${it.exercicioId}`} className={`${s.nome} ${s.link}`}>{it.nome}</Link>
                ) : (
                  <span className={s.nome}>{it.nome}</span>
                )}
                <span className={s.meta}>{textoFaixa(it)}</span>
              </li>
            ))}
          </ol>
          {proxima && <ButtonLink to="/treino/sessao" bloco icone={<Play />}>Iniciar este treino</ButtonLink>}
        </div>
      )}
    </Card>
  );
}

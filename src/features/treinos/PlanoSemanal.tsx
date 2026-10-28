import { ChevronDown, Dumbbell, Play } from "lucide-react";
import { useState } from "react";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, ButtonLink, Card, EmptyState } from "@/components/ui";
import { duracaoEstimadaMin, proximaSessao } from "@/domain/treino";
import type { PlanoSessao } from "@/domain/tipos";
import { AvisoExemplo } from "@/features/AvisoExemplo";
import { Carregando, ErroCarga } from "@/features/Estados";
import s from "./PlanoSemanal.module.css";

export function PlanoSemanal() {
  const { estado, recarregar } = useDados();

  if (estado.status === "carregando") return <Carregando />;
  if (estado.status === "erro") return <ErroCarga mensagem={estado.mensagem} tentar={recarregar} />;

  const { plano, sessoes } = estado.dados;
  if (!plano) {
    return (
      <>
        <PageHeader titulo="Treino" />
        <Card>
          <EmptyState
            icone={<Dumbbell />}
            titulo="Você ainda não tem uma ficha"
            texto="O criador de treinos (etapa 7) vai montar sua divisão semanal a partir do seu objetivo, nível, tempo e equipamentos."
            acao={<ButtonLink to="/" variante="secundario">Voltar ao início</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  const proxima = proximaSessao(plano, sessoes);

  return (
    <div className={s.pagina}>
      <AvisoExemplo />
      <PageHeader titulo="Treino" subtitulo={`${plano.nome} · ${plano.sessoes.length} sessões em rodízio`} />
      <div className={s.lista}>
        {plano.sessoes.map((sessao) => (
          <Sessao key={sessao.id} sessao={sessao} proxima={sessao.id === proxima?.id} />
        ))}
      </div>
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
            {sessao.itens.map((it) => (
              <li key={it.exercicioId}>
                <span className={s.nome}>{it.nome}</span>
                <span className={s.meta}>
                  {it.series} × {it.repsMin === it.repsMax ? it.repsMin : `${it.repsMin}–${it.repsMax}`} · descanso {it.descansoS}s
                </span>
              </li>
            ))}
          </ol>
          {proxima && <ButtonLink to="/treino/sessao" bloco icone={<Play />}>Iniciar este treino</ButtonLink>}
        </div>
      )}
    </Card>
  );
}

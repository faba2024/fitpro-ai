import { AlertTriangle, ClipboardCheck, Pencil, Wand2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useParams } from "react-router";
import { useAcademia, useCarga } from "@/app/academia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink, Card, CampoTexto, EmptyState } from "@/components/ui";
import type { DetalheAluno } from "@/data/academia";
import { EQUIPAMENTOS, NIVEIS, OBJETIVOS, PARQ, type PerguntaParq } from "@/domain/tipos";
import { SeloFicha, textoFaixa } from "@/features/treinos/comuns";
import { CargaOuErro, dataCurta, SoComConta } from "./comuns";
import s from "./Academia.module.css";

export function AlunoDetalhe() {
  return (
    <SoComConta titulo="Aluno">
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
      {(a) => <Detalhe a={a} recarregar={recarregar} />}
    </CargaOuErro>
  );
}

function Detalhe({ a, recarregar }: { a: DetalheAluno; recarregar: () => void }) {
  const p = a.perfil;
  const sim = (Object.keys(PARQ) as PerguntaParq[]).filter((k) => p.parq[k]);
  const peso = a.medidas.find((m) => m.pesoKg != null);

  return (
    <div className={s.pagina}>
      <PageHeader titulo={p.nome} subtitulo={`${OBJETIVOS[p.objetivo]} · ${NIVEIS[p.nivel]}`} acao={<ButtonLink to="/professor" variante="secundario">Voltar</ButtonLink>} />

      {(sim.length > 0 || p.limitacoes.trim()) && (
        <div className={s.alerta} role="note">
          <AlertTriangle aria-hidden="true" />
          <div>
            {sim.length > 0 && (
              <>
                <p><b>Respondeu “sim” no questionário de prontidão (PAR-Q).</b> Antes de aumentar a intensidade, confirme se há liberação médica.</p>
                <ul>{sim.map((k) => <li key={k}>{PARQ[k]}</li>)}</ul>
              </>
            )}
            {p.limitacoes.trim() && <p><b>Limitações informadas:</b> {p.limitacoes}</p>}
          </div>
        </div>
      )}

      <Card titulo="Perfil">
        <dl className={s.dados}>
          <dt>Rotina</dt><dd>{p.diasSemana}×/semana, {p.minutosSessao} min por treino</dd>
          <dt>Equipamentos</dt><dd>{p.equipamentos.map((e) => EQUIPAMENTOS[e]).join(", ") || "Nenhum informado"}</dd>
          <dt>Altura</dt><dd>{String(p.alturaCm).replace(".", ",")} cm</dd>
          <dt>Peso</dt><dd>{peso ? `${String(peso.pesoKg).replace(".", ",")} kg (${dataCurta(`${peso.data}T12:00:00`)})` : `${String(p.pesoKg).replace(".", ",")} kg (cadastro)`}</dd>
          {p.metaPesoKg != null && (<><dt>Meta de peso</dt><dd>{String(p.metaPesoKg).replace(".", ",")} kg</dd></>)}
        </dl>
      </Card>

      <FichaDoAluno a={a} recarregar={recarregar} />

      <Card titulo="Últimos treinos">
        {a.sessoes.length ? (
          <ul className={s.lista}>
            {a.sessoes.slice(0, 10).map((t) => (
              <li key={t.id}>
                <div className={s.info}>
                  <strong>{t.titulo}</strong>
                  <span>
                    {new Date(t.iniciadaEm).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} · {t.seriesConcluidas} séries · {Math.round(t.volumeKg).toLocaleString("pt-BR")} kg de volume
                    {t.status !== "concluida" ? " · incompleto" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.nota}>Nenhum treino registrado ainda.</p>
        )}
      </Card>
    </div>
  );
}

function FichaDoAluno({ a, recarregar }: { a: DetalheAluno; recarregar: () => void }) {
  const { repo } = useAcademia();
  const plano = a.plano;
  const [obs, setObs] = useState(plano?.observacaoProfissional ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!plano) {
    return (
      <Card titulo="Ficha">
        <EmptyState
          icone={<Wand2 />}
          titulo="Sem ficha ativa"
          texto="Monte uma ficha a partir do perfil do aluno. Você revisa e ajusta cada exercício antes de salvar."
          acao={<ButtonLink to={`/professor/alunos/${a.id}/ficha`}>Montar ficha</ButtonLink>}
        />
      </Card>
    );
  }

  async function revisar() {
    setEnviando(true);
    setErro(null);
    try {
      await repo!.revisarFicha(plano!.id, obs);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível marcar como revisada.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card titulo={`Ficha: ${plano.nome}`} acao={<ButtonLink to={`/professor/alunos/${a.id}/ficha`} variante="fantasma" icone={<Pencil />}>Editar</ButtonLink>}>
      <div className={s.form}>
        <div className={s.selos}><SeloFicha plano={plano} /></div>
        <ul className={s.ficha}>
          {plano.sessoes.map((sessao) => (
            <li key={sessao.id}>
              <h3>{sessao.nome} · {sessao.titulo}</h3>
              <ol>{sessao.itens.map((it, i) => <li key={`${it.exercicioId}-${i}`}><b>{it.nome}</b> — {textoFaixa(it)}</li>)}</ol>
            </li>
          ))}
        </ul>
        <CampoTexto
          rotulo="Observação para o aluno"
          dica="Aparece na tela de treino do aluno. Opcional."
          value={obs}
          maxLength={2000}
          rows={3}
          onChange={(e) => setObs(e.target.value)}
        />
        {erro && <p className={s.erro} role="alert">{erro}</p>}
        <div>
          <Button icone={<ClipboardCheck />} onClick={() => void revisar()} disabled={enviando}>
            {enviando ? "Salvando…" : plano.revisadoEm ? "Revisar de novo" : "Marcar como revisada"}
          </Button>
        </div>
        <p className={s.nota}>Se o aluno mudar a ficha depois, a revisão é desfeita automaticamente e ela volta para a sua lista.</p>
      </div>
    </Card>
  );
}

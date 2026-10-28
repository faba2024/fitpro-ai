import { ArrowDown, ArrowUp, Equal, House, Trophy } from "lucide-react";
import { Navigate } from "react-router";
import { useTreino } from "@/app/treinoAtivo";
import { Badge, ButtonLink, Card } from "@/components/ui";
import s from "./ModoTreino.module.css";

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const ICONE = { subir: ArrowUp, manter: Equal, reduzir: ArrowDown, definir: Equal } as const;

/** Resumo do último treino concluído (guardado no aparelho: sobrevive a recarregar a página). */
export function Resumo() {
  const { ultimoResultado, sync, treino } = useTreino();
  if (treino) return <Navigate to="/treino/sessao" replace />;
  if (!ultimoResultado) return <Navigate to="/treino" replace />;
  const { sessao, resumo } = ultimoResultado;

  return (
    <div className={s.pagina} style={{ paddingBottom: 24 }}>
      <h1 className={s.titulo}>Treino concluído</h1>
      <p className={s.mini}>
        {sessao.letra} · {sessao.titulo} · {new Date(sessao.iniciadaEm).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className={s.numeros}>
        <div><strong>{resumo.duracaoMin} min</strong><span>de treino</span></div>
        <div><strong>{resumo.seriesFeitas}</strong><span>séries</span></div>
        <div><strong>{fmt.format(resumo.volumeKg)} kg</strong><span>de volume</span></div>
        <div><strong>{resumo.recordes}</strong><span>{resumo.recordes === 1 ? "recorde" : "recordes"}</span></div>
      </div>

      <Card titulo="Exercícios">
        <ul className={s.listaResumo}>
          {resumo.exercicios.map((e) => {
            const Icone = e.proxima ? ICONE[e.proxima.acao] : null;
            return (
              <li key={e.exercicioId}>
                <div className={s.linhaResumo}>
                  <strong>{e.nome}</strong>
                  {e.recorde && <Badge tom="sucesso"><Trophy aria-hidden="true" style={{ width: 13, height: 13 }} /> Recorde</Badge>}
                </div>
                <span className={s.mini}>
                  {e.seriesFeitas} {e.seriesFeitas === 1 ? "série" : "séries"}
                  {e.melhor && e.melhor.cargaKg > 0 ? ` · melhor: ${fmt.format(e.melhor.cargaKg)} kg × ${e.melhor.reps}` : e.melhor ? ` · melhor: ${e.melhor.reps}` : ""}
                </span>
                {e.proxima && Icone && (
                  <span className={s.proxima}><Icone aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: -2 }} /> Próxima vez: {e.proxima.motivo}</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <p className={sync === "pendente" ? `${s.sync} ${s.syncAlerta}` : s.sync}>
        {sync === "pendente" ? "Sem conexão: o treino está salvo neste aparelho e será enviado quando a internet voltar." : sync === "enviando" ? "Enviando para sua conta…" : "Treino salvo."}
      </p>
      <ButtonLink to="/" bloco icone={<House />}>Voltar ao início</ButtonLink>
    </div>
  );
}

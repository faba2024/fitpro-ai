import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui";
import { CATALOGO } from "@/data/catalogo";
import { GRUPOS } from "@/domain/exercicios";
import { avaliarVolume, GRUPOS_VOLUME, LIMITES_VOLUME, treinosPorSemana, volumeSemanal, type Aviso } from "@/domain/motor";
import type { ItemPlano, Nivel, Plano } from "@/domain/tipos";
import s from "./Treino.module.css";

const ICONE = { erro: CircleAlert, alerta: TriangleAlert, info: Info } as const;
const CLASSE = { erro: s.avisoErro, alerta: s.avisoAlerta, info: s.avisoInfo } as const;

export function ListaAvisos({ avisos }: { avisos: Aviso[] }) {
  if (!avisos.length) return null;
  return (
    <ul className={s.avisos} aria-label="Avisos da ficha">
      {avisos.map((a, i) => {
        const Icone = ICONE[a.nivel];
        return (
          <li key={i} className={CLASSE[a.nivel]}>
            <Icone aria-hidden="true" />
            <span>{a.texto}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function TabelaVolume({ plano, diasSemana, nivel }: { plano: Plano; diasSemana: number; nivel: Nivel }) {
  const vol = volumeSemanal(plano, treinosPorSemana(diasSemana, nivel), CATALOGO);
  const status = avaliarVolume(vol, nivel);
  const { min, max } = LIMITES_VOLUME[nivel];
  return (
    <div>
      <table className={s.volume}>
        <caption>Séries por semana em cada grupo (recomendado para o seu nível: {min} a {max})</caption>
        <thead>
          <tr><th scope="col">Grupo</th><th scope="col">Séries</th><th scope="col">Situação</th></tr>
        </thead>
        <tbody>
          {GRUPOS_VOLUME.map((g) => {
            const st = status.get(g)!;
            return (
              <tr key={g}>
                <th scope="row">{GRUPOS[g].rotulo}</th>
                <td>{String(vol.get(g) ?? 0).replace(".", ",")}</td>
                <td>{g === "abdomen" ? <Badge>Livre</Badge> : <Badge tom={st === "ok" ? "sucesso" : st === "alto" ? "perigo" : "alerta"}>{st === "ok" ? "Na faixa" : st === "alto" ? "Acima" : "Abaixo"}</Badge>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={s.notaPequena}>Exercícios em que o grupo é secundário contam meia série.</p>
    </div>
  );
}

export function textoFaixa(it: ItemPlano): string {
  const faixa = it.repsMin === it.repsMax ? `${it.repsMin}` : `${it.repsMin}–${it.repsMax}`;
  return `${it.series} × ${faixa}${it.porTempo ? " s" : ""} · descanso ${it.descansoS}s${it.cargaKg != null ? ` · ${String(it.cargaKg).replace(".", ",")} kg` : ""}`;
}

/** Selo de origem e revisão da ficha. */
export function SeloFicha({ plano }: { plano: Plano }) {
  if (plano.revisadoEm) {
    return <Badge tom="sucesso">Revisada por profissional em {new Date(plano.revisadoEm).toLocaleDateString("pt-BR")}</Badge>;
  }
  return <Badge tom="alerta">{plano.origem === "professor" ? "Montada por professor · aguardando revisão" : plano.origem === "manual" ? "Editada por você · não revisada" : "Montada pelo app · não revisada"}</Badge>;
}

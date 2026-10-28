import type { Exercicio } from "@/domain/exercicios";
import { MapaCorpo } from "./MapaCorpo";
import s from "./Anatomia.module.css";

/** Frente e costas lado a lado, com músculos principais (forte) e secundários (leve) do exercício. */
export function MapaExercicio({ ex }: { ex: Exercicio }) {
  const principais = new Set(ex.musculosPrincipais);
  const secundarios = new Set(ex.musculosSecundarios);
  return (
    <div>
      <div className={s.duplo}>
        <figure>
          <MapaCorpo vista="frente" principais={principais} secundarios={secundarios} />
          <figcaption>Frente</figcaption>
        </figure>
        <figure>
          <MapaCorpo vista="costas" principais={principais} secundarios={secundarios} />
          <figcaption>Costas</figcaption>
        </figure>
      </div>
      <div className={s.legenda} aria-hidden="true">
        <span><i className={s.corPrincipal} /> Principal</span>
        <span><i className={s.corSecundario} /> Secundário</span>
      </div>
    </div>
  );
}

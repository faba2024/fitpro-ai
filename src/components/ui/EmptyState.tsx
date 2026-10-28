import type { ReactNode } from "react";
import s from "./EmptyState.module.css";

interface Props {
  icone?: ReactNode;
  titulo: string;
  texto?: ReactNode;
  acao?: ReactNode;
}

export function EmptyState({ icone, titulo, texto, acao }: Props) {
  return (
    <div className={s.vazio}>
      {icone && <div className={s.icone} aria-hidden="true">{icone}</div>}
      <h2 className={s.titulo}>{titulo}</h2>
      {texto && <p className={s.texto}>{texto}</p>}
      {acao && <div className={s.acao}>{acao}</div>}
    </div>
  );
}

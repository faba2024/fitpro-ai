import type { ReactNode } from "react";
import s from "./EmptyState.module.css";

interface Props {
  icone?: ReactNode;
  titulo: string;
  texto?: ReactNode;
  acao?: ReactNode;
  /** 1 quando o estado vazio é a página inteira (ex.: 404) */
  nivel?: 1 | 2;
}

export function EmptyState({ icone, titulo, texto, acao, nivel = 2 }: Props) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <div className={s.vazio}>
      {icone && <div className={s.icone} aria-hidden="true">{icone}</div>}
      <Titulo className={s.titulo}>{titulo}</Titulo>
      {texto && <p className={s.texto}>{texto}</p>}
      {acao && <div className={s.acao}>{acao}</div>}
    </div>
  );
}

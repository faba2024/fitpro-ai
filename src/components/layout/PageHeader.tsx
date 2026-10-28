import type { ReactNode } from "react";
import s from "./PageHeader.module.css";

export function PageHeader({ titulo, subtitulo, acao }: { titulo: string; subtitulo?: ReactNode; acao?: ReactNode }) {
  return (
    <header className={s.cab}>
      <div>
        <h1 className={s.titulo}>{titulo}</h1>
        {subtitulo && <p className={s.sub}>{subtitulo}</p>}
      </div>
      {acao}
    </header>
  );
}

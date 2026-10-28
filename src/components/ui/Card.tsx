import type { HTMLAttributes, ReactNode } from "react";
import s from "./Card.module.css";

interface Props extends HTMLAttributes<HTMLElement> {
  titulo?: ReactNode;
  acao?: ReactNode;
  as?: "section" | "div" | "article";
}

export function Card({ titulo, acao, as: Tag = "section", className, children, ...props }: Props) {
  return (
    <Tag className={[s.card, className].filter(Boolean).join(" ")} {...props}>
      {(titulo || acao) && (
        <header className={s.cab}>
          {titulo && <h2 className={s.titulo}>{titulo}</h2>}
          {acao}
        </header>
      )}
      {children}
    </Tag>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import s from "./Button.module.css";

type Variante = "primario" | "secundario" | "fantasma";

interface Base {
  variante?: Variante;
  icone?: ReactNode;
  bloco?: boolean;
}

const classes = (v: Variante, bloco?: boolean, extra?: string) =>
  [s.btn, s[v], bloco && s.bloco, extra].filter(Boolean).join(" ");

export function Button({ variante = "primario", icone, bloco, className, children, ...props }: Base & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={classes(variante, bloco, className)} {...props}>
      {icone}
      {children}
    </button>
  );
}

export function ButtonLink({ variante = "primario", icone, bloco, className, children, ...props }: Base & LinkProps) {
  return (
    <Link className={classes(variante, bloco, className)} {...props}>
      {icone}
      {children}
    </Link>
  );
}

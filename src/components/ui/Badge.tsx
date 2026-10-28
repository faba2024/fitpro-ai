import type { ReactNode } from "react";
import s from "./Badge.module.css";

export type Tom = "neutro" | "destaque" | "sucesso" | "alerta" | "perigo";

export function Badge({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return <span className={`${s.badge} ${s[tom]}`}>{children}</span>;
}

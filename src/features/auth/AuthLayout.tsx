import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import s from "./Auth.module.css";

export function AuthLayout({ titulo, subtitulo, children, rodape }: { titulo: string; subtitulo?: string; children: ReactNode; rodape?: ReactNode }) {
  return (
    <main className={s.tela}>
      <div className={s.caixa}>
        <div className={s.marca}>
          <Logo />
          <p>Seu treino, sua evolução.</p>
        </div>
        <section className={s.card} aria-labelledby="auth-titulo">
          <h1 id="auth-titulo" className={s.titulo}>{titulo}</h1>
          {subtitulo && <p className={s.sub}>{subtitulo}</p>}
          {children}
        </section>
        {rodape && <p className={s.rodape}>{rodape}</p>}
      </div>
    </main>
  );
}

export function Alerta({ tom = "erro", children }: { tom?: "erro" | "sucesso"; children: ReactNode }) {
  return (
    <div className={tom === "erro" ? s.alertaErro : s.alertaOk} role={tom === "erro" ? "alert" : "status"}>
      {children}
    </div>
  );
}

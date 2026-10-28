import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import s from "./Campo.module.css";

interface Base {
  rotulo: string;
  erro?: string;
  dica?: ReactNode;
}

/** Campo de texto com rótulo, dica e erro ligados por aria-describedby. */
export function Campo({ rotulo, erro, dica, className, ...props }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const desc = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={[s.campo, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={s.rotulo}>{rotulo}</label>
      <input id={id} className={erro ? `${s.input} ${s.invalido}` : s.input} aria-invalid={!!erro} aria-describedby={desc} {...props} />
      {dica && <p id={`${id}-dica`} className={s.dica}>{dica}</p>}
      {erro && <p id={`${id}-erro`} className={s.erro} role="alert">{erro}</p>}
    </div>
  );
}

export function CampoTexto({ rotulo, erro, dica, ...props }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const desc = [dica && `${id}-dica`, erro && `${id}-erro`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={s.campo}>
      <label htmlFor={id} className={s.rotulo}>{rotulo}</label>
      <textarea id={id} className={erro ? `${s.input} ${s.area} ${s.invalido}` : `${s.input} ${s.area}`} aria-invalid={!!erro} aria-describedby={desc} {...props} />
      {dica && <p id={`${id}-dica`} className={s.dica}>{dica}</p>}
      {erro && <p id={`${id}-erro`} className={s.erro} role="alert">{erro}</p>}
    </div>
  );
}

/** Grupo de escolhas (radio ou checkbox) com legenda e erro. */
export function Grupo({ legenda, erro, children, dica }: { legenda: string; erro?: string; dica?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className={s.grupo}>
      <legend className={s.rotulo}>{legenda}</legend>
      {dica && <p className={s.dica}>{dica}</p>}
      {children}
      {erro && <p className={s.erro} role="alert">{erro}</p>}
    </fieldset>
  );
}

export function Opcao({ tipo = "radio", rotulo, descricao, ...props }: { tipo?: "radio" | "checkbox"; rotulo: string; descricao?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={s.opcao}>
      <input type={tipo} {...props} />
      <span>
        <strong>{rotulo}</strong>
        {descricao && <small>{descricao}</small>}
      </span>
    </label>
  );
}

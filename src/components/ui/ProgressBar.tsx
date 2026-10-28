import s from "./ProgressBar.module.css";

interface Props {
  valor: number;
  max?: number;
  rotulo: string;
}

export function ProgressBar({ valor, max = 100, rotulo }: Props) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (valor / max) * 100)) : 0;
  return (
    <div className={s.trilho} role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={max} aria-valuenow={valor}>
      <div className={s.barra} style={{ width: `${pct}%` }} />
    </div>
  );
}

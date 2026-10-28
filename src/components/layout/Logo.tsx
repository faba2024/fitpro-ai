import { Link } from "react-router";
import s from "./Logo.module.css";

export function Logo({ compacto }: { compacto?: boolean }) {
  return (
    <Link to="/" className={s.logo} aria-label="FitPro AI, início">
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <path d="M6 5h28v14c0 9-6.5 14.5-14 16C12.5 33.5 6 28 6 19z" fill="var(--accent)" />
        <path d="M14 13h13M14 13v14M14 20h9" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </svg>
      {!compacto && (
        <span className={s.texto}>
          FitPro <b>AI</b>
        </span>
      )}
    </Link>
  );
}

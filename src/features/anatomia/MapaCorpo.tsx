import { useMemo, type KeyboardEvent } from "react";
import { MUSCULOS, type Musculo } from "@/domain/exercicios";
import { ALTURA, CABECA, caminhos, LARGURA, SILHUETA, type Vista } from "./regioes";
import s from "./Anatomia.module.css";

interface Props {
  vista: Vista;
  /** músculos em destaque forte (selecionado ou principais do exercício) */
  principais?: ReadonlySet<Musculo>;
  /** destaque leve (secundários) */
  secundarios?: ReadonlySet<Musculo>;
  /** quando informado, cada músculo vira um botão */
  aoSelecionar?: (m: Musculo) => void;
  className?: string;
}

const VAZIO: ReadonlySet<Musculo> = new Set();

export function MapaCorpo({ vista, principais = VAZIO, secundarios = VAZIO, aoSelecionar, className }: Props) {
  const regioes = useMemo(() => caminhos(vista), [vista]);
  const interativo = !!aoSelecionar;
  const rotulo = `Corpo humano, vista de ${vista === "frente" ? "frente" : "costas"}`;

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className={[s.mapa, className].filter(Boolean).join(" ")}
      role={interativo ? "group" : "img"}
      aria-label={interativo ? rotulo : `${rotulo}${principais.size ? `; destaque em ${[...principais].map((m) => MUSCULOS[m]).join(", ")}` : ""}`}
    >
      <ellipse {...CABECA} className={s.silhueta} />
      <rect x={92} y={48} width={16} height={14} rx={4} className={s.silhueta} />
      <path d={SILHUETA} className={s.silhueta} />
      {regioes.map(([m, ds]) => {
        const classe = principais.has(m) ? s.principal : secundarios.has(m) ? s.secundario : s.musculo;
        if (!interativo) return <g key={m} className={classe}>{ds.map((d, i) => <path key={i} d={d} />)}</g>;
        const ativo = principais.has(m);
        return (
          <g
            key={m}
            className={`${classe} ${s.clicavel}`}
            role="button"
            tabIndex={0}
            aria-label={MUSCULOS[m]}
            aria-pressed={ativo}
            onClick={() => aoSelecionar(m)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                aoSelecionar(m);
              }
            }}
          >
            <title>{MUSCULOS[m]}</title>
            {ds.map((d, i) => <path key={i} d={d} />)}
          </g>
        );
      })}
    </svg>
  );
}

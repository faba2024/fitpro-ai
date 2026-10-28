import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { escalaY } from "./escala";
import s from "./Graficos.module.css";

export interface PontoGrafico {
  /** rótulo do eixo X (ex.: "12/10") */
  rotulo: string;
  valor: number;
  /** texto completo para a dica e a tabela (ex.: "12 de out.") */
  detalhe?: string;
}

interface Base {
  /** título curto: nomeia a série (com uma série só, não há legenda) */
  titulo: string;
  pontos: PontoGrafico[];
  formatar: (v: number) => string;
  /** linha de referência (meta), em cinza tracejado */
  referencia?: { valor: number; rotulo: string };
  altura?: number;
}

const MARGEM = { topo: 14, direita: 12, base: 26, esquerda: 44 };

/** Largura do contêiner, acompanhando mudanças de tamanho. */
function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(240, el.clientWidth));
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, largura] as const;
}

/** Quais rótulos do eixo X mostrar sem sobrepor (sempre o primeiro e o último). */
function indicesRotulo(n: number, largura: number): Set<number> {
  const cabem = Math.max(2, Math.floor(largura / 56));
  if (n <= cabem) return new Set(Array.from({ length: n }, (_, i) => i));
  const passo = Math.ceil((n - 1) / (cabem - 1));
  const r = new Set<number>([0, n - 1]);
  for (let i = passo; i < n - 1; i += passo) if (n - 1 - i >= passo / 2) r.add(i);
  return r;
}

function TabelaDados({ titulo, pontos, formatar }: Pick<Base, "titulo" | "pontos" | "formatar">) {
  return (
    <details className={s.tabela}>
      <summary>Ver dados em tabela</summary>
      <table>
        <caption className="sr-only">{titulo}</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">{titulo}</th></tr></thead>
        <tbody>
          {pontos.map((p, i) => <tr key={i}><th scope="row">{p.detalhe ?? p.rotulo}</th><td>{formatar(p.valor)}</td></tr>)}
        </tbody>
      </table>
    </details>
  );
}

function Dica({ x, y, largura, ponto, formatar }: { x: number; y: number; largura: number; ponto: PontoGrafico; formatar: (v: number) => string }) {
  // mantém a dica dentro do gráfico
  const esquerda = Math.min(Math.max(x, 60), largura - 60);
  return (
    <div className={s.dica} style={{ left: esquerda, top: y }} role="status">
      <strong>{formatar(ponto.valor)}</strong>
      <span>{ponto.detalhe ?? ponto.rotulo}</span>
    </div>
  );
}

/** Teclado: setas movem o ponto ativo, Home/End vão aos extremos, Esc limpa. */
function useNavegacao(n: number) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const teclado = (e: KeyboardEvent) => {
    if (!n) return;
    const mapa: Record<string, () => number | null> = {
      ArrowRight: () => Math.min(n - 1, (ativo ?? -1) + 1),
      ArrowLeft: () => Math.max(0, (ativo ?? n) - 1),
      Home: () => 0,
      End: () => n - 1,
      Escape: () => null,
    };
    const f = mapa[e.key];
    if (f) {
      e.preventDefault();
      setAtivo(f());
    }
  };
  return { ativo, setAtivo, teclado };
}

export function GraficoLinha({ titulo, pontos, formatar, referencia, altura = 200 }: Base) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const { ativo, setAtivo, teclado } = useNavegacao(pontos.length);
  const idDesc = useId();
  const w = largura - MARGEM.esquerda - MARGEM.direita;
  const h = altura - MARGEM.topo - MARGEM.base;
  const valores = pontos.map((p) => p.valor).concat(referencia ? [referencia.valor] : []);
  const esc = escalaY(valores);
  const x = (i: number) => MARGEM.esquerda + (pontos.length <= 1 ? w / 2 : (i / (pontos.length - 1)) * w);
  const y = (v: number) => MARGEM.topo + h - ((v - esc.min) / (esc.max - esc.min || 1)) * h;
  const rotulos = indicesRotulo(pontos.length, w);
  const caminho = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const ultimo = pontos.length - 1;

  function mover(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let melhor = 0;
    for (let i = 1; i < pontos.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i;
    setAtivo(melhor);
  }

  return (
    <figure className={s.figura}>
      <div ref={ref} className={s.area}>
        <svg
          width={largura}
          height={altura}
          role="img"
          tabIndex={0}
          aria-label={`${titulo}: gráfico de linha com ${pontos.length} pontos. Use as setas para percorrer.`}
          aria-describedby={idDesc}
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={() => setAtivo(null)}
          onKeyDown={teclado}
          onBlur={() => setAtivo(null)}
          className={s.svg}
        >
          {esc.ticks.map((t) => (
            <g key={t}>
              <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(t)} y2={y(t)} className={s.grade} />
              <text x={MARGEM.esquerda - 8} y={y(t)} className={s.eixoY} dominantBaseline="middle" textAnchor="end">{formatar(t)}</text>
            </g>
          ))}
          {referencia && (
            <g>
              <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(referencia.valor)} y2={y(referencia.valor)} className={s.referencia} />
              <text x={largura - MARGEM.direita} y={y(referencia.valor) - 5} textAnchor="end" className={s.rotuloRef}>{referencia.rotulo}</text>
            </g>
          )}
          {pontos.map((p, i) =>
            rotulos.has(i) ? (
              <text key={i} x={x(i)} y={altura - 8} className={s.eixoX} textAnchor={i === 0 && pontos.length > 1 ? "start" : i === ultimo && pontos.length > 1 ? "end" : "middle"}>
                {p.rotulo}
              </text>
            ) : null,
          )}
          <path d={caminho} className={s.linha} />
          {pontos.length > 0 && <circle cx={x(ultimo)} cy={y(pontos[ultimo]!.valor)} r={4} className={s.marcador} />}
          {ativo != null && pontos[ativo] && (
            <g>
              <line x1={x(ativo)} x2={x(ativo)} y1={MARGEM.topo} y2={MARGEM.topo + h} className={s.mira} />
              <circle cx={x(ativo)} cy={y(pontos[ativo].valor)} r={5} className={s.marcador} />
            </g>
          )}
        </svg>
        {ativo != null && pontos[ativo] && <Dica x={x(ativo)} y={y(pontos[ativo].valor)} largura={largura} ponto={pontos[ativo]} formatar={formatar} />}
      </div>
      <figcaption id={idDesc} className={s.legenda}>
        {pontos.length ? <>Último: <strong>{formatar(pontos[ultimo]!.valor)}</strong>{pontos[ultimo]!.detalhe ? ` em ${pontos[ultimo]!.detalhe}` : ""}</> : "Sem dados no período."}
      </figcaption>
      <TabelaDados titulo={titulo} pontos={pontos} formatar={formatar} />
    </figure>
  );
}

export function GraficoBarras({ titulo, pontos, formatar, referencia, altura = 180 }: Base) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const { ativo, setAtivo, teclado } = useNavegacao(pontos.length);
  const idDesc = useId();
  const w = largura - MARGEM.esquerda - MARGEM.direita;
  const h = altura - MARGEM.topo - MARGEM.base;
  const esc = escalaY(pontos.map((p) => p.valor).concat(referencia ? [referencia.valor] : []), { zero: true });
  const faixa = w / Math.max(1, pontos.length);
  // barras finas, com 2px de folga entre elas
  const larguraBarra = Math.max(4, Math.min(28, faixa - 2));
  const x = (i: number) => MARGEM.esquerda + i * faixa + (faixa - larguraBarra) / 2;
  const y = (v: number) => MARGEM.topo + h - ((v - esc.min) / (esc.max - esc.min || 1)) * h;
  const base = y(0);
  const rotulos = indicesRotulo(pontos.length, w);

  /** retângulo com cantos de 4px arredondados só no topo (a base fica presa ao eixo) */
  function barra(i: number, v: number) {
    const x0 = x(i);
    const topo = y(v);
    const altBarra = base - topo;
    if (altBarra <= 0) return "";
    const r = Math.min(4, larguraBarra / 2, altBarra);
    return `M${x0},${base} V${topo + r} Q${x0},${topo} ${x0 + r},${topo} H${x0 + larguraBarra - r} Q${x0 + larguraBarra},${topo} ${x0 + larguraBarra},${topo + r} V${base} Z`;
  }

  return (
    <figure className={s.figura}>
      <div ref={ref} className={s.area}>
        <svg
          width={largura}
          height={altura}
          role="img"
          tabIndex={0}
          aria-label={`${titulo}: gráfico de barras com ${pontos.length} barras. Use as setas para percorrer.`}
          aria-describedby={idDesc}
          onKeyDown={teclado}
          onBlur={() => setAtivo(null)}
          onPointerLeave={() => setAtivo(null)}
          className={s.svg}
        >
          {esc.ticks.map((t) => (
            <g key={t}>
              <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(t)} y2={y(t)} className={s.grade} />
              <text x={MARGEM.esquerda - 8} y={y(t)} className={s.eixoY} dominantBaseline="middle" textAnchor="end">{formatar(t)}</text>
            </g>
          ))}
          {pontos.map((p, i) => (
            <g key={i}>
              <path d={barra(i, p.valor)} className={i === ativo ? `${s.barra} ${s.barraAtiva}` : s.barra} />
              {/* área de toque maior que a barra */}
              <rect x={MARGEM.esquerda + i * faixa} y={MARGEM.topo} width={faixa} height={h} fill="transparent" onPointerEnter={() => setAtivo(i)} onPointerDown={() => setAtivo(i)} />
              {rotulos.has(i) && <text x={x(i) + larguraBarra / 2} y={altura - 8} className={s.eixoX} textAnchor="middle">{p.rotulo}</text>}
            </g>
          ))}
          {referencia && (
            <g pointerEvents="none">
              <line x1={MARGEM.esquerda} x2={largura - MARGEM.direita} y1={y(referencia.valor)} y2={y(referencia.valor)} className={s.referencia} />
              <text x={largura - MARGEM.direita} y={y(referencia.valor) - 5} textAnchor="end" className={s.rotuloRef}>{referencia.rotulo}</text>
            </g>
          )}
        </svg>
        {ativo != null && pontos[ativo] && <Dica x={x(ativo) + larguraBarra / 2} y={y(pontos[ativo].valor)} largura={largura} ponto={pontos[ativo]} formatar={formatar} />}
      </div>
      <figcaption id={idDesc} className={s.legenda}>
        {pontos.length ? <>Média: <strong>{formatar(Math.round((pontos.reduce((t, p) => t + p.valor, 0) / pontos.length) * 10) / 10)}</strong> por semana</> : "Sem dados no período."}
      </figcaption>
      <TabelaDados titulo={titulo} pontos={pontos} formatar={formatar} />
    </figure>
  );
}

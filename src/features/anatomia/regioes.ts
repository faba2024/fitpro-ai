// Desenho próprio do corpo (viewBox 200×420), estilizado e simétrico.
// Cada forma é descrita só do lado direito da figura (x ≥ 100) e espelhada em x = 100;
// os pontos viram curvas suaves (Catmull-Rom → Bézier).
import type { Musculo } from "@/domain/exercicios";

export type Vista = "frente" | "costas";
type Ponto = readonly [number, number];

export const LARGURA = 200;
export const ALTURA = 420;

/** Contorno de metade do corpo, do pescoço ao meio das pernas (sentido horário). */
const CONTORNO: Ponto[] = [
  [100, 56], [109, 58], [122, 64], [140, 68], [150, 80], [154, 100], [157, 128], [158, 150],
  [162, 178], [165, 205], [167, 220], [170, 238], [164, 246], [157, 238], [153, 215], [147, 188],
  [141, 160], [137, 132], [134, 112], [133, 150], [128, 182], [133, 205], [138, 240], [137, 282],
  [132, 316], [134, 345], [130, 375], [124, 398], [131, 410], [120, 414], [108, 410], [110, 392],
  [108, 360], [106, 320], [105, 285], [103, 248], [100, 232],
];

/** Formas de músculo por vista (lado direito). Um músculo pode ter várias formas. */
const FORMAS: Record<Vista, Partial<Record<Musculo, Ponto[][]>>> = {
  frente: {
    ombros: [[[126, 66], [141, 70], [151, 84], [151, 100], [142, 98], [135, 82]]],
    peitoral: [[[102, 72], [124, 70], [137, 80], [136, 99], [121, 107], [103, 104]]],
    biceps: [[[139, 104], [150, 102], [155, 124], [152, 145], [143, 146], [138, 124]]],
    antebracos: [[[145, 156], [157, 153], [163, 182], [163, 204], [154, 206], [147, 180]]],
    abdomen: [
      [[102, 110], [119, 110], [123, 140], [121, 172], [112, 194], [102, 197]],
      [[123, 113], [131, 121], [129, 160], [125, 178], [124, 142]],
    ],
    abdutores: [[[128, 198], [134, 208], [136, 228], [130, 218]]],
    quadriceps: [[[111, 222], [131, 216], [136, 258], [131, 298], [119, 306], [111, 282], [107, 250]]],
    adutores: [[[101, 230], [110, 225], [108, 260], [103, 272]]],
    panturrilhas: [[[124, 326], [132, 344], [129, 370], [122, 372], [119, 346]]],
  },
  costas: {
    trapezio: [[[100, 52], [110, 56], [131, 67], [117, 76], [105, 86], [100, 90]]],
    ombros: [[[129, 66], [143, 70], [152, 86], [149, 100], [139, 92], [134, 78]]],
    meio_costas: [[[101, 91], [115, 82], [119, 100], [111, 118], [101, 121]]],
    dorsais: [[[116, 102], [132, 90], [134, 118], [127, 150], [113, 160], [109, 128]]],
    triceps: [[[138, 100], [150, 100], [155, 124], [151, 147], [143, 146], [137, 124]]],
    antebracos: [[[145, 156], [157, 153], [163, 182], [163, 204], [154, 206], [147, 180]]],
    lombar: [[[101, 150], [111, 158], [116, 184], [108, 198], [101, 200]]],
    abdutores: [[[123, 194], [134, 200], [137, 216], [127, 208]]],
    gluteos: [[[102, 206], [122, 200], [136, 216], [134, 244], [118, 252], [103, 246]]],
    adutores: [[[101, 252], [106, 254], [106, 280], [102, 276]]],
    posteriores: [[[107, 256], [132, 254], [134, 290], [126, 312], [114, 312], [107, 286]]],
    panturrilhas: [[[110, 322], [130, 320], [134, 348], [126, 372], [116, 372], [108, 350]]],
  },
};

const espelhar = (pts: readonly Ponto[]): Ponto[] => pts.map(([x, y]) => [LARGURA - x, y] as const);

/** Curva suave passando pelos pontos (Catmull-Rom convertido em Bézier cúbica). */
export function curva(pts: readonly Ponto[], fechada: boolean): string {
  const n = pts.length;
  const p = (i: number) => (fechada ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  const f = (v: number) => Math.round(v * 10) / 10;
  let d = `M${f(pts[0]![0])},${f(pts[0]![1])}`;
  const fim = fechada ? n : n - 1;
  for (let i = 0; i < fim; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const c1: Ponto = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Ponto = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return fechada ? `${d} Z` : d;
}

/** Contorno do corpo inteiro: metade direita + metade esquerda espelhada, ao contrário. */
export const SILHUETA = curva([...CONTORNO, ...espelhar(CONTORNO).reverse()], true);
export const CABECA = { cx: 100, cy: 32, rx: 17, ry: 21 };

/** Caminhos SVG (já com o lado espelhado) de cada músculo na vista. */
export function caminhos(vista: Vista): [Musculo, string[]][] {
  return (Object.entries(FORMAS[vista]) as [Musculo, Ponto[][]][]).map(([m, formas]) => [
    m,
    formas.flatMap((pts) => [curva(pts, true), curva(espelhar(pts), true)]),
  ]);
}

/** Em quais vistas cada músculo aparece. */
export function vistasDoMusculo(m: Musculo): Vista[] {
  return (["frente", "costas"] as const).filter((v) => FORMAS[v][m]);
}

// Biblioteca de exercícios: tipos e regras puras (filtros, disponibilidade, prescrição).
import type { Equipamento, Nivel, Objetivo } from "./tipos";

export const MUSCULOS = {
  peitoral: "Peitoral",
  ombros: "Ombros",
  triceps: "Tríceps",
  biceps: "Bíceps",
  antebracos: "Antebraços",
  trapezio: "Trapézio",
  dorsais: "Dorsais",
  meio_costas: "Meio das costas",
  lombar: "Lombar",
  abdomen: "Abdômen",
  gluteos: "Glúteos",
  quadriceps: "Quadríceps",
  posteriores: "Posteriores de coxa",
  panturrilhas: "Panturrilhas",
  adutores: "Adutores",
  abdutores: "Abdutores",
} as const;
export type Musculo = keyof typeof MUSCULOS;

/** Grupos usados nos filtros e na divisão de treino. */
export const GRUPOS = {
  peito: { rotulo: "Peito", musculos: ["peitoral"] },
  costas: { rotulo: "Costas", musculos: ["dorsais", "meio_costas", "lombar", "trapezio"] },
  ombros: { rotulo: "Ombros", musculos: ["ombros"] },
  bracos: { rotulo: "Braços", musculos: ["biceps", "triceps", "antebracos"] },
  pernas: { rotulo: "Pernas", musculos: ["quadriceps", "posteriores", "panturrilhas", "adutores", "abdutores"] },
  gluteos: { rotulo: "Glúteos", musculos: ["gluteos"] },
  abdomen: { rotulo: "Abdômen", musculos: ["abdomen"] },
} as const satisfies Record<string, { rotulo: string; musculos: readonly Musculo[] }>;
export type Grupo = keyof typeof GRUPOS;

export interface Exercicio {
  /** slug estável, usado em fichas e favoritos */
  id: string;
  nome: string;
  /** pasta do exercício no acervo free-exercise-db (fotos) */
  acervoId: string;
  musculosPrincipais: Musculo[];
  musculosSecundarios: Musculo[];
  /** todos são necessários; "peso_corporal" = nada além do corpo */
  equipamentos: Equipamento[];
  tipo: "composto" | "isolado";
  dificuldade: Nivel;
  finalidade: string;
  passos: string[];
  respiracao: string;
  tecnica: string[];
  errosComuns: string[];
  seguranca: string;
  /** ids de exercícios que trabalham o mesmo padrão com outro equipamento */
  alternativas: string[];
  /** medido em segundos (isometria, ex.: prancha) em vez de repetições */
  porTempo?: boolean;
}

/** Versão fixa do acervo: as fotos não mudam sem a gente atualizar este commit. */
const ACERVO_COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5";
export const LICENCA_ACERVO = "Fotos: free-exercise-db (domínio público, The Unlicense).";

export function urlImagem(ex: Pick<Exercicio, "acervoId">, quadro: 0 | 1): string {
  return `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${ACERVO_COMMIT}/exercises/${ex.acervoId}/${quadro}.jpg`;
}

export function grupoDoMusculo(m: Musculo): Grupo {
  for (const [g, def] of Object.entries(GRUPOS) as [Grupo, (typeof GRUPOS)[Grupo]][]) {
    if ((def.musculos as readonly Musculo[]).includes(m)) return g;
  }
  return "abdomen";
}

/** Grupo principal do exercício (pelo primeiro músculo principal). */
export const grupoDoExercicio = (ex: Exercicio): Grupo => grupoDoMusculo(ex.musculosPrincipais[0]!);

/** A pessoa consegue fazer o exercício com o que tem? "Academia completa" cobre tudo. */
export function disponivel(ex: Exercicio, meus: readonly Equipamento[]): boolean {
  if (meus.includes("academia_completa")) return true;
  return ex.equipamentos.every((e) => e === "peso_corporal" || meus.includes(e));
}

const ORDEM_NIVEL: Record<Nivel, number> = { iniciante: 0, intermediario: 1, avancado: 2 };
/** Exercício adequado ao nível (ou abaixo dele). */
export const adequadoAoNivel = (ex: Exercicio, nivel: Nivel) => ORDEM_NIVEL[ex.dificuldade] <= ORDEM_NIVEL[nivel];

/**
 * Objetivos para os quais o exercício costuma ser indicado (regra simples e explícita):
 * compostos servem a todos; isolados servem a hipertrofia e saúde; peso corporal e
 * kettlebell também a condicionamento e emagrecimento.
 */
export function objetivosIndicados(ex: Exercicio): Objetivo[] {
  const r = new Set<Objetivo>(["hipertrofia", "saude"]);
  if (ex.tipo === "composto") ["forca", "emagrecimento", "condicionamento"].forEach((o) => r.add(o as Objetivo));
  if (ex.equipamentos.some((e) => e === "peso_corporal" || e === "kettlebell")) ["emagrecimento", "condicionamento"].forEach((o) => r.add(o as Objetivo));
  return [...r];
}

export interface Prescricao {
  series: number;
  repsMin: number;
  repsMax: number;
  descansoS: number;
}

/**
 * Séries, repetições e descanso sugeridos por objetivo e tipo de exercício
 * (faixas usuais das diretrizes de treinamento resistido, ex.: ACSM).
 * Iniciantes fazem uma série a menos. Não é prescrição individual: a carga é
 * escolhida pela técnica e pelo esforço percebido, nunca por idade ou peso.
 */
const TABELA: Record<Objetivo, Record<Exercicio["tipo"], Prescricao>> = {
  hipertrofia: { composto: { series: 4, repsMin: 6, repsMax: 10, descansoS: 120 }, isolado: { series: 3, repsMin: 10, repsMax: 15, descansoS: 60 } },
  forca: { composto: { series: 5, repsMin: 3, repsMax: 6, descansoS: 180 }, isolado: { series: 3, repsMin: 8, repsMax: 12, descansoS: 90 } },
  emagrecimento: { composto: { series: 3, repsMin: 10, repsMax: 15, descansoS: 60 }, isolado: { series: 3, repsMin: 12, repsMax: 15, descansoS: 45 } },
  condicionamento: { composto: { series: 3, repsMin: 12, repsMax: 20, descansoS: 45 }, isolado: { series: 2, repsMin: 15, repsMax: 20, descansoS: 30 } },
  saude: { composto: { series: 3, repsMin: 8, repsMax: 12, descansoS: 90 }, isolado: { series: 2, repsMin: 10, repsMax: 15, descansoS: 60 } },
};

export function prescricao(objetivo: Objetivo, nivel: Nivel, tipo: Exercicio["tipo"]): Prescricao {
  const base = TABELA[objetivo][tipo];
  return nivel === "iniciante" ? { ...base, series: Math.max(2, base.series - 1) } : base;
}

/** Prescrição do exercício; em isometrias, repsMin/repsMax são segundos. */
export function prescricaoDoExercicio(ex: Exercicio, objetivo: Objetivo, nivel: Nivel): Prescricao & { unidade: "reps" | "s" } {
  const p = prescricao(objetivo, nivel, ex.tipo);
  if (!ex.porTempo) return { ...p, unidade: "reps" };
  return nivel === "iniciante" ? { ...p, repsMin: 20, repsMax: 30, unidade: "s" } : { ...p, repsMin: 30, repsMax: 60, unidade: "s" };
}

/** Texto sem acento e minúsculo, para busca. */
export const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export interface Filtros {
  texto?: string;
  grupo?: Grupo | null;
  musculo?: Musculo | null;
  dificuldade?: Nivel | null;
  objetivo?: Objetivo | null;
  /** quando informado, só exercícios possíveis com estes equipamentos */
  equipamentos?: readonly Equipamento[] | null;
  favoritos?: ReadonlySet<string> | null;
}

export function filtrar(lista: readonly Exercicio[], f: Filtros): Exercicio[] {
  const termos = f.texto ? normalizar(f.texto).split(/\s+/).filter(Boolean) : [];
  return lista.filter((ex) => {
    if (f.grupo && !ex.musculosPrincipais.some((m) => grupoDoMusculo(m) === f.grupo)) return false;
    if (f.musculo && !ex.musculosPrincipais.includes(f.musculo) && !ex.musculosSecundarios.includes(f.musculo)) return false;
    if (f.dificuldade && ex.dificuldade !== f.dificuldade) return false;
    if (f.objetivo && !objetivosIndicados(ex).includes(f.objetivo)) return false;
    if (f.equipamentos && !disponivel(ex, f.equipamentos)) return false;
    if (f.favoritos && !f.favoritos.has(ex.id)) return false;
    if (termos.length) {
      const alvo = normalizar([ex.nome, ...ex.musculosPrincipais.map((m) => MUSCULOS[m]), ...ex.musculosSecundarios.map((m) => MUSCULOS[m])].join(" "));
      if (!termos.every((t) => alvo.includes(t))) return false;
    }
    return true;
  });
}

/** Alternativas que a pessoa consegue fazer, na ordem cadastrada. */
export function alternativasPossiveis(ex: Exercicio, catalogo: ReadonlyMap<string, Exercicio>, meus: readonly Equipamento[] | null): Exercicio[] {
  return ex.alternativas.map((id) => catalogo.get(id)).filter((a): a is Exercicio => !!a && (!meus || disponivel(a, meus)));
}

// Tipos do domínio. Espelham as tabelas descritas em docs/ARQUITETURA.md.

export type Objetivo = "hipertrofia" | "emagrecimento" | "forca" | "condicionamento" | "saude";
export type Nivel = "iniciante" | "intermediario" | "avancado";

export const OBJETIVOS: Record<Objetivo, string> = {
  hipertrofia: "Hipertrofia",
  emagrecimento: "Emagrecimento",
  forca: "Força",
  condicionamento: "Condicionamento",
  saude: "Saúde",
};

export const NIVEIS: Record<Nivel, string> = {
  iniciante: "Iniciante",
  intermediario: "Intermediário",
  avancado: "Avançado",
};

export interface Perfil {
  nome: string;
  objetivo: Objetivo;
  nivel: Nivel;
  /** treinos por semana que a pessoa pretende fazer */
  metaSemanal: number;
  minutosSessao: number;
}

export const EQUIPAMENTOS = {
  academia_completa: "Academia completa",
  halteres: "Halteres",
  barra_anilhas: "Barra e anilhas",
  maquinas: "Máquinas",
  polia: "Polia / cabo",
  banco: "Banco",
  kettlebell: "Kettlebell",
  elasticos: "Elásticos",
  barra_fixa: "Barra fixa",
  peso_corporal: "Só peso corporal",
} as const;
export type Equipamento = keyof typeof EQUIPAMENTOS;

/** Questionário de prontidão para atividade física (PAR-Q, versão resumida). */
export const PARQ = {
  coracao: "Algum médico já disse que você tem problema no coração e só deve fazer atividade física recomendada por ele?",
  dor_peito_atividade: "Você sente dor no peito quando faz atividade física?",
  dor_peito_repouso: "No último mês, você sentiu dor no peito sem estar fazendo atividade física?",
  tontura: "Você perde o equilíbrio por tontura ou já perdeu a consciência?",
  osso_articulacao: "Você tem algum problema nos ossos ou articulações que pode piorar com atividade física?",
  medicamento_pressao: "Você toma remédio para pressão arterial ou para o coração?",
  outro_motivo: "Você sabe de algum outro motivo para não fazer atividade física?",
} as const;
export type PerguntaParq = keyof typeof PARQ;

/** Perfil completo, como salvo no banco (tabela perfis). */
export interface PerfilCompleto {
  nome: string;
  /** AAAA-MM-DD */
  dataNascimento: string;
  alturaCm: number;
  pesoKg: number;
  objetivo: Objetivo;
  nivel: Nivel;
  diasSemana: number;
  minutosSessao: number;
  equipamentos: Equipamento[];
  limitacoes: string;
  parq: Partial<Record<PerguntaParq, boolean>>;
  consentimentoTermosEm: string;
  consentimentoSaudeEm: string;
}

/** Alguma resposta "sim" no PAR-Q pede liberação médica antes de treinar. */
export const parqPedeLiberacao = (parq: PerfilCompleto["parq"]) => Object.values(parq).some(Boolean);

export interface ItemPlano {
  exercicioId: string;
  nome: string;
  grupo: string;
  series: number;
  repsMin: number;
  repsMax: number;
  descansoS: number;
}

export interface PlanoSessao {
  id: string;
  /** letra da divisão: A, B, C… */
  nome: string;
  titulo: string;
  itens: ItemPlano[];
}

export interface Plano {
  id: string;
  nome: string;
  objetivo: Objetivo;
  sessoes: PlanoSessao[];
}

export type StatusSessao = "em_andamento" | "concluida" | "abandonada";

export interface SessaoTreino {
  id: string;
  planoSessaoId: string;
  titulo: string;
  status: StatusSessao;
  /** ISO 8601 */
  iniciadaEm: string;
  finalizadaEm: string | null;
  seriesConcluidas: number;
  /** soma de carga × repetições, em kg */
  volumeKg: number;
}

export interface Medida {
  /** AAAA-MM-DD */
  data: string;
  pesoKg: number;
}

export interface DadosUsuario {
  perfil: Perfil | null;
  /** dados completos do cadastro (só existe com conta na nuvem) */
  perfilCompleto: PerfilCompleto | null;
  plano: Plano | null;
  sessoes: SessaoTreino[];
  medidas: Medida[];
}

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
  /** meta de peso corporal (opcional) */
  metaPesoKg?: number | null;
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
  /** carga inicial escolhida pela pessoa (kg); null = definir no primeiro treino */
  cargaKg?: number | null;
  /** repsMin/repsMax em segundos (isometria) */
  porTempo?: boolean;
}

/** O que o motor usou para montar o plano (fica salvo para explicar a ficha). */
export interface ParametrosPlano {
  objetivo: Objetivo;
  nivel: Nivel;
  diasSemana: number;
  minutosSessao: number;
  equipamentos: Equipamento[];
  conservador: boolean;
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
  /** motor = gerado pelo app; professor = montado por professor; manual = editado pela pessoa */
  origem?: "motor" | "professor" | "manual";
  parametros?: ParametrosPlano;
  /** explicação curta da divisão escolhida */
  explicacao?: string;
  revisadoEm?: string | null;
  observacaoProfissional?: string | null;
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

/** Medidas corporais de um dia. Tudo opcional, exceto a data; sem id = vem do cadastro. */
export interface Medida {
  id?: string;
  /** AAAA-MM-DD */
  data: string;
  pesoKg: number | null;
  gorduraPct?: number | null;
  cinturaCm?: number | null;
  quadrilCm?: number | null;
  peitoCm?: number | null;
  bracoCm?: number | null;
  coxaCm?: number | null;
  panturrilhaCm?: number | null;
}

export type PoseFoto = "frente" | "lado" | "costas";

export interface Foto {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  pose: PoseFoto;
  caminho: string;
  /** URL assinada de curta duração (bucket privado) */
  url: string;
}

export const CAMPOS_MEDIDA = {
  gorduraPct: { rotulo: "Gordura corporal", unidade: "%", min: 2, max: 70 },
  cinturaCm: { rotulo: "Cintura", unidade: "cm", min: 40, max: 200 },
  quadrilCm: { rotulo: "Quadril", unidade: "cm", min: 50, max: 200 },
  peitoCm: { rotulo: "Peito", unidade: "cm", min: 50, max: 200 },
  bracoCm: { rotulo: "Braço", unidade: "cm", min: 15, max: 70 },
  coxaCm: { rotulo: "Coxa", unidade: "cm", min: 30, max: 100 },
  panturrilhaCm: { rotulo: "Panturrilha", unidade: "cm", min: 20, max: 70 },
} as const;
export type CampoMedida = keyof typeof CAMPOS_MEDIDA;

export interface DadosUsuario {
  perfil: Perfil | null;
  /** dados completos do cadastro (só existe com conta na nuvem) */
  perfilCompleto: PerfilCompleto | null;
  plano: Plano | null;
  sessoes: SessaoTreino[];
  medidas: Medida[];
}

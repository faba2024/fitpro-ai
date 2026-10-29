// Regras puras dos painéis da academia (etapa 11): convites, mensalidades e resumos.
import { inicioDoDia, somarDias } from "./datas";

export type Papel = "aluno" | "professor" | "admin";

export const PAPEIS: Record<Papel, string> = { aluno: "Aluno", professor: "Professor", admin: "Administração" };

export type FormaPagamento = "pix" | "dinheiro" | "cartao" | "transferencia" | "outro";

export const FORMAS_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

export interface Membro {
  userId: string;
  nome: string;
  papel: Papel;
  professorId: string | null;
  ativo: boolean;
  desde: string;
}

export interface Pagamento {
  id: string;
  alunoId: string;
  /** AAAA-MM-01 */
  competencia: string;
  valor: number;
  /** AAAA-MM-DD */
  pagoEm: string;
  forma: FormaPagamento;
  observacao: string;
}

export interface Convite {
  codigo: string;
  papel: Exclude<Papel, "admin">;
  professorId: string | null;
  expiraEm: string;
  usos: number;
  usosMax: number;
}

/** Código de convite como o banco gera: 10 caracteres hexadecimais (aceita minúsculas, espaços e hífens). */
export function normalizarCodigo(texto: string): string | null {
  const c = texto.replace(/[\s-]/g, "").toUpperCase();
  return /^[0-9A-F]{10}$/.test(c) ? c : null;
}

/** "A1B2C3D4E5" → "A1B2C-3D4E5", mais fácil de ditar. */
export const formatarCodigo = (c: string) => (c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : c);

/** Identificador da academia na URL a partir do nome ("Academia Força & Saúde" → "academia-forca-saude"). */
export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
}

/** Competência (mês de referência) no formato do banco: AAAA-MM-01. */
export function competenciaDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function deslocarCompetencia(competencia: string, meses: number): string {
  const [a, m] = competencia.split("-").map(Number);
  return competenciaDe(new Date(a!, m! - 1 + meses, 1));
}

export function rotuloCompetencia(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number);
  const nome = new Date(a!, m! - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

export const formatarReais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface SituacaoMensalidades {
  pagos: { membro: Membro; pagamento: Pagamento }[];
  pendentes: Membro[];
  total: number;
}

/** Alunos ativos com e sem pagamento registrado no mês. Pagamento de quem saiu continua somando no total. */
export function situacaoMensalidades(membros: readonly Membro[], pagamentos: readonly Pagamento[]): SituacaoMensalidades {
  const porAluno = new Map(pagamentos.map((p) => [p.alunoId, p]));
  const alunos = membros.filter((m) => m.papel === "aluno" && m.ativo);
  const pagos: SituacaoMensalidades["pagos"] = [];
  const pendentes: Membro[] = [];
  for (const m of alunos) {
    const p = porAluno.get(m.userId);
    if (p) pagos.push({ membro: m, pagamento: p });
    else pendentes.push(m);
  }
  const total = pagamentos.reduce((soma, p) => soma + p.valor, 0);
  return { pagos, pendentes, total: Math.round(total * 100) / 100 };
}

export interface ResumoMembros {
  alunosAtivos: number;
  professoresAtivos: number;
  alunosSemProfessor: number;
  inativos: number;
  /** alunos ativos por professor (id → quantidade) */
  porProfessor: Map<string, number>;
}

export function resumirMembros(membros: readonly Membro[]): ResumoMembros {
  const ativos = membros.filter((m) => m.ativo);
  const alunos = ativos.filter((m) => m.papel === "aluno");
  const porProfessor = new Map<string, number>();
  for (const a of alunos) if (a.professorId) porProfessor.set(a.professorId, (porProfessor.get(a.professorId) ?? 0) + 1);
  return {
    alunosAtivos: alunos.length,
    professoresAtivos: ativos.filter((m) => m.papel === "professor").length,
    alunosSemProfessor: alunos.filter((a) => !a.professorId).length,
    inativos: membros.length - ativos.length,
    porProfessor,
  };
}

export const conviteAberto = (c: Convite, agora = new Date()) => c.usos < c.usosMax && new Date(c.expiraEm) > agora;

/** Treinos finalizados nos últimos `dias` dias (contando hoje). */
export function treinosRecentes(iniciadas: readonly string[], dias: number, hoje = new Date()): number {
  const limite = somarDias(inicioDoDia(hoje), -(dias - 1)).getTime();
  return iniciadas.filter((i) => new Date(i).getTime() >= limite).length;
}

/** Validação do formulário de pagamento (valores em reais, data AAAA-MM-DD). */
export function validarPagamento(p: { valor: number; pagoEm: string }, hoje = new Date()): string | null {
  if (!Number.isFinite(p.valor) || p.valor <= 0) return "Informe um valor maior que zero.";
  if (p.valor > 100000) return "Valor alto demais.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.pagoEm)) return "Informe a data do pagamento.";
  if (new Date(`${p.pagoEm}T00:00:00`) > hoje) return "A data do pagamento não pode estar no futuro.";
  return null;
}

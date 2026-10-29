// Repositório de academia em memória para testes de tela (sem rede).
import { vi } from "vitest";
import type { Academia, DetalheAluno, RepoAcademia, ResumoAluno, Vinculo } from "@/data/academia";
import { ErroDados } from "@/data/supabase";
import type { Convite, Membro, Pagamento } from "@/domain/academia";

export interface EstadoFalso {
  vinculos: Vinculo[];
  academia: Academia;
  membros: Membro[];
  pagamentos: Pagamento[];
  convites: Convite[];
  alunos: ResumoAluno[];
  detalhes: Record<string, DetalheAluno>;
  /** código aceito por aceitarConvite (os outros falham como no banco) */
  codigoValido?: string;
}

export function repoAcademiaFalso(inicial: Partial<EstadoFalso> = {}) {
  const e: EstadoFalso = {
    vinculos: [],
    academia: { id: "acad-1", nome: "Academia Teste", mensalidadePadrao: 120 },
    membros: [],
    pagamentos: [],
    convites: [],
    alunos: [],
    detalhes: {},
    ...inicial,
  };
  let seq = 0;

  const repo = {
    minhasAcademias: vi.fn(async () => e.vinculos),
    criarAcademia: vi.fn(async (nome: string) => {
      e.vinculos = [...e.vinculos, { academiaId: "acad-nova", academiaNome: nome, papel: "admin", ativo: true, professorId: null, professorNome: null }];
      return "acad-nova";
    }),
    aceitarConvite: vi.fn(async (codigo: string) => {
      if (codigo !== e.codigoValido) throw new ErroDados("Convite inválido ou expirado. Confira o código ou peça um novo.");
      e.vinculos = [...e.vinculos, { academiaId: e.academia.id, academiaNome: e.academia.nome, papel: "aluno", ativo: true, professorId: "prof-1", professorNome: "Carlos Prof" }];
      return { academiaNome: e.academia.nome, papel: "aluno" as const };
    }),
    sairDaAcademia: vi.fn(async (academiaId: string, papel: Vinculo["papel"]) => {
      e.vinculos = e.vinculos.filter((v) => !(v.academiaId === academiaId && v.papel === papel));
    }),
    academia: vi.fn(async () => e.academia),
    salvarMensalidadePadrao: vi.fn(async (_id: string, valor: number | null) => {
      e.academia = { ...e.academia, mensalidadePadrao: valor };
    }),
    membros: vi.fn(async () => e.membros),
    definirProfessor: vi.fn(async (_a: string, alunoId: string, professorId: string | null) => {
      e.membros = e.membros.map((m) => (m.userId === alunoId && m.papel === "aluno" ? { ...m, professorId } : m));
    }),
    definirAtivo: vi.fn(async (_a: string, userId: string, papel: Membro["papel"], ativo: boolean) => {
      e.membros = e.membros.map((m) => (m.userId === userId && m.papel === papel ? { ...m, ativo } : m));
    }),
    pagamentos: vi.fn(async (_a: string, competencia: string) => e.pagamentos.filter((p) => p.competencia === competencia)),
    registrarPagamento: vi.fn(async (_a: string, p: Omit<Pagamento, "id">) => {
      e.pagamentos = [...e.pagamentos, { ...p, id: `pag-${++seq}` }];
    }),
    excluirPagamento: vi.fn(async (id: string) => {
      e.pagamentos = e.pagamentos.filter((p) => p.id !== id);
    }),
    convites: vi.fn(async () => e.convites),
    criarConvite: vi.fn(async (_a: string, papel: Convite["papel"], usos: number) => {
      const codigo = `ABCDE1234${++seq}`.slice(0, 10);
      e.convites = [{ codigo, papel, professorId: null, expiraEm: new Date(Date.now() + 7 * 86_400_000).toISOString(), usos: 0, usosMax: usos }, ...e.convites];
      return codigo;
    }),
    revogarConvite: vi.fn(async (codigo: string) => {
      e.convites = e.convites.filter((c) => c.codigo !== codigo);
    }),
    meusAlunos: vi.fn(async () => e.alunos),
    aluno: vi.fn(async (id: string) => {
      const d = e.detalhes[id];
      if (!d) throw new ErroDados("Aluno não encontrado entre os seus.");
      return d;
    }),
    revisarFicha: vi.fn(async (_planoId: string, observacao: string) => {
      for (const d of Object.values(e.detalhes)) if (d.plano) d.plano = { ...d.plano, revisadoEm: "2026-10-28T12:00:00Z", observacaoProfissional: observacao };
    }),
    salvarFichaDoAluno: vi.fn(async (alunoId: string, plano: DetalheAluno["plano"]) => {
      const d = e.detalhes[alunoId];
      if (d) d.plano = plano;
    }),
  } satisfies RepoAcademia;

  return { repo, estado: e };
}

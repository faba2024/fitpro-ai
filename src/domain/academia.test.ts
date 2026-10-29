import { describe, expect, it } from "vitest";
import {
  competenciaDe,
  conviteAberto,
  deslocarCompetencia,
  formatarCodigo,
  gerarSlug,
  normalizarCodigo,
  resumirMembros,
  rotuloCompetencia,
  situacaoMensalidades,
  treinosRecentes,
  validarPagamento,
  type Membro,
  type Pagamento,
} from "./academia";

const membro = (userId: string, papel: Membro["papel"], extra: Partial<Membro> = {}): Membro => ({
  userId,
  nome: userId.toUpperCase(),
  papel,
  professorId: null,
  ativo: true,
  desde: "2026-10-01T00:00:00Z",
  ...extra,
});

const pagamento = (alunoId: string, valor: number): Pagamento => ({
  id: `p-${alunoId}`,
  alunoId,
  competencia: "2026-10-01",
  valor,
  pagoEm: "2026-10-05",
  forma: "pix",
  observacao: "",
});

describe("convites", () => {
  it("aceita o código com minúsculas, espaços e hífen e recusa o resto", () => {
    expect(normalizarCodigo(" a1b2c-3d4e5 ")).toBe("A1B2C3D4E5");
    expect(normalizarCodigo("A1B2C3D4E")).toBeNull();
    expect(normalizarCodigo("ZZZZZZZZZZ")).toBeNull();
    expect(formatarCodigo("A1B2C3D4E5")).toBe("A1B2C-3D4E5");
  });

  it("convite fechado quando esgota os usos ou expira", () => {
    const agora = new Date("2026-10-28T12:00:00Z");
    const base = { codigo: "A1B2C3D4E5", papel: "aluno" as const, professorId: null, usos: 0, usosMax: 1, expiraEm: "2026-11-01T00:00:00Z" };
    expect(conviteAberto(base, agora)).toBe(true);
    expect(conviteAberto({ ...base, usos: 1 }, agora)).toBe(false);
    expect(conviteAberto({ ...base, expiraEm: "2026-10-28T11:59:00Z" }, agora)).toBe(false);
  });
});

describe("slug", () => {
  it("tira acentos e símbolos e fica dentro do padrão do banco", () => {
    expect(gerarSlug("Academia Força & Saúde!")).toBe("academia-forca-saude");
    expect(gerarSlug("  ---  ")).toBe("");
    expect(gerarSlug("a".repeat(80))).toHaveLength(50);
    expect(gerarSlug("Studio " + "x".repeat(42) + " fim")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("competência", () => {
  it("formata, desloca entre anos e dá nome ao mês", () => {
    expect(competenciaDe(new Date(2026, 9, 28))).toBe("2026-10-01");
    expect(deslocarCompetencia("2026-01-01", -1)).toBe("2025-12-01");
    expect(deslocarCompetencia("2026-12-01", 1)).toBe("2027-01-01");
    expect(rotuloCompetencia("2026-10-01")).toMatch(/^Outubro de 2026$/);
  });
});

describe("mensalidades", () => {
  it("separa pagos e pendentes entre os alunos ativos; pagamento de quem saiu soma no total", () => {
    const membros = [membro("a", "aluno"), membro("b", "aluno"), membro("c", "aluno", { ativo: false }), membro("p", "professor")];
    const sit = situacaoMensalidades(membros, [pagamento("a", 120), pagamento("x", 99.9)]);
    expect(sit.pagos.map((p) => p.membro.userId)).toEqual(["a"]);
    expect(sit.pendentes.map((m) => m.userId)).toEqual(["b"]);
    expect(sit.total).toBe(219.9);
  });

  it("valida valor e data", () => {
    const hoje = new Date("2026-10-28T12:00:00");
    expect(validarPagamento({ valor: 0, pagoEm: "2026-10-01" }, hoje)).toMatch(/maior que zero/);
    expect(validarPagamento({ valor: NaN, pagoEm: "2026-10-01" }, hoje)).toMatch(/maior que zero/);
    expect(validarPagamento({ valor: 120, pagoEm: "" }, hoje)).toMatch(/data/);
    expect(validarPagamento({ valor: 120, pagoEm: "2026-10-29" }, hoje)).toMatch(/futuro/);
    expect(validarPagamento({ valor: 120, pagoEm: "2026-10-28" }, hoje)).toBeNull();
  });
});

describe("resumo", () => {
  it("conta ativos, sem professor e alunos por professor", () => {
    const r = resumirMembros([
      membro("d", "admin"),
      membro("p", "professor"),
      membro("q", "professor", { ativo: false }),
      membro("a", "aluno", { professorId: "p" }),
      membro("b", "aluno", { professorId: "p" }),
      membro("c", "aluno"),
    ]);
    expect(r).toMatchObject({ alunosAtivos: 3, professoresAtivos: 1, alunosSemProfessor: 1, inativos: 1 });
    expect(r.porProfessor.get("p")).toBe(2);
  });

  it("treinos recentes contam a partir do início do dia, incluindo hoje", () => {
    const hoje = new Date(2026, 9, 28, 20);
    const inicios = [new Date(2026, 9, 28, 7), new Date(2026, 9, 22, 0, 5), new Date(2026, 9, 21, 23)].map((d) => d.toISOString());
    expect(treinosRecentes(inicios, 7, hoje)).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { EXERCICIOS } from "./catalogo";
import { gerarPlano } from "@/domain/motor";
import { deLinhaPlano, paraLinhaPlano, type LinhaPlano } from "./planoMapper";

describe("planoMapper", () => {
  it("ida e volta pelo formato do banco preserva a ficha", () => {
    let n = 0;
    const plano = gerarPlano(
      { objetivo: "hipertrofia", nivel: "intermediario", diasSemana: 3, minutosSessao: 60, equipamentos: ["academia_completa"], conservador: false },
      EXERCICIOS,
      () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    );
    const linha = paraLinhaPlano("aluno-1", plano);
    expect(linha).toMatchObject({ aluno_id: "aluno-1", ativo: true, origem: "motor" });
    const volta = deLinhaPlano({ ...(linha as unknown as LinhaPlano), revisado_em: null, observacao_profissional: null });
    expect(volta).toEqual({ ...plano, observacaoProfissional: null });
  });

  it("estrutura estranha vira valores seguros em vez de quebrar a tela", () => {
    const p = deLinhaPlano({
      id: "x",
      aluno_id: "a",
      nome: "Ficha",
      objetivo: "saude",
      origem: "professor",
      ativo: true,
      estrutura: [{ itens: [{ exercicioId: "flexao", series: "três" }] }, "lixo"],
      parametros: null,
      explicacao: "",
      revisado_em: "2026-10-01T00:00:00Z",
      observacao_profissional: "Bom",
    });
    expect(p.sessoes[0]).toMatchObject({ nome: "A", titulo: "Treino", itens: [{ exercicioId: "flexao", series: 3, cargaKg: null }] });
    expect(p.sessoes[1]!.itens).toEqual([]);
    expect(p.parametros).toBeUndefined();
    expect(p.revisadoEm).toBe("2026-10-01T00:00:00Z");
  });
});

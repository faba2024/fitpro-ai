import { describe, expect, it } from "vitest";
import { CATALOGO, EXERCICIOS } from "@/data/catalogo";
import { PLANO_EXEMPLO } from "@/data/exemplo";
import {
  adicionarItem,
  atualizarItem,
  fichaValida,
  itemDoExercicio,
  moverItem,
  parametrosDoPerfil,
  removerItem,
  substitutos,
  trocarExercicio,
  validarItem,
} from "./ficha";
import type { PerfilCompleto } from "./tipos";

const plano = PLANO_EXEMPLO;
const A = plano.sessoes[0]!;

describe("operações da ficha", () => {
  it("não alteram o plano original", () => {
    const antes = JSON.stringify(plano);
    atualizarItem(plano, A.id, 0, { series: 9 });
    removerItem(plano, A.id, 0);
    moverItem(plano, A.id, 0, 1);
    expect(JSON.stringify(plano)).toBe(antes);
  });

  it("move, remove e adiciona exercícios", () => {
    const movido = moverItem(plano, A.id, 0, 1);
    expect(movido.sessoes[0]!.itens[1]!.exercicioId).toBe(A.itens[0]!.exercicioId);
    expect(moverItem(plano, A.id, 0, -1)).toEqual(plano); // não sai do começo
    expect(removerItem(plano, A.id, 0).sessoes[0]!.itens).toHaveLength(A.itens.length - 1);
    const novo = adicionarItem(plano, A.id, itemDoExercicio(CATALOGO.get("prancha")!, "saude", "iniciante"));
    expect(novo.sessoes[0]!.itens.at(-1)).toMatchObject({ exercicioId: "prancha", porTempo: true, repsMin: 20 });
  });

  it("troca o exercício mantendo as séries e zerando a carga", () => {
    const comCarga = atualizarItem(plano, A.id, 0, { series: 5, cargaKg: 60 });
    const trocado = trocarExercicio(comCarga, A.id, 0, CATALOGO.get("flexao")!, "hipertrofia", "intermediario");
    expect(trocado.sessoes[0]!.itens[0]).toMatchObject({ exercicioId: "flexao", nome: "Flexão de braço", series: 5, cargaKg: null });
  });
});

describe("substitutos", () => {
  it("alternativas cadastradas vêm primeiro e respeitam equipamento", () => {
    const supino = CATALOGO.get("supino-reto-barra")!;
    const s = substitutos(supino, EXERCICIOS, { nivel: "intermediario", equipamentos: ["halteres", "banco"] }, new Set());
    expect(s[0]!.id).toBe("supino-inclinado-halteres");
    expect(s.every((e) => e.id !== "supino-reto-barra" && e.id !== "crucifixo-maquina")).toBe(true);
  });

  it("não sugere o que já está no treino nem acima do nível", () => {
    const abd = CATALOGO.get("prancha")!;
    const s = substitutos(abd, EXERCICIOS, { nivel: "iniciante", equipamentos: ["academia_completa"] }, new Set(["abdominal-crunch"]));
    expect(s.map((e) => e.id)).not.toContain("abdominal-crunch");
    expect(s.map((e) => e.id)).not.toContain("elevacao-pernas-barra");
  });
});

describe("validação", () => {
  const ok = A.itens[0]!;

  it("aceita item válido e carga vazia", () => {
    expect(validarItem({ ...ok, cargaKg: null })).toEqual({});
    expect(fichaValida(plano)).toBe(true);
  });

  it("aponta valores fora da faixa", () => {
    const e = validarItem({ ...ok, series: 0, repsMin: 12, repsMax: 8, descansoS: 999, cargaKg: -5 });
    expect(Object.keys(e).sort()).toEqual(["cargaKg", "descansoS", "repsMax", "series"]);
  });

  it("isometria aceita segundos acima de 100", () => {
    expect(validarItem({ ...ok, porTempo: true, repsMin: 30, repsMax: 120 })).toEqual({});
  });

  it("ficha com treino vazio não é válida", () => {
    expect(fichaValida({ ...plano, sessoes: [{ ...A, itens: [] }] })).toBe(false);
  });
});

describe("parâmetros do perfil", () => {
  const completo: PerfilCompleto = {
    nome: "Ana",
    dataNascimento: "1990-01-01",
    alturaCm: 165,
    pesoKg: 60,
    objetivo: "forca",
    nivel: "avancado",
    diasSemana: 5,
    minutosSessao: 75,
    equipamentos: ["halteres"],
    limitacoes: "",
    parq: { coracao: false },
    consentimentoTermosEm: "",
    consentimentoSaudeEm: "",
  };

  it("usa o perfil completo e liga o modo conservador por PAR-Q ou limitações", () => {
    expect(parametrosDoPerfil(completo, null)).toMatchObject({ diasSemana: 5, equipamentos: ["halteres"], conservador: false });
    expect(parametrosDoPerfil({ ...completo, limitacoes: "dor no ombro" }, null)!.conservador).toBe(true);
    expect(parametrosDoPerfil({ ...completo, parq: { coracao: true } }, null)!.conservador).toBe(true);
  });

  it("no modo local usa o resumo com academia completa", () => {
    expect(parametrosDoPerfil(null, { nome: "V", objetivo: "saude", nivel: "iniciante", metaSemanal: 3, minutosSessao: 45 })).toMatchObject({ equipamentos: ["academia_completa"] });
    expect(parametrosDoPerfil(null, null)).toBeNull();
  });
});

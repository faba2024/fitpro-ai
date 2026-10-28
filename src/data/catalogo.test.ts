import { describe, expect, it } from "vitest";
import { MUSCULOS } from "@/domain/exercicios";
import { EQUIPAMENTOS } from "@/domain/tipos";
import { CATALOGO, EXERCICIOS } from "./catalogo";
import { PLANO_EXEMPLO } from "./exemplo";

describe("catálogo de exercícios", () => {
  it("tem ids únicos em formato de slug", () => {
    const ids = EXERCICIOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("cada exercício tem todos os campos de conteúdo preenchidos", () => {
    for (const e of EXERCICIOS) {
      expect(e.nome, e.id).not.toBe("");
      expect(e.finalidade, e.id).not.toBe("");
      expect(e.passos.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.respiracao, e.id).not.toBe("");
      expect(e.tecnica.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.errosComuns.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.seguranca, e.id).not.toBe("");
      expect(e.musculosPrincipais.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.equipamentos.length, e.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("só usa músculos e equipamentos conhecidos", () => {
    for (const e of EXERCICIOS) {
      for (const m of [...e.musculosPrincipais, ...e.musculosSecundarios]) expect(MUSCULOS, `${e.id}: ${m}`).toHaveProperty(m);
      for (const q of e.equipamentos) expect(EQUIPAMENTOS, `${e.id}: ${q}`).toHaveProperty(q);
      // músculo não aparece como principal e secundário ao mesmo tempo
      expect(e.musculosPrincipais.filter((m) => e.musculosSecundarios.includes(m)), e.id).toEqual([]);
    }
  });

  it("alternativas apontam para exercícios existentes e diferentes", () => {
    for (const e of EXERCICIOS) {
      for (const a of e.alternativas) {
        expect(CATALOGO.has(a), `${e.id} → ${a}`).toBe(true);
        expect(a).not.toBe(e.id);
      }
    }
  });

  it("cobre todos os grupos musculares principais", () => {
    const principais = new Set(EXERCICIOS.flatMap((e) => e.musculosPrincipais));
    for (const m of ["peitoral", "dorsais", "ombros", "biceps", "triceps", "quadriceps", "posteriores", "gluteos", "panturrilhas", "abdomen"]) {
      expect(principais.has(m as never), m).toBe(true);
    }
  });

  it("o plano de exemplo só usa exercícios do catálogo", () => {
    for (const s of PLANO_EXEMPLO.sessoes) for (const i of s.itens) expect(CATALOGO.has(i.exercicioId), i.exercicioId).toBe(true);
  });
});

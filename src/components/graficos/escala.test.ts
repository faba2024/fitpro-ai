import { describe, expect, it } from "vitest";
import { escalaY } from "./escala";

describe("escalaY", () => {
  it("cobre os dados com passos redondos", () => {
    const e = escalaY([78.4, 80.1, 81.2]);
    expect(e.min).toBeLessThanOrEqual(78.4);
    expect(e.max).toBeGreaterThanOrEqual(81.2);
    expect(e.ticks).toEqual([78, 79, 80, 81, 82]);
  });

  it("barras começam no zero", () => {
    expect(escalaY([3, 4, 2], { zero: true }).ticks[0]).toBe(0);
  });

  it("valor único abre uma faixa e lista vazia não quebra", () => {
    const e = escalaY([80]);
    expect(e.max).toBeGreaterThan(e.min);
    expect(escalaY([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });

  it("volumes grandes usam passos de 1000, 2000, 5000…", () => {
    expect(escalaY([0, 12_400], { zero: true }).ticks).toEqual([0, 5000, 10000, 15000]);
  });
});

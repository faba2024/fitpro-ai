import { beforeEach, describe, expect, it } from "vitest";
import { LocalRepositorio } from "./local";

const HOJE = new Date(2026, 9, 28, 10); // quarta-feira

describe("LocalRepositorio", () => {
  beforeEach(() => localStorage.clear());

  it("sem nada salvo devolve dados vazios", async () => {
    const r = new LocalRepositorio(localStorage, () => HOJE);
    expect(await r.carregar()).toEqual({ perfil: null, perfilCompleto: null, plano: null, sessoes: [], medidas: [] });
    expect(r.ehExemplo()).toBe(false);
  });

  it("dados corrompidos não quebram a leitura", async () => {
    localStorage.setItem("fitpro:dados:v1", "{isso não é json");
    expect((await new LocalRepositorio().carregar()).sessoes).toEqual([]);
  });

  it("exemplo fica salvo, marcado como exemplo, e só tem treinos antes de hoje", async () => {
    const r = new LocalRepositorio(localStorage, () => HOJE);
    await r.carregarExemplo();
    const d = await r.carregar();
    expect(r.ehExemplo()).toBe(true);
    expect(d.plano?.sessoes).toHaveLength(3);
    expect(d.sessoes.length).toBeGreaterThan(0);
    expect(d.sessoes.every((s) => new Date(s.iniciadaEm) < new Date(2026, 9, 28))).toBe(true);
  });

  it("limpar apaga tudo", async () => {
    const r = new LocalRepositorio(localStorage, () => HOJE);
    await r.carregarExemplo();
    await r.limpar();
    expect((await r.carregar()).plano).toBeNull();
    expect(r.ehExemplo()).toBe(false);
  });
});

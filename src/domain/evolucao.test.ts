import { describe, expect, it } from "vitest";
import { compararPeriodos, intervalo, intervaloAnterior, paraMedida, progressoCarga, semanas, serieMedida, validarMedida, variacaoPct } from "./evolucao";
import type { Medida, SessaoTreino } from "./tipos";

const HOJE = new Date(2026, 9, 28, 15); // quarta, 28/10/2026

let n = 0;
const sessao = (ano: number, mes: number, dia: number, volumeKg = 1000, status: SessaoTreino["status"] = "concluida"): SessaoTreino => ({
  id: String(++n),
  planoSessaoId: "a",
  titulo: "A",
  status,
  iniciadaEm: new Date(ano, mes - 1, dia, 18).toISOString(),
  finalizadaEm: new Date(ano, mes - 1, dia, 19).toISOString(),
  seriesConcluidas: 15,
  volumeKg,
});

describe("intervalos", () => {
  it("30 dias terminam no fim de hoje e o anterior encosta nele", () => {
    const i = intervalo(30, HOJE);
    expect(i.fim).toEqual(new Date(2026, 9, 29));
    expect(i.inicio).toEqual(new Date(2026, 8, 29));
    expect(intervaloAnterior(30, HOJE)).toEqual({ inicio: new Date(2026, 7, 30), fim: new Date(2026, 8, 29) });
  });

  it("'Tudo' não tem início nem período anterior", () => {
    expect(intervalo(0, HOJE).inicio).toBeNull();
    expect(intervaloAnterior(0, HOJE)).toBeNull();
  });
});

describe("comparação de períodos", () => {
  const sessoes = [
    sessao(2026, 10, 27, 2000),
    sessao(2026, 10, 20, 1500),
    sessao(2026, 10, 5, 1000),
    sessao(2026, 9, 20, 800), // período anterior
    sessao(2026, 10, 26, 9999, "abandonada"),
  ];
  const medidas: Medida[] = [
    { data: "2026-09-15", pesoKg: 82 }, // antes do período: referência
    { data: "2026-10-10", pesoKg: 81 },
    { data: "2026-10-25", pesoKg: 80.4 },
    { data: "2026-10-26", pesoKg: null, cinturaCm: 88 },
  ];

  it("conta só treinos concluídos e compara com o período anterior", () => {
    const c = compararPeriodos(sessoes, medidas, 30, HOJE);
    expect(c.atual).toMatchObject({ treinos: 3, series: 45, volumeKg: 4500 });
    expect(c.anterior).toMatchObject({ treinos: 1, volumeKg: 800 });
    expect(c.atual.mediaSemanal).toBeCloseTo(0.7, 1);
  });

  it("variação de peso usa o último peso antes do período como referência", () => {
    expect(compararPeriodos(sessoes, medidas, 30, HOJE).pesoVariacaoKg).toBe(-1.6);
  });

  it("sem pesos no período não há variação", () => {
    expect(compararPeriodos(sessoes, [{ data: "2026-01-01", pesoKg: 90 }], 30, HOJE).pesoVariacaoKg).toBeNull();
  });

  it("percentual de variação", () => {
    expect(variacaoPct(150, 100)).toBe(50);
    expect(variacaoPct(5, 0)).toBeNull();
    expect(variacaoPct(5, null)).toBeNull();
  });
});

describe("séries para gráficos", () => {
  it("semanas da mais antiga para a atual, com treinos e volume", () => {
    const s = semanas([sessao(2026, 10, 27, 2000), sessao(2026, 10, 26, 500), sessao(2026, 10, 20, 1500)], HOJE, 3);
    expect(s.map((x) => x.rotulo)).toEqual(["12/10", "19/10", "26/10"]);
    expect(s.map((x) => x.treinos)).toEqual([0, 1, 2]);
    expect(s[2]!.volumeKg).toBe(2500);
  });

  it("série de medida ignora vazios, respeita o período e fica com o último registro do dia", () => {
    const m: Medida[] = [
      { data: "2026-10-01", pesoKg: 81 },
      { data: "2026-10-01", pesoKg: 80.8 },
      { data: "2026-10-03", pesoKg: null, cinturaCm: 90 },
      { data: "2026-01-01", pesoKg: 85 },
    ];
    expect(serieMedida(m, "pesoKg", intervalo(90, HOJE))).toEqual([{ data: "2026-10-01", valor: 80.8 }]);
    expect(serieMedida(m, "cinturaCm", intervalo(0, HOJE))).toEqual([{ data: "2026-10-03", valor: 90 }]);
  });

  it("progresso de carga pega a maior carga de cada treino, em ordem", () => {
    const p = progressoCarga([
      { data: new Date(2026, 9, 27, 18).toISOString(), series: [{ cargaKg: 60, reps: 8 }, { cargaKg: 62.5, reps: 6 }] },
      { data: new Date(2026, 9, 20, 18).toISOString(), series: [{ cargaKg: 60, reps: 10 }] },
      { data: new Date(2026, 9, 13, 18).toISOString(), series: [] },
    ]);
    expect(p).toEqual([
      { data: "2026-10-20", cargaMaxKg: 60, repsNaCargaMax: 10, volumeKg: 600 },
      { data: "2026-10-27", cargaMaxKg: 62.5, repsNaCargaMax: 6, volumeKg: 855 },
    ]);
  });
});

describe("validação de medidas", () => {
  const vazio = { data: "2026-10-28", pesoKg: "", gorduraPct: "", cinturaCm: "", quadrilCm: "", peitoCm: "", bracoCm: "", coxaCm: "", panturrilhaCm: "" };

  it("exige ao menos uma medida e data até hoje", () => {
    expect(validarMedida(vazio, HOJE).geral).toBeDefined();
    expect(validarMedida({ ...vazio, data: "2026-10-29", pesoKg: "80" }, HOJE).data).toMatch(/futuro/);
  });

  it("aceita vírgula e aponta valores fora da faixa", () => {
    expect(validarMedida({ ...vazio, pesoKg: "79,5" }, HOJE)).toEqual({});
    expect(validarMedida({ ...vazio, pesoKg: "800", bracoCm: "abc" }, HOJE)).toMatchObject({ pesoKg: expect.any(String), bracoCm: expect.any(String) });
  });

  it("converte para medida com vazios como null", () => {
    expect(paraMedida({ ...vazio, pesoKg: "79,5", cinturaCm: "88" })).toMatchObject({ data: "2026-10-28", pesoKg: 79.5, cinturaCm: 88, bracoCm: null });
  });
});

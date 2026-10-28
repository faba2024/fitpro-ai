import { describe, expect, it } from "vitest";
import { resumoSemanal } from "./semana";
import { inicioDaSemana } from "./datas";
import type { SessaoTreino } from "./tipos";

let seq = 0;
const sessao = (iso: string, status: SessaoTreino["status"] = "concluida"): SessaoTreino => ({
  id: String(++seq),
  planoSessaoId: "a",
  titulo: "Treino",
  status,
  iniciadaEm: new Date(iso).toISOString(),
  finalizadaEm: status === "concluida" ? new Date(iso).toISOString() : null,
  seriesConcluidas: 10,
  volumeKg: 1000,
});

// Quarta-feira, 28 out 2026, 10h
const HOJE = new Date(2026, 9, 28, 10);

describe("inicioDaSemana", () => {
  it("volta para a segunda-feira", () => {
    expect(inicioDaSemana(HOJE)).toEqual(new Date(2026, 9, 26));
  });
  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(inicioDaSemana(new Date(2026, 10, 1, 20))).toEqual(new Date(2026, 9, 26));
  });
});

describe("resumoSemanal", () => {
  it("marca dias feitos, hoje, passados e futuros", () => {
    const r = resumoSemanal([sessao("2026-10-26T18:00")], HOJE, 3);
    expect(r.dias.map((d) => d.status)).toEqual(["feito", "passado", "hoje", "futuro", "futuro", "futuro", "futuro"]);
    expect(r.feitos).toBe(1);
  });

  it("treino de hoje aparece como feito", () => {
    const r = resumoSemanal([sessao("2026-10-28T07:00")], HOJE, 3);
    expect(r.dias[2]!.status).toBe("feito");
  });

  it("ignora sessões abandonadas ou em andamento", () => {
    const r = resumoSemanal([sessao("2026-10-26T18:00", "abandonada"), sessao("2026-10-27T18:00", "em_andamento")], HOJE, 3);
    expect(r.feitos).toBe(0);
  });

  it("dois treinos no mesmo dia contam uma vez", () => {
    const r = resumoSemanal([sessao("2026-10-26T07:00"), sessao("2026-10-26T19:00")], HOJE, 3);
    expect(r.feitos).toBe(1);
  });

  it("conta semanas seguidas que bateram a meta sem penalizar a semana atual incompleta", () => {
    const sessoes = [
      // semana de 19/10: 2 treinos
      sessao("2026-10-19T18:00"),
      sessao("2026-10-21T18:00"),
      // semana de 12/10: 2 treinos
      sessao("2026-10-13T18:00"),
      sessao("2026-10-15T18:00"),
      // semana de 05/10: 1 treino (quebra)
      sessao("2026-10-06T18:00"),
    ];
    expect(resumoSemanal(sessoes, HOJE, 2).sequenciaSemanas).toBe(2);
  });

  it("semana atual entra na sequência quando a meta já foi batida", () => {
    const sessoes = [sessao("2026-10-26T18:00"), sessao("2026-10-27T18:00"), sessao("2026-10-20T18:00"), sessao("2026-10-22T18:00")];
    expect(resumoSemanal(sessoes, HOJE, 2).sequenciaSemanas).toBe(2);
  });

  it("sem histórico a sequência é zero", () => {
    expect(resumoSemanal([], HOJE, 3).sequenciaSemanas).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { duracaoEstimadaMin, duracaoRealMin, gruposDaSessao, proximaSessao, sessaoEmAndamento, ultimasConcluidas } from "./treino";
import type { Plano, PlanoSessao, SessaoTreino } from "./tipos";

const item = (grupo: string, series = 3, descansoS = 60) => ({ exercicioId: grupo, nome: grupo, grupo, series, repsMin: 8, repsMax: 12, descansoS });

const sessaoPlano = (id: string, itens = [item("Peito")]): PlanoSessao => ({ id, nome: id.toUpperCase(), titulo: id, itens });

const plano: Plano = { id: "p", nome: "ABC", objetivo: "hipertrofia", sessoes: [sessaoPlano("a"), sessaoPlano("b"), sessaoPlano("c")] };

const registro = (planoSessaoId: string, iso: string, status: SessaoTreino["status"] = "concluida"): SessaoTreino => ({
  id: iso,
  planoSessaoId,
  titulo: planoSessaoId,
  status,
  iniciadaEm: iso,
  finalizadaEm: status === "concluida" ? iso : null,
  seriesConcluidas: 0,
  volumeKg: 0,
});

describe("proximaSessao", () => {
  it("começa pela primeira sem histórico", () => {
    expect(proximaSessao(plano, [])?.id).toBe("a");
  });

  it("segue a divisão após a última concluída", () => {
    const hist = [registro("a", "2026-10-20T10:00:00Z"), registro("b", "2026-10-22T10:00:00Z")];
    expect(proximaSessao(plano, hist)?.id).toBe("c");
  });

  it("volta ao início depois da última sessão", () => {
    expect(proximaSessao(plano, [registro("c", "2026-10-22T10:00:00Z")])?.id).toBe("a");
  });

  it("ignora abandonadas e sessões de outros planos", () => {
    const hist = [registro("a", "2026-10-20T10:00:00Z"), registro("b", "2026-10-22T10:00:00Z", "abandonada"), registro("x", "2026-10-23T10:00:00Z")];
    expect(proximaSessao(plano, hist)?.id).toBe("b");
  });

  it("plano vazio não tem próxima sessão", () => {
    expect(proximaSessao({ ...plano, sessoes: [] }, [])).toBeNull();
  });
});

describe("duracaoEstimadaMin", () => {
  it("soma troca de aparelho, execução e descansos entre séries, arredondando para 5", () => {
    // 4 exercícios × (120s + 3×40s + 2×90s) = 4 × 420s = 28 min → 30
    const s = sessaoPlano("a", [item("A", 3, 90), item("B", 3, 90), item("C", 3, 90), item("D", 3, 90)]);
    expect(duracaoEstimadaMin(s)).toBe(30);
  });
  it("nunca devolve menos de 5 minutos", () => {
    expect(duracaoEstimadaMin(sessaoPlano("a", [item("A", 1, 0)]))).toBe(5);
  });
});

describe("utilitários de sessão", () => {
  it("lista grupos sem repetir", () => {
    expect(gruposDaSessao(sessaoPlano("a", [item("Peito"), item("Tríceps"), item("Peito")]))).toEqual(["Peito", "Tríceps"]);
  });

  it("encontra sessão em andamento para retomar", () => {
    expect(sessaoEmAndamento([registro("a", "2026-10-20T10:00:00Z"), registro("b", "2026-10-21T10:00:00Z", "em_andamento")])?.planoSessaoId).toBe("b");
  });

  it("ordena as últimas concluídas da mais recente para a mais antiga", () => {
    const hist = [registro("a", "2026-10-20T10:00:00Z"), registro("b", "2026-10-24T10:00:00Z"), registro("c", "2026-10-22T10:00:00Z")];
    expect(ultimasConcluidas(hist, 2).map((s) => s.planoSessaoId)).toEqual(["b", "c"]);
  });

  it("calcula a duração real em minutos", () => {
    const s = { ...registro("a", "2026-10-20T10:00:00Z"), finalizadaEm: "2026-10-20T10:52:30Z" };
    expect(duracaoRealMin(s)).toBe(53);
  });
});

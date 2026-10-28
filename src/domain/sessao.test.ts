import { describe, expect, it } from "vitest";
import { CATALOGO } from "@/data/catalogo";
import { PLANO_EXEMPLO } from "@/data/exemplo";
import {
  adicionarSerie,
  ajustarDescanso,
  atualizarSerie,
  concluirSerie,
  descansoRestanteMs,
  desfazerSerie,
  encerrar,
  iniciarSessao,
  paraSessaoTreino,
  pausar,
  progresso,
  pularDescanso,
  pularExercicio,
  removerSerie,
  resumoSessao,
  retomar,
  tempoAtivoMs,
  trocarNaSessao,
  validarSerie,
  volumeKg,
  type HistoricoExercicio,
  type SessaoAtiva,
} from "./sessao";

const T0 = Date.parse("2026-10-28T18:00:00Z");
const seg = (n: number) => T0 + n * 1000;
let n = 0;
const novoId = () => `id-${++n}`;
const tipoDe = (id: string) => CATALOGO.get(id)?.tipo ?? "isolado";

// treino A do exemplo: supino 4×8–10 (90 s), inclinado 3×10–12 (75 s), ...
const A = PLANO_EXEMPLO.sessoes[0]!;

function nova(historico: Record<string, HistoricoExercicio> = {}): SessaoAtiva {
  return iniciarSessao({ sessao: A, planoId: "p1", tipoDe, historico, agora: T0, novoId });
}

/** Preenche e conclui a série. */
function fazer(s: SessaoAtiva, ei: number, si: number, cargaKg: number, reps: number, t: number) {
  return concluirSerie(atualizarSerie(s, ei, si, { cargaKg, reps }, t), ei, si, t);
}

describe("início", () => {
  it("monta exercícios e séries a partir da ficha", () => {
    const s = nova();
    expect(s.exercicios).toHaveLength(A.itens.length);
    expect(s.exercicios[0]).toMatchObject({ exercicioId: "supino-reto-barra", tipo: "composto", alvo: { series: 4, repsMin: 8, repsMax: 10, descansoS: 90 } });
    expect(s.exercicios[0]!.series).toHaveLength(4);
    expect(progresso(s)).toMatchObject({ seriesFeitas: 0, exerciciosConcluidos: 0 });
  });

  it("sugere carga a partir do último treino", () => {
    const s = nova({ "supino-reto-barra": { ultimas: [{ cargaKg: 60, reps: 10 }, { cargaKg: 60, reps: 10 }], maxCargaKg: 60 } });
    expect(s.exercicios[0]!.sugestao).toMatchObject({ acao: "subir", cargaKg: 62.5 });
    expect(s.exercicios[0]!.series[0]!.cargaKg).toBe(62.5);
  });
});

describe("registrar séries", () => {
  it("não conclui sem repetições", () => {
    const s = nova();
    expect(validarSerie(s.exercicios[0]!.series[0]!, false)).toMatch(/repetições/);
    expect(concluirSerie(s, 0, 0, seg(10))).toBe(s);
  });

  it("concluir inicia o descanso e passa a carga para a próxima série", () => {
    const s = fazer(nova(), 0, 0, 50, 10, seg(60));
    expect(s.exercicios[0]!.series[0]).toMatchObject({ feita: true });
    expect(s.exercicios[0]!.series[1]!.cargaKg).toBe(50);
    expect(descansoRestanteMs(s, seg(60))).toBe(90_000);
    expect(descansoRestanteMs(s, seg(100))).toBe(50_000);
    expect(s.atual).toBe(0);
  });

  it("ao terminar todas as séries, avança para o próximo exercício", () => {
    let s = nova();
    for (let i = 0; i < 4; i++) s = fazer(s, 0, i, 50, 9, seg(100 * i));
    expect(s.atual).toBe(1);
  });

  it("pular exercício vai para o próximo pendente", () => {
    const s = pularExercicio(nova(), 0, seg(5));
    expect(s.exercicios[0]!.pulado).toBe(true);
    expect(s.atual).toBe(1);
    expect(progresso(s).exerciciosConcluidos).toBe(1);
  });

  it("desfazer reabre a série", () => {
    const s = desfazerSerie(fazer(nova(), 0, 0, 50, 10, seg(1)), 0, 0, seg(2));
    expect(s.exercicios[0]!.series[0]!.feita).toBe(false);
  });

  it("adiciona e remove séries sem apagar série feita", () => {
    let s = adicionarSerie(nova(), 0, novoId, seg(1));
    expect(s.exercicios[0]!.series).toHaveLength(5);
    s = removerSerie(s, 0, seg(2));
    expect(s.exercicios[0]!.series).toHaveLength(4);
    let um = nova();
    for (let i = 0; i < 3; i++) um = removerSerie(um, 1, seg(3));
    expect(um.exercicios[1]!.series).toHaveLength(1); // nunca fica sem série
  });

  it("troca exercício só antes de começar", () => {
    const flexao = { exercicioId: "flexao", nome: "Flexão de braço", tipo: "composto" as const, porTempo: false, alvo: { series: 3, repsMin: 8, repsMax: 12, descansoS: 60 } };
    expect(trocarNaSessao(nova(), 0, flexao, novoId, seg(1)).exercicios[0]!.exercicioId).toBe("flexao");
    const comecado = fazer(nova(), 0, 0, 50, 10, seg(1));
    expect(trocarNaSessao(comecado, 0, flexao, novoId, seg(2))).toBe(comecado);
  });
});

describe("tempo, pausa e descanso", () => {
  it("pausa congela tempo e descanso; retomar empurra o fim do descanso", () => {
    let s = fazer(nova(), 0, 0, 50, 10, seg(60)); // descanso até 150 s
    s = pausar(s, seg(100));
    expect(tempoAtivoMs(s, seg(400))).toBe(100_000);
    expect(descansoRestanteMs(s, seg(400))).toBe(50_000);
    s = retomar(s, seg(400)); // pausa de 300 s
    expect(s.pausaMs).toBe(300_000);
    expect(descansoRestanteMs(s, seg(400))).toBe(50_000);
    expect(tempoAtivoMs(s, seg(460))).toBe(160_000);
  });

  it("ajusta e pula o descanso", () => {
    let s = fazer(nova(), 0, 0, 50, 10, seg(0));
    s = ajustarDescanso(s, 15, seg(10));
    expect(descansoRestanteMs(s, seg(10))).toBe(95_000);
    s = ajustarDescanso(s, -500, seg(10));
    expect(descansoRestanteMs(s, seg(10))).toBe(0);
    expect(pularDescanso(fazer(nova(), 0, 0, 50, 10, seg(0)), seg(1)).descanso).toBeNull();
  });
});

describe("encerrar e resumo", () => {
  it("sem nenhuma série vira abandonada", () => {
    expect(encerrar(nova(), seg(30)).status).toBe("abandonada");
  });

  it("calcula volume, melhor série, recorde e próxima carga", () => {
    const hist = { "supino-reto-barra": { ultimas: [{ cargaKg: 50, reps: 10 }], maxCargaKg: 55 } };
    let s = nova(hist);
    s = fazer(s, 0, 0, 57.5, 10, seg(60));
    s = fazer(s, 0, 1, 57.5, 10, seg(200));
    s = fazer(s, 1, 0, 20, 12, seg(400));
    s = encerrar(s, seg(30 * 60));
    expect(s.status).toBe("concluida");
    expect(volumeKg(s)).toBe(57.5 * 20 + 20 * 12);
    const r = resumoSessao(s, hist, seg(30 * 60));
    expect(r).toMatchObject({ duracaoMin: 30, seriesFeitas: 3, recordes: 1 });
    expect(r.exercicios[0]).toMatchObject({ exercicioId: "supino-reto-barra", melhor: { cargaKg: 57.5, reps: 10 }, recorde: true });
    expect(r.exercicios[0]!.proxima?.acao).toBe("subir");
    // exercício sem histórico não conta como recorde
    expect(r.exercicios[1]!.recorde).toBe(false);
    expect(paraSessaoTreino(s)).toMatchObject({ status: "concluida", seriesConcluidas: 3, volumeKg: 57.5 * 20 + 240 });
  });

  it("encerrar durante a pausa não conta a pausa como treino", () => {
    let s = fazer(nova(), 0, 0, 50, 10, seg(60));
    s = pausar(s, seg(120));
    s = encerrar(s, seg(1000));
    expect(tempoAtivoMs(s, seg(5000))).toBe(120_000);
  });
});

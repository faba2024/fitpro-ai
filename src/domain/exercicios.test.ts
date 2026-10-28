import { describe, expect, it } from "vitest";
import { CATALOGO, EXERCICIOS } from "@/data/catalogo";
import {
  adequadoAoNivel,
  alternativasPossiveis,
  disponivel,
  exerciciosDoMusculo,
  filtrar,
  MUSCULOS,
  grupoDoExercicio,
  normalizar,
  objetivosIndicados,
  prescricao,
  prescricaoDoExercicio,
  urlImagem,
} from "./exercicios";

const ex = (id: string) => CATALOGO.get(id)!;

describe("disponibilidade por equipamento", () => {
  it("academia completa libera tudo", () => {
    expect(EXERCICIOS.every((e) => disponivel(e, ["academia_completa"]))).toBe(true);
  });

  it("peso corporal está sempre disponível", () => {
    expect(disponivel(ex("flexao"), [])).toBe(true);
  });

  it("exige todos os equipamentos do exercício", () => {
    expect(disponivel(ex("supino-inclinado-halteres"), ["halteres"])).toBe(false);
    expect(disponivel(ex("supino-inclinado-halteres"), ["halteres", "banco"])).toBe(true);
  });

  it("paralelas só com academia completa", () => {
    expect(disponivel(ex("mergulho-paralelas"), ["halteres", "barra_fixa"])).toBe(false);
  });
});

describe("prescrição", () => {
  it("segue a tabela por objetivo e tipo", () => {
    expect(prescricao("hipertrofia", "intermediario", "composto")).toEqual({ series: 4, repsMin: 6, repsMax: 10, descansoS: 120 });
    expect(prescricao("forca", "avancado", "composto").repsMax).toBe(6);
    expect(prescricao("condicionamento", "intermediario", "isolado").descansoS).toBe(30);
  });

  it("iniciante faz uma série a menos, com mínimo de 2", () => {
    expect(prescricao("hipertrofia", "iniciante", "composto").series).toBe(3);
    expect(prescricao("condicionamento", "iniciante", "isolado").series).toBe(2);
  });

  it("isometrias usam segundos", () => {
    expect(prescricaoDoExercicio(ex("prancha"), "saude", "iniciante")).toMatchObject({ unidade: "s", repsMin: 20, repsMax: 30 });
    expect(prescricaoDoExercicio(ex("supino-reto-barra"), "saude", "iniciante").unidade).toBe("reps");
  });
});

describe("classificação", () => {
  it("grupo pelo primeiro músculo principal", () => {
    expect(grupoDoExercicio(ex("triceps-polia"))).toBe("bracos");
    expect(grupoDoExercicio(ex("elevacao-pelvica"))).toBe("gluteos");
  });

  it("nível: avançado não aparece para iniciante", () => {
    expect(adequadoAoNivel(ex("elevacao-pernas-barra"), "iniciante")).toBe(false);
    expect(adequadoAoNivel(ex("prancha"), "avancado")).toBe(true);
  });

  it("objetivos indicados seguem a regra explícita", () => {
    expect(objetivosIndicados(ex("agachamento-livre"))).toEqual(expect.arrayContaining(["forca", "condicionamento"]));
    expect(objetivosIndicados(ex("cadeira-extensora"))).not.toContain("forca");
    expect(objetivosIndicados(ex("prancha"))).toContain("condicionamento");
  });
});

describe("busca e filtros", () => {
  it("ignora acentos e maiúsculas", () => {
    expect(normalizar("Tríceps Francês")).toBe("triceps frances");
    expect(filtrar(EXERCICIOS, { texto: "TRICEPS frances" }).map((e) => e.id)).toEqual(["triceps-frances"]);
  });

  it("encontra pelo nome do músculo", () => {
    const ids = filtrar(EXERCICIOS, { texto: "panturrilha" }).map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["panturrilha-em-pe", "panturrilha-sentado", "mesa-flexora"]));
  });

  it("combina grupo, dificuldade e equipamentos", () => {
    const r = filtrar(EXERCICIOS, { grupo: "peito", dificuldade: "iniciante", equipamentos: ["peso_corporal"] });
    expect(r.map((e) => e.id)).toEqual(["flexao"]);
  });

  it("filtra por músculo principal ou secundário", () => {
    const r = filtrar(EXERCICIOS, { musculo: "triceps" });
    expect(r.map((e) => e.id)).toEqual(expect.arrayContaining(["triceps-polia", "supino-reto-barra"]));
  });

  it("filtra favoritos", () => {
    expect(filtrar(EXERCICIOS, { favoritos: new Set(["prancha"]) }).map((e) => e.id)).toEqual(["prancha"]);
  });
});

describe("exercícios por músculo", () => {
  it("separa principal e secundário, sem repetir", () => {
    const { principais, secundarios } = exerciciosDoMusculo(EXERCICIOS, "triceps");
    expect(principais.map((e) => e.id)).toContain("triceps-polia");
    expect(secundarios.map((e) => e.id)).toContain("supino-reto-barra");
    expect(principais.filter((e) => secundarios.includes(e))).toEqual([]);
  });

  it("ordena do mais fácil para o mais difícil", () => {
    const { principais } = exerciciosDoMusculo(EXERCICIOS, "abdomen");
    const ordem = { iniciante: 0, intermediario: 1, avancado: 2 };
    const niveis = principais.map((e) => ordem[e.dificuldade]);
    expect(niveis).toEqual([...niveis].sort((a, b) => a - b));
  });

  it("aplica filtros de equipamento e nível", () => {
    const { principais } = exerciciosDoMusculo(EXERCICIOS, "peitoral", { equipamentos: ["peso_corporal"], dificuldade: "iniciante" });
    expect(principais.map((e) => e.id)).toEqual(["flexao"]);
  });

  it("todo músculo tem pelo menos um exercício como principal ou secundário", () => {
    for (const m of Object.keys(MUSCULOS) as (keyof typeof MUSCULOS)[]) {
      const r = exerciciosDoMusculo(EXERCICIOS, m);
      expect(r.principais.length + r.secundarios.length, m).toBeGreaterThan(0);
    }
  });
});

describe("alternativas e imagens", () => {
  it("mostra só alternativas possíveis com o equipamento da pessoa", () => {
    const alts = alternativasPossiveis(ex("supino-reto-barra"), CATALOGO, ["peso_corporal"]).map((e) => e.id);
    expect(alts).toEqual(["flexao"]);
  });

  it("url da imagem aponta para a versão fixa do acervo", () => {
    expect(urlImagem(ex("flexao"), 1)).toMatch(/free-exercise-db@[0-9a-f]{40}\/exercises\/Pushups\/1\.jpg$/);
  });
});

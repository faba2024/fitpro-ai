import { describe, expect, it } from "vitest";
import { CATALOGO, EXERCICIOS } from "@/data/catalogo";
import { disponivel, adequadoAoNivel } from "./exercicios";
import { avaliarVolume, candidatos, conferirPlano, escolherDivisao, gerarPlano, LIMITES_VOLUME, treinosPorSemana, volumeSemanal } from "./motor";
import { incremento, sugerirProximaCarga } from "./progressao";
import { duracaoEstimadaMin } from "./treino";
import type { ParametrosPlano, Plano } from "./tipos";

let n = 0;
const id = () => `id-${++n}`;

const base: ParametrosPlano = {
  objetivo: "hipertrofia",
  nivel: "intermediario",
  diasSemana: 4,
  minutosSessao: 60,
  equipamentos: ["academia_completa"],
  conservador: false,
};

const combinacoes: ParametrosPlano[] = [];
for (const dias of [1, 2, 3, 4, 5, 6, 7])
  for (const nivel of ["iniciante", "intermediario", "avancado"] as const)
    for (const objetivo of ["hipertrofia", "forca", "saude"] as const)
      for (const equipamentos of [["academia_completa"], ["halteres", "banco"], ["peso_corporal"]] as ParametrosPlano["equipamentos"][])
        combinacoes.push({ ...base, diasSemana: dias, nivel, objetivo, equipamentos, minutosSessao: 45 });

describe("divisão semanal", () => {
  it("varia com os dias e limita a 6 treinos", () => {
    expect(escolherDivisao(1, "intermediario", "hipertrofia").sessoes).toHaveLength(1);
    expect(escolherDivisao(3, "iniciante", "hipertrofia").nome).toMatch(/Corpo inteiro/);
    expect(escolherDivisao(3, "intermediario", "hipertrofia").nome).toMatch(/Empurrar/);
    expect(escolherDivisao(4, "avancado", "forca").nome).toMatch(/Superiores/);
    expect(escolherDivisao(7, "avancado", "forca").sessoes).toHaveLength(6);
  });

  it("iniciante faz no máximo 4 treinos de musculação e o plano explica o porquê", () => {
    expect(treinosPorSemana(6, "iniciante")).toBe(4);
    expect(treinosPorSemana(6, "intermediario")).toBe(6);
    const plano = gerarPlano({ ...base, nivel: "iniciante", diasSemana: 6 }, EXERCICIOS, id);
    expect(plano.sessoes).toHaveLength(4);
    expect(plano.explicacao).toMatch(/até 4 treinos/);
  });
});

describe("escolha de exercícios", () => {
  it("só usa exercícios possíveis com o equipamento e adequados ao nível", () => {
    for (const p of combinacoes) {
      const plano = gerarPlano(p, EXERCICIOS, id);
      for (const s of plano.sessoes)
        for (const i of s.itens) {
          const ex = CATALOGO.get(i.exercicioId)!;
          expect(disponivel(ex, p.equipamentos), `${i.exercicioId} com ${p.equipamentos}`).toBe(true);
          expect(adequadoAoNivel(ex, p.nivel), `${i.exercicioId} para ${p.nivel}`).toBe(true);
        }
    }
  });

  it("não repete exercício dentro do mesmo treino", () => {
    for (const p of combinacoes) {
      for (const s of gerarPlano(p, EXERCICIOS, id).sessoes) {
        const ids = s.itens.map((i) => i.exercicioId);
        expect(new Set(ids).size, s.titulo).toBe(ids.length);
      }
    }
  });

  it("respeita preferência: posterior de ombro no treino de puxar", () => {
    const c = candidatos({ alvo: "ombros", tipo: "isolado", preferir: ["face-pull", "crucifixo-inverso"] }, EXERCICIOS, base);
    expect(c[0]!.id).toBe("face-pull");
  });

  it("modo conservador não usa exercícios avançados nem para avançados", () => {
    const plano = gerarPlano({ ...base, nivel: "avancado", conservador: true }, EXERCICIOS, id);
    for (const s of plano.sessoes) for (const i of s.itens) expect(CATALOGO.get(i.exercicioId)!.dificuldade).not.toBe("avancado");
  });

  it("segunda ocorrência do mesmo treino na semana varia os exercícios", () => {
    const plano = gerarPlano({ ...base, diasSemana: 4 }, EXERCICIOS, id);
    const [sup1, , sup2] = plano.sessoes;
    expect(sup1!.itens.map((i) => i.exercicioId)).not.toEqual(sup2!.itens.map((i) => i.exercicioId));
  });
});

describe("tempo e volume", () => {
  it("cada treino tem entre 3 e 8 exercícios e cabe no tempo (com folga de 10 min)", () => {
    for (const p of combinacoes) {
      for (const s of gerarPlano(p, EXERCICIOS, id).sessoes) {
        expect(s.itens.length).toBeGreaterThanOrEqual(3);
        expect(s.itens.length).toBeLessThanOrEqual(8);
        if (s.itens.length > 3) expect(duracaoEstimadaMin(s), s.titulo).toBeLessThanOrEqual(p.minutosSessao + 10);
      }
    }
  });

  it("mais tempo disponível gera treinos maiores", () => {
    const curto = gerarPlano({ ...base, minutosSessao: 30 }, EXERCICIOS, id);
    const longo = gerarPlano({ ...base, minutosSessao: 90 }, EXERCICIOS, id);
    expect(longo.sessoes[0]!.itens.length).toBeGreaterThan(curto.sessoes[0]!.itens.length);
  });

  it("nenhum grupo principal passa do volume máximo do nível (abdômen fica fora do limite)", () => {
    for (const p of combinacoes) {
      const plano = gerarPlano(p, EXERCICIOS, id);
      for (const [g, v] of volumeSemanal(plano, treinosPorSemana(p.diasSemana, p.nivel), CATALOGO)) {
        if (g !== "abdomen") expect(v, `${g} ${p.nivel} ${p.diasSemana}d`).toBeLessThanOrEqual(LIMITES_VOLUME[p.nivel].max);
      }
    }
  });

  it("calcula o volume semanal com frequência e séries secundárias pela metade", () => {
    const plano: Plano = {
      id: "p",
      nome: "t",
      objetivo: "hipertrofia",
      sessoes: [{ id: "a", nome: "A", titulo: "A", itens: [{ exercicioId: "supino-reto-barra", nome: "", grupo: "", series: 4, repsMin: 6, repsMax: 10, descansoS: 90 }] }],
    };
    const v = volumeSemanal(plano, 2, CATALOGO); // 1 sessão feita 2× por semana
    expect(v.get("peito")).toBe(8);
    expect(v.get("bracos")).toBe(4); // tríceps secundário: 4 × 0,5 × 2
    expect(avaliarVolume(v, "iniciante").get("peito")).toBe("ok");
  });
});

describe("conferência do plano", () => {
  it("plano gerado não tem erros nem alertas de volume alto", () => {
    for (const p of combinacoes) {
      const avisos = conferirPlano(gerarPlano(p, EXERCICIOS, id), p, CATALOGO);
      expect(avisos.filter((a) => a.nivel === "erro")).toEqual([]);
      expect(avisos.filter((a) => /acima de \d+ séries/.test(a.texto))).toEqual([]);
    }
  });

  it("aponta treino vazio, exercício repetido e treino longo demais", () => {
    const plano = gerarPlano(base, EXERCICIOS, id);
    plano.sessoes[0]!.itens = [];
    const it = plano.sessoes[1]!.itens[0]!;
    plano.sessoes[1]!.itens.push({ ...it }, ...Array.from({ length: 6 }, () => ({ ...it, series: 5 })));
    const textos = conferirPlano(plano, base, CATALOGO).map((a) => a.texto).join("\n");
    expect(textos).toMatch(/Treino A está sem exercícios/);
    expect(textos).toMatch(/Treino B tem o mesmo exercício duas vezes/);
    expect(textos).toMatch(/Treino B deve levar cerca de/);
  });

  it("alerta quando o mesmo grupo é treinado pesado em treinos seguidos", () => {
    const pesado = (exercicioId: string) => ({ exercicioId, nome: "", grupo: "", series: 5, repsMin: 8, repsMax: 10, descansoS: 90 });
    const pernas = (sid: string, nome: string) => ({ id: sid, nome, titulo: "Pernas", itens: [pesado("agachamento-livre"), pesado("leg-press")] });
    const peito = { id: "c", nome: "C", titulo: "Peito", itens: [pesado("supino-reto-barra")] };
    const plano: Plano = { id: "p", nome: "t", objetivo: "hipertrofia", sessoes: [pernas("a", "A"), pernas("b", "B"), peito] };
    const textos = conferirPlano(plano, { ...base, diasSemana: 3, nivel: "avancado" }, CATALOGO).map((a) => a.texto);
    expect(textos.some((t) => /Pernas é treinado pesado nos treinos A e B/.test(t))).toBe(true);
    // B → C não tem conflito
    expect(textos.some((t) => /treinos B e C/.test(t))).toBe(false);
  });

  it("explica o plano conservador", () => {
    const p = { ...base, conservador: true };
    expect(conferirPlano(gerarPlano(p, EXERCICIOS, id), p, CATALOGO).some((a) => /conservador/.test(a.texto))).toBe(true);
  });
});

describe("progressão de carga", () => {
  const faixa = { repsMin: 8, repsMax: 12 };

  it("sem séries registradas pede para definir a carga", () => {
    expect(sugerirProximaCarga(faixa, "composto", []).acao).toBe("definir");
  });

  it("todas as séries no topo da faixa → sobe", () => {
    const s = sugerirProximaCarga(faixa, "composto", [{ cargaKg: 40, reps: 12 }, { cargaKg: 40, reps: 12 }, { cargaKg: 40, reps: 12 }]);
    expect(s).toMatchObject({ acao: "subir", cargaKg: 42.5 });
  });

  it("dentro da faixa → mantém", () => {
    const s = sugerirProximaCarga(faixa, "isolado", [{ cargaKg: 10, reps: 12 }, { cargaKg: 10, reps: 10 }]);
    expect(s).toMatchObject({ acao: "manter", cargaKg: 10 });
  });

  it("abaixo do mínimo → reduz cerca de 10%", () => {
    const s = sugerirProximaCarga(faixa, "composto", [{ cargaKg: 60, reps: 8 }, { cargaKg: 60, reps: 6 }]);
    expect(s).toMatchObject({ acao: "reduzir", cargaKg: 55 });
  });

  it("ignora séries de aquecimento mais leves", () => {
    const s = sugerirProximaCarga(faixa, "composto", [{ cargaKg: 20, reps: 15 }, { cargaKg: 40, reps: 12 }, { cargaKg: 40, reps: 12 }]);
    expect(s.acao).toBe("subir");
  });

  it("incremento cresce com a carga, em passos de anilha", () => {
    expect(incremento("isolado", 8)).toBe(1);
    expect(incremento("composto", 40)).toBe(2.5);
    expect(incremento("composto", 120)).toBe(5);
  });
});

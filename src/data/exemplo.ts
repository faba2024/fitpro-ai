// Dados de exemplo para conhecer o app no modo local. Sempre exibidos com aviso "Exemplo".
import { chaveDia, inicioDaSemana, somarDias } from "@/domain/datas";
import type { DadosUsuario, ItemPlano, Plano, SessaoTreino } from "@/domain/tipos";

const it = (exercicioId: string, nome: string, grupo: string, series: number, repsMin: number, repsMax: number, descansoS: number): ItemPlano => ({
  exercicioId, nome, grupo, series, repsMin, repsMax, descansoS,
});

export const PLANO_EXEMPLO: Plano = {
  id: "plano-exemplo",
  nome: "ABC · Hipertrofia",
  objetivo: "hipertrofia",
  sessoes: [
    {
      id: "a",
      nome: "A",
      titulo: "Peito e tríceps",
      itens: [
        it("supino-reto-barra", "Supino reto com barra", "Peito", 4, 8, 10, 90),
        it("supino-inclinado-halteres", "Supino inclinado com halteres", "Peito", 3, 10, 12, 75),
        it("crucifixo-maquina", "Crucifixo na máquina", "Peito", 3, 12, 15, 60),
        it("triceps-polia", "Tríceps na polia", "Tríceps", 3, 10, 12, 60),
        it("triceps-frances", "Tríceps francês com halter", "Tríceps", 3, 10, 12, 60),
      ],
    },
    {
      id: "b",
      nome: "B",
      titulo: "Costas e bíceps",
      itens: [
        it("puxada-frente", "Puxada na frente", "Costas", 4, 8, 10, 90),
        it("remada-curvada", "Remada curvada com barra", "Costas", 3, 8, 10, 90),
        it("remada-baixa", "Remada baixa no cabo", "Costas", 3, 10, 12, 75),
        it("rosca-direta", "Rosca direta com barra", "Bíceps", 3, 10, 12, 60),
        it("rosca-martelo", "Rosca martelo", "Bíceps", 3, 10, 12, 60),
      ],
    },
    {
      id: "c",
      nome: "C",
      titulo: "Pernas e ombros",
      itens: [
        it("agachamento-livre", "Agachamento livre", "Pernas", 4, 6, 8, 120),
        it("leg-press", "Leg press 45°", "Pernas", 3, 10, 12, 90),
        it("cadeira-flexora", "Cadeira flexora", "Pernas", 3, 10, 12, 60),
        it("desenvolvimento-halteres", "Desenvolvimento com halteres", "Ombros", 3, 8, 10, 75),
        it("elevacao-lateral", "Elevação lateral", "Ombros", 3, 12, 15, 60),
      ],
    },
  ],
};

/** Histórico das últimas 3 semanas + semana atual até ontem, relativo a `hoje`. */
export function gerarExemplo(hoje: Date): DadosUsuario {
  const semana = inicioDaSemana(hoje);
  const sessoes: SessaoTreino[] = [];
  const ordem = PLANO_EXEMPLO.sessoes;
  let n = 0;

  for (let s = 3; s >= 0; s--) {
    for (const diaSemana of [0, 2, 4]) {
      const dia = somarDias(semana, -7 * s + diaSemana);
      if (dia >= somarDias(hoje, 0) || chaveDia(dia) === chaveDia(hoje)) continue;
      const ps = ordem[n % ordem.length]!;
      const inicio = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 18, 30);
      const fim = new Date(inicio.getTime() + (50 + (n % 3) * 5) * 60000);
      sessoes.push({
        id: `ex-${n}`,
        planoSessaoId: ps.id,
        titulo: ps.titulo,
        status: "concluida",
        iniciadaEm: inicio.toISOString(),
        finalizadaEm: fim.toISOString(),
        seriesConcluidas: ps.itens.reduce((t, i) => t + i.series, 0),
        volumeKg: 6200 + n * 180,
      });
      n++;
    }
  }

  const medidas = Array.from({ length: 6 }, (_, i) => ({
    data: chaveDia(somarDias(hoje, -7 * (5 - i))),
    pesoKg: Math.round((81.2 - i * 0.5) * 10) / 10,
  }));

  return {
    perfil: { nome: "Visitante", objetivo: "hipertrofia", nivel: "intermediario", metaSemanal: 3, minutosSessao: 60 },
    perfilCompleto: null,
    plano: PLANO_EXEMPLO,
    sessoes,
    medidas,
  };
}

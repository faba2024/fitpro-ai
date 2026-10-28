import { chaveDia, DIAS_CURTOS, inicioDaSemana, inicioDoDia, somarDias } from "./datas";
import type { SessaoTreino } from "./tipos";

export type StatusDia = "feito" | "hoje" | "futuro" | "passado";

export interface DiaSemana {
  data: Date;
  rotulo: (typeof DIAS_CURTOS)[number];
  status: StatusDia;
}

export interface ResumoSemanal {
  dias: DiaSemana[];
  feitos: number;
  meta: number;
  /** semanas seguidas (até a atual) em que a meta foi batida */
  sequenciaSemanas: number;
}

const concluidas = (sessoes: SessaoTreino[]) => sessoes.filter((s) => s.status === "concluida");

/** Dias (AAAA-MM-DD) com pelo menos um treino concluído. */
function diasComTreino(sessoes: SessaoTreino[]): Set<string> {
  return new Set(concluidas(sessoes).map((s) => chaveDia(new Date(s.iniciadaEm))));
}

function treinosNaSemana(dias: Set<string>, inicio: Date): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (dias.has(chaveDia(somarDias(inicio, i)))) n++;
  return n;
}

export function resumoSemanal(sessoes: SessaoTreino[], hoje: Date, meta: number): ResumoSemanal {
  const comTreino = diasComTreino(sessoes);
  const inicio = inicioDaSemana(hoje);
  const hojeDia = inicioDoDia(hoje).getTime();

  const dias: DiaSemana[] = DIAS_CURTOS.map((rotulo, i) => {
    const data = somarDias(inicio, i);
    const t = data.getTime();
    const status: StatusDia = comTreino.has(chaveDia(data)) ? "feito" : t === hojeDia ? "hoje" : t > hojeDia ? "futuro" : "passado";
    return { data, rotulo, status };
  });

  const feitos = dias.filter((d) => d.status === "feito").length;

  // A semana atual entra na sequência se já bateu a meta; se ainda não, não quebra.
  let sequencia = feitos >= meta ? 1 : 0;
  for (let semana = somarDias(inicio, -7); ; semana = somarDias(semana, -7)) {
    if (meta <= 0 || treinosNaSemana(comTreino, semana) < meta) break;
    sequencia++;
  }

  return { dias, feitos, meta, sequenciaSemanas: sequencia };
}

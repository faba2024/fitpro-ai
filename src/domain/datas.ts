// Datas no fuso local do aparelho. Semana começa na segunda-feira.

export const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function somarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

/** Segunda-feira 00:00 da semana de `d`. */
export function inicioDaSemana(d: Date): Date {
  const dia = inicioDoDia(d);
  const offset = (dia.getDay() + 6) % 7; // domingo = 6
  return somarDias(dia, -offset);
}

export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** AAAA-MM-DD no fuso local. */
export function chaveDia(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
}

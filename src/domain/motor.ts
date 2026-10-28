// Motor de treinos: monta e confere fichas com regras explícitas e testáveis (motor.test.ts).
// Não usa IA. Não define carga por idade ou peso: a carga inicial fica para a pessoa
// escolher pela técnica e pelo esforço percebido.
import {
  adequadoAoNivel,
  disponivel,
  GRUPOS,
  grupoDoMusculo,
  prescricaoDoExercicio,
  type Exercicio,
  type Grupo,
  type Musculo,
} from "./exercicios";
import { duracaoEstimadaMin } from "./treino";
import type { ItemPlano, Nivel, Objetivo, ParametrosPlano, Plano, PlanoSessao } from "./tipos";

// ───────────────────────── modelos de sessão ─────────────────────────

interface Vaga {
  alvo: Musculo;
  tipo?: Exercicio["tipo"];
  /** ids preferidos, na ordem, antes da regra geral */
  preferir?: string[];
}

interface ModeloSessao {
  titulo: string;
  /** em ordem de prioridade: o tempo disponível corta do fim */
  vagas: Vaga[];
}

const POSTERIOR_OMBRO = ["face-pull", "crucifixo-inverso", "abertura-elastico"];
const LATERAL_OMBRO = ["elevacao-lateral"];
// o terra trabalha posteriores, glúteos e lombar ao mesmo tempo: fica como última opção automática
const POSTERIORES = ["stiff", "terra-unilateral-kettlebell", "mesa-flexora"];
const GLUTEOS = ["elevacao-pelvica", "ponte-gluteo", "swing-kettlebell"];

const MODELOS = {
  corpoA: {
    titulo: "Corpo inteiro A",
    vagas: [
      { alvo: "quadriceps", tipo: "composto" },
      { alvo: "peitoral", tipo: "composto" },
      { alvo: "dorsais", tipo: "composto" },
      { alvo: "posteriores", tipo: "composto", preferir: POSTERIORES },
      { alvo: "ombros", tipo: "composto" },
      { alvo: "abdomen" },
      { alvo: "biceps", tipo: "isolado" },
      { alvo: "triceps", tipo: "isolado" },
    ],
  },
  corpoB: {
    titulo: "Corpo inteiro B",
    vagas: [
      { alvo: "gluteos", tipo: "composto", preferir: GLUTEOS },
      { alvo: "meio_costas", tipo: "composto" },
      { alvo: "peitoral", tipo: "composto" },
      { alvo: "quadriceps", tipo: "composto" },
      { alvo: "ombros", tipo: "isolado", preferir: LATERAL_OMBRO },
      { alvo: "abdomen" },
      { alvo: "panturrilhas" },
    ],
  },
  corpoC: {
    titulo: "Corpo inteiro C",
    vagas: [
      { alvo: "quadriceps", tipo: "composto" },
      { alvo: "dorsais", tipo: "composto" },
      { alvo: "peitoral", tipo: "composto" },
      { alvo: "posteriores", preferir: POSTERIORES },
      { alvo: "ombros", tipo: "isolado", preferir: POSTERIOR_OMBRO },
      { alvo: "triceps", tipo: "isolado" },
      { alvo: "biceps", tipo: "isolado" },
      { alvo: "abdomen" },
    ],
  },
  empurrar: {
    titulo: "Peito, ombros e tríceps",
    vagas: [
      { alvo: "peitoral", tipo: "composto" },
      { alvo: "ombros", tipo: "composto" },
      { alvo: "peitoral", tipo: "composto" },
      { alvo: "ombros", tipo: "isolado", preferir: LATERAL_OMBRO },
      { alvo: "peitoral", tipo: "isolado" },
      { alvo: "triceps", tipo: "isolado" },
      { alvo: "triceps" },
    ],
  },
  puxar: {
    titulo: "Costas e bíceps",
    vagas: [
      { alvo: "dorsais", tipo: "composto" },
      { alvo: "meio_costas", tipo: "composto" },
      { alvo: "meio_costas", tipo: "composto" },
      { alvo: "ombros", tipo: "isolado", preferir: POSTERIOR_OMBRO },
      { alvo: "biceps", tipo: "isolado" },
      { alvo: "biceps", tipo: "isolado" },
      { alvo: "trapezio" },
    ],
  },
  pernas: {
    titulo: "Pernas e glúteos",
    vagas: [
      { alvo: "quadriceps", tipo: "composto" },
      { alvo: "posteriores", tipo: "composto", preferir: POSTERIORES },
      { alvo: "gluteos", preferir: GLUTEOS },
      { alvo: "quadriceps" },
      { alvo: "posteriores", tipo: "isolado" },
      { alvo: "panturrilhas" },
      { alvo: "abdomen" },
    ],
  },
  superiores: {
    titulo: "Superiores",
    vagas: [
      { alvo: "peitoral", tipo: "composto" },
      { alvo: "meio_costas", tipo: "composto" },
      { alvo: "ombros", tipo: "composto" },
      { alvo: "dorsais", tipo: "composto" },
      { alvo: "ombros", tipo: "isolado", preferir: LATERAL_OMBRO },
      { alvo: "biceps", tipo: "isolado" },
      { alvo: "triceps", tipo: "isolado" },
    ],
  },
  inferiores: {
    titulo: "Inferiores",
    vagas: [
      { alvo: "quadriceps", tipo: "composto" },
      { alvo: "posteriores", tipo: "composto", preferir: POSTERIORES },
      { alvo: "gluteos", preferir: GLUTEOS },
      { alvo: "quadriceps", tipo: "isolado" },
      { alvo: "posteriores", tipo: "isolado" },
      { alvo: "panturrilhas" },
      { alvo: "abdomen" },
    ],
  },
} satisfies Record<string, ModeloSessao>;

type NomeModelo = keyof typeof MODELOS;

export interface Divisao {
  nome: string;
  explicacao: string;
  sessoes: NomeModelo[];
}

/**
 * Treinos de musculação por semana: até 6 (um dia de descanso completo é obrigatório)
 * e até 4 para iniciantes (os outros dias ficam para caminhada, alongamento ou descanso).
 */
export function treinosPorSemana(diasSemana: number, nivel: Nivel): number {
  return Math.max(1, Math.min(nivel === "iniciante" ? 4 : 6, Math.round(diasSemana)));
}

/** Divisão semanal pelo número de treinos possíveis na semana. */
export function escolherDivisao(diasSemana: number, nivel: Nivel, objetivo: Objetivo): Divisao {
  const dias = treinosPorSemana(diasSemana, nivel);
  const corpoInteiro = nivel === "iniciante" || objetivo === "saude" || objetivo === "condicionamento" || objetivo === "emagrecimento";
  switch (dias) {
    case 1:
      return { nome: "Corpo inteiro", sessoes: ["corpoA"], explicacao: "Com 1 dia por semana, um treino de corpo inteiro trabalha todos os grupos." };
    case 2:
      return { nome: "Corpo inteiro A/B", sessoes: ["corpoA", "corpoB"], explicacao: "Com 2 dias, dois treinos de corpo inteiro diferentes estimulam cada grupo duas vezes por semana." };
    case 3:
      return corpoInteiro
        ? { nome: "Corpo inteiro A/B/C", sessoes: ["corpoA", "corpoB", "corpoC"], explicacao: "Com 3 dias, treinos de corpo inteiro dão frequência alta com volume moderado por sessão, o ideal para quem está começando ou busca saúde e condicionamento." }
        : { nome: "Empurrar, puxar e pernas", sessoes: ["empurrar", "puxar", "pernas"], explicacao: "Com 3 dias e mais experiência, a divisão empurrar/puxar/pernas permite mais volume por grupo em cada treino." };
    case 4:
      return { nome: "Superiores/inferiores", sessoes: ["superiores", "inferiores", "superiores", "inferiores"], explicacao: "Com 4 dias, alternar superiores e inferiores treina cada grupo duas vezes por semana com descanso entre eles." };
    case 5:
      return { nome: "Empurrar, puxar, pernas, superiores e inferiores", sessoes: ["empurrar", "puxar", "pernas", "superiores", "inferiores"], explicacao: "Com 5 dias, combinar empurrar/puxar/pernas com superiores/inferiores dá frequência 2 para a maioria dos grupos." };
    default:
      return { nome: "Empurrar, puxar e pernas (2×)", sessoes: ["empurrar", "puxar", "pernas", "empurrar", "puxar", "pernas"], explicacao: "Com 6 dias, empurrar/puxar/pernas duas vezes por semana. Reserve ao menos 1 dia de descanso completo." };
  }
}

// ───────────────────────── escolha de exercícios ─────────────────────────

/**
 * Candidatos para uma vaga, em ordem: preferidos, depois do tipo pedido, depois a ordem do catálogo.
 * Só entram exercícios possíveis com o equipamento e adequados ao nível (no modo conservador,
 * também nada acima de intermediário).
 */
export function candidatos(vaga: Vaga, catalogo: readonly Exercicio[], p: Pick<ParametrosPlano, "nivel" | "equipamentos" | "conservador">): Exercicio[] {
  const tetoNivel: Nivel = p.conservador && p.nivel === "avancado" ? "intermediario" : p.nivel;
  const ok = catalogo.filter((e) => e.musculosPrincipais.includes(vaga.alvo) && disponivel(e, p.equipamentos) && adequadoAoNivel(e, tetoNivel));
  const pref = vaga.preferir ?? [];
  const pos = (e: Exercicio) => (pref.includes(e.id) ? pref.indexOf(e.id) : pref.length + (vaga.tipo && e.tipo !== vaga.tipo ? 100 : 0));
  return ok
    .map((e, i) => ({ e, i }))
    .sort((a, b) => pos(a.e) - pos(b.e) || a.i - b.i)
    .map((x) => x.e);
}

function item(ex: Exercicio, p: ParametrosPlano): ItemPlano {
  const rx = prescricaoDoExercicio(ex, p.objetivo, p.nivel);
  const series = p.conservador ? Math.max(2, rx.series - 1) : rx.series;
  return {
    exercicioId: ex.id,
    nome: ex.nome,
    grupo: GRUPOS[grupoDoMusculo(ex.musculosPrincipais[0]!)].rotulo,
    series,
    repsMin: rx.repsMin,
    repsMax: rx.repsMax,
    descansoS: rx.descansoS,
    cargaKg: null,
    ...(ex.porTempo ? { porTempo: true } : {}),
  };
}

const MIN_EXERCICIOS = 3;
const MAX_EXERCICIOS = 8;

/** Monta uma sessão: preenche as vagas em ordem enquanto couber no tempo disponível. */
function montarSessao(
  modelo: ModeloSessao,
  catalogo: readonly Exercicio[],
  p: ParametrosPlano,
  id: string,
  letra: string,
  /** quantas vezes cada exercício já entrou no plano: os menos usados vêm antes (variedade entre treinos) */
  usosNoPlano: Map<string, number>,
): PlanoSessao {
  const sessao: PlanoSessao = { id, nome: letra, titulo: modelo.titulo, itens: [] };
  for (const vaga of modelo.vagas) {
    if (sessao.itens.length >= MAX_EXERCICIOS) break;
    const usados = new Set(sessao.itens.map((i) => i.exercicioId));
    // ordenação estável: entre exercícios com o mesmo número de usos, mantém a prioridade
    const opcoes = candidatos(vaga, catalogo, p)
      .filter((e) => !usados.has(e.id))
      .map((e, i) => ({ e, i, u: usosNoPlano.get(e.id) ?? 0 }))
      .sort((a, b) => a.u - b.u || a.i - b.i)
      .map((x) => x.e);
    if (!opcoes.length) continue;
    const ex = opcoes[0]!;
    const tentativa = { ...sessao, itens: [...sessao.itens, item(ex, p)] };
    if (sessao.itens.length >= MIN_EXERCICIOS && duracaoEstimadaMin(tentativa) > p.minutosSessao) break;
    sessao.itens = tentativa.itens;
  }
  // equipamento limitado (ex.: só peso corporal) pode deixar vagas sem opção: completa até o mínimo
  // com exercícios disponíveis que trabalhem os mesmos músculos (principal ou secundário), depois qualquer um
  if (sessao.itens.length < MIN_EXERCICIOS) {
    const alvos = new Set(modelo.vagas.map((v) => v.alvo));
    const tocaAlvo = (e: Exercicio) => [...e.musculosPrincipais, ...e.musculosSecundarios].some((m) => alvos.has(m));
    const extras = catalogo.filter(
      (e) => disponivel(e, p.equipamentos) && adequadoAoNivel(e, p.conservador && p.nivel === "avancado" ? "intermediario" : p.nivel),
    );
    for (const ex of [...extras.filter(tocaAlvo), ...extras.filter((e) => !tocaAlvo(e))]) {
      if (sessao.itens.length >= MIN_EXERCICIOS) break;
      if (!sessao.itens.some((i) => i.exercicioId === ex.id)) sessao.itens.push(item(ex, p));
    }
  }
  for (const i of sessao.itens) usosNoPlano.set(i.exercicioId, (usosNoPlano.get(i.exercicioId) ?? 0) + 1);
  return sessao;
}

// ───────────────────────── volume ─────────────────────────

export const GRUPOS_VOLUME: Grupo[] = ["peito", "costas", "ombros", "bracos", "pernas", "gluteos", "abdomen"];

/** Séries semanais recomendadas por grupo (faixas usuais; iniciantes precisam de menos). */
export const LIMITES_VOLUME: Record<Nivel, { min: number; max: number }> = {
  iniciante: { min: 4, max: 12 },
  intermediario: { min: 6, max: 18 },
  avancado: { min: 8, max: 22 },
};

/** Séries efetivas de um item por grupo: 1 para o grupo principal, 0,5 para grupos só secundários. */
function seriesPorGrupo(it: ItemPlano, catalogo: ReadonlyMap<string, Exercicio>): Map<Grupo, number> {
  const ex = catalogo.get(it.exercicioId);
  const r = new Map<Grupo, number>();
  if (!ex) return r;
  const principais = new Set(ex.musculosPrincipais.map(grupoDoMusculo));
  for (const g of principais) r.set(g, it.series);
  for (const g of new Set(ex.musculosSecundarios.map(grupoDoMusculo))) if (!principais.has(g)) r.set(g, it.series * 0.5);
  return r;
}

export function volumeSessao(s: PlanoSessao, catalogo: ReadonlyMap<string, Exercicio>): Map<Grupo, number> {
  const total = new Map<Grupo, number>();
  for (const it of s.itens) for (const [g, n] of seriesPorGrupo(it, catalogo)) total.set(g, (total.get(g) ?? 0) + n);
  return total;
}

/** Séries semanais por grupo: cada sessão é feita diasSemana / nº de sessões vezes por semana. */
export function volumeSemanal(plano: Plano, diasSemana: number, catalogo: ReadonlyMap<string, Exercicio>): Map<Grupo, number> {
  const freq = plano.sessoes.length ? Math.min(6, diasSemana) / plano.sessoes.length : 0;
  const total = new Map<Grupo, number>(GRUPOS_VOLUME.map((g) => [g, 0]));
  for (const s of plano.sessoes) for (const [g, n] of volumeSessao(s, catalogo)) total.set(g, (total.get(g) ?? 0) + n * freq);
  for (const [g, n] of total) total.set(g, Math.round(n * 10) / 10);
  return total;
}

export type StatusVolume = "baixo" | "ok" | "alto";

export function avaliarVolume(volume: Map<Grupo, number>, nivel: Nivel): Map<Grupo, StatusVolume> {
  const { min, max } = LIMITES_VOLUME[nivel];
  // abdômen fica fora dos limites: recupera rápido e recebe muito volume secundário dos compostos
  return new Map(
    [...volume].map(([g, n]) => [g, g === "abdomen" ? "ok" : n > max ? "alto" : n < min ? "baixo" : "ok"] as [Grupo, StatusVolume]),
  );
}

/**
 * Tira séries (primeiro de exercícios isolados) dos grupos acima do limite, sem baixar de 2 por exercício.
 * Se não houver mais séries para tirar, remove um exercício isolado do grupo (mantendo 3 por treino).
 */
function ajustarVolume(plano: Plano, p: ParametrosPlano, catalogo: ReadonlyMap<string, Exercicio>): Plano {
  const copia: Plano = { ...plano, sessoes: plano.sessoes.map((s) => ({ ...s, itens: s.itens.map((i) => ({ ...i })) })) };
  const { max } = LIMITES_VOLUME[p.nivel];
  for (let guarda = 0; guarda < 200; guarda++) {
    const vol = volumeSemanal(copia, treinosPorSemana(p.diasSemana, p.nivel), catalogo);
    const acima = [...vol].find(([g, n]) => g !== "abdomen" && n > max);
    if (!acima) break;
    const [grupo] = acima;
    const doGrupo = (i: ItemPlano) => !!catalogo.get(i.exercicioId)?.musculosPrincipais.some((m) => grupoDoMusculo(m) === grupo);
    const ehComposto = (i: ItemPlano) => catalogo.get(i.exercicioId)?.tipo === "composto";
    const itens = copia.sessoes
      .flatMap((s) => s.itens)
      .filter((i) => i.series > 2 && doGrupo(i))
      .sort((a, b) => Number(ehComposto(a)) - Number(ehComposto(b)) || b.series - a.series);
    if (itens.length) {
      itens[0]!.series--;
      continue;
    }
    // o excesso pode vir de volume secundário (ex.: ombros nos supinos): reduz esses exercícios
    const secundario = copia.sessoes
      .flatMap((s) => s.itens)
      .filter((i) => i.series > 2 && catalogo.get(i.exercicioId)?.musculosSecundarios.some((m) => grupoDoMusculo(m) === grupo))
      .sort((a, b) => b.series - a.series);
    if (secundario.length) {
      secundario[0]!.series--;
      continue;
    }
    // sem séries para tirar: remove um isolado do grupo; em último caso, um composto do grupo
    // quando o treino tem outro exercício desse grupo
    const removivel = (s: PlanoSessao, i: ItemPlano) => doGrupo(i) && (!ehComposto(i) || s.itens.some((o) => o !== i && doGrupo(o)));
    const sessao =
      copia.sessoes.find((s) => s.itens.length > MIN_EXERCICIOS && s.itens.some((i) => doGrupo(i) && !ehComposto(i))) ??
      copia.sessoes.find((s) => s.itens.length > MIN_EXERCICIOS && s.itens.some((i) => removivel(s, i)));
    if (!sessao) break;
    const isolado = sessao.itens.map((i) => doGrupo(i) && !ehComposto(i)).lastIndexOf(true);
    const idx = isolado >= 0 ? isolado : sessao.itens.map((i) => removivel(sessao, i)).lastIndexOf(true);
    sessao.itens.splice(idx, 1);
  }
  return copia;
}

// ───────────────────────── gerar plano ─────────────────────────

const LETRAS = "ABCDEF";

function observacaoDias(informados: number, treinos: number): string {
  if (informados <= treinos) return "";
  return treinos === 4
    ? ` Você informou ${informados} dias: para quem está começando, recomendamos até 4 treinos de musculação; use os outros dias para caminhada, alongamento ou descanso.`
    : ` Você informou ${informados} dias; o plano tem ${treinos} para garantir ao menos 1 dia de descanso.`;
}

export function gerarPlano(p: ParametrosPlano, catalogo: readonly Exercicio[], novoId: () => string): Plano {
  const divisao = escolherDivisao(p.diasSemana, p.nivel, p.objetivo);
  const vistos = new Map<NomeModelo, number>();
  const usos = new Map<string, number>();
  const sessoes = divisao.sessoes.map((nome, i) => {
    const repeticao = vistos.get(nome) ?? 0;
    vistos.set(nome, repeticao + 1);
    const modelo = MODELOS[nome];
    const titulo = repeticao ? `${modelo.titulo} (variação)` : modelo.titulo;
    return { ...montarSessao(modelo, catalogo, p, novoId(), LETRAS[i]!, usos), titulo };
  });
  const mapa = new Map(catalogo.map((e) => [e.id, e]));
  const bruto: Plano = {
    id: novoId(),
    nome: divisao.nome,
    objetivo: p.objetivo,
    sessoes,
    origem: "motor",
    parametros: p,
    explicacao: divisao.explicacao + observacaoDias(p.diasSemana, treinosPorSemana(p.diasSemana, p.nivel)),
    revisadoEm: null,
  };
  return ajustarVolume(bruto, p, mapa);
}

// ───────────────────────── conferência ─────────────────────────

export interface Aviso {
  nivel: "erro" | "alerta" | "info";
  texto: string;
  sessaoId?: string;
}

/** Grupos que, treinados pesado em sessões seguidas, pedem ~48 h de intervalo. */
const LIMITE_SEGUIDAS = 9;

export function conferirPlano(plano: Plano, p: Pick<ParametrosPlano, "nivel" | "diasSemana" | "minutosSessao" | "conservador">, catalogo: ReadonlyMap<string, Exercicio>): Aviso[] {
  const avisos: Aviso[] = [];
  if (!plano.sessoes.length) avisos.push({ nivel: "erro", texto: "O plano não tem nenhum treino." });

  for (const s of plano.sessoes) {
    if (!s.itens.length) {
      avisos.push({ nivel: "erro", texto: `Treino ${s.nome} está sem exercícios.`, sessaoId: s.id });
      continue;
    }
    const ids = s.itens.map((i) => i.exercicioId);
    const repetido = ids.find((id, i) => ids.indexOf(id) !== i);
    if (repetido) avisos.push({ nivel: "alerta", texto: `Treino ${s.nome} tem o mesmo exercício duas vezes.`, sessaoId: s.id });
    const min = duracaoEstimadaMin(s);
    if (min > p.minutosSessao + 10) avisos.push({ nivel: "alerta", texto: `Treino ${s.nome} deve levar cerca de ${min} min, mais que os ${p.minutosSessao} min disponíveis.`, sessaoId: s.id });
    const series = s.itens.reduce((t, i) => t + i.series, 0);
    if (series > 28) avisos.push({ nivel: "alerta", texto: `Treino ${s.nome} tem ${series} séries; acima de ~28 por sessão a qualidade costuma cair.`, sessaoId: s.id });
  }

  // recuperação: mesmo grupo pesado em duas sessões seguidas do rodízio
  const n = plano.sessoes.length;
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      const a = plano.sessoes[i]!;
      const b = plano.sessoes[(i + 1) % n]!;
      if (i === n - 1 && n === 2) break; // com 2 treinos, A→B e B→A são o mesmo par
      const va = volumeSessao(a, catalogo);
      const vb = volumeSessao(b, catalogo);
      for (const g of GRUPOS_VOLUME) {
        if (g === "abdomen") continue;
        if ((va.get(g) ?? 0) >= LIMITE_SEGUIDAS && (vb.get(g) ?? 0) >= LIMITE_SEGUIDAS) {
          avisos.push({ nivel: "alerta", texto: `${GRUPOS[g].rotulo} é treinado pesado nos treinos ${a.nome} e ${b.nome}, em sequência. Deixe cerca de 48 h entre eles.` });
        }
      }
    }
  }

  const status = avaliarVolume(volumeSemanal(plano, treinosPorSemana(p.diasSemana, p.nivel), catalogo), p.nivel);
  const { min, max } = LIMITES_VOLUME[p.nivel];
  for (const [g, st] of status) {
    if (st === "alto") avisos.push({ nivel: "alerta", texto: `${GRUPOS[g].rotulo}: volume semanal acima de ${max} séries, o máximo recomendado para o seu nível.` });
    if (st === "baixo") avisos.push({ nivel: "info", texto: `${GRUPOS[g].rotulo}: menos de ${min} séries por semana. Tudo bem se não for prioridade.` });
  }

  if (p.conservador) avisos.push({ nivel: "info", texto: "Plano conservador por causa das respostas de saúde ou limitações informadas. Peça a um profissional para revisar." });
  return avisos;
}

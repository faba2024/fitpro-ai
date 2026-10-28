// Conversão entre a linha da tabela public.perfis e os tipos do domínio.
import { EQUIPAMENTOS, PARQ, parqPedeLiberacao, type Equipamento, type Nivel, type Objetivo, type Perfil, type PerfilCompleto, type PerguntaParq } from "@/domain/tipos";

export interface LinhaPerfil {
  id: string;
  nome: string;
  data_nascimento: string;
  altura_cm: number | string;
  peso_kg: number | string;
  objetivo: Objetivo;
  nivel: Nivel;
  dias_semana: number;
  minutos_sessao: number;
  equipamentos: string[];
  limitacoes: string;
  parq_respostas: Record<string, unknown>;
  parq_alerta: boolean;
  consentimento_termos_em: string;
  consentimento_saude_em: string;
  atualizado_em?: string;
}

const ehEquipamento = (e: string): e is Equipamento => e in EQUIPAMENTOS;
const ehPergunta = (p: string): p is PerguntaParq => p in PARQ;

export function deLinha(l: LinhaPerfil): PerfilCompleto {
  const parq: PerfilCompleto["parq"] = {};
  for (const [k, v] of Object.entries(l.parq_respostas ?? {})) if (ehPergunta(k) && typeof v === "boolean") parq[k] = v;
  return {
    nome: l.nome,
    dataNascimento: l.data_nascimento,
    // numeric chega como string pelo PostgREST
    alturaCm: Number(l.altura_cm),
    pesoKg: Number(l.peso_kg),
    objetivo: l.objetivo,
    nivel: l.nivel,
    diasSemana: l.dias_semana,
    minutosSessao: l.minutos_sessao,
    equipamentos: (l.equipamentos ?? []).filter(ehEquipamento),
    limitacoes: l.limitacoes ?? "",
    parq,
    consentimentoTermosEm: l.consentimento_termos_em,
    consentimentoSaudeEm: l.consentimento_saude_em,
  };
}

export function paraLinha(userId: string, p: PerfilCompleto): Omit<LinhaPerfil, "atualizado_em"> {
  return {
    id: userId,
    nome: p.nome.trim(),
    data_nascimento: p.dataNascimento,
    altura_cm: p.alturaCm,
    peso_kg: p.pesoKg,
    objetivo: p.objetivo,
    nivel: p.nivel,
    dias_semana: p.diasSemana,
    minutos_sessao: p.minutosSessao,
    equipamentos: p.equipamentos,
    limitacoes: p.limitacoes.trim(),
    parq_respostas: p.parq,
    parq_alerta: parqPedeLiberacao(p.parq),
    consentimento_termos_em: p.consentimentoTermosEm,
    consentimento_saude_em: p.consentimentoSaudeEm,
  };
}

/** Resumo usado pelo dashboard. */
export function resumo(p: PerfilCompleto): Perfil {
  const primeiroNome = p.nome.trim().split(/\s+/)[0] ?? p.nome;
  return { nome: primeiroNome, objetivo: p.objetivo, nivel: p.nivel, metaSemanal: p.diasSemana, minutosSessao: p.minutosSessao };
}

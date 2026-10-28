// Validação dos formulários de conta e perfil. Funções puras, testadas em validacao.test.ts.
import { PARQ, type Equipamento, type Nivel, type Objetivo, type PerfilCompleto, type PerguntaParq } from "@/domain/tipos";

export const IDADE_MINIMA = 18;

export function validarEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return "Informe seu e-mail.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "E-mail inválido.";
  return null;
}

export function validarSenha(senha: string): string | null {
  if (senha.length < 8) return "Use pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números.";
  if (senha.length > 72) return "Use no máximo 72 caracteres.";
  return null;
}

/** Idade completa em anos na data `hoje`. */
export function idade(dataNascimento: string, hoje: Date): number {
  const [a, m, d] = dataNascimento.split("-").map(Number) as [number, number, number];
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--;
  return anos;
}

/** "78,5" ou "78.5" → 78.5; vazio ou inválido → NaN */
export function numero(valor: string): number {
  const v = valor.trim().replace(",", ".");
  return v === "" ? NaN : Number(v);
}

export interface FormPerfil {
  nome: string;
  dataNascimento: string;
  alturaCm: string;
  pesoKg: string;
  objetivo: Objetivo | "";
  nivel: Nivel | "";
  diasSemana: number;
  minutosSessao: number;
  equipamentos: Equipamento[];
  limitacoes: string;
  parq: Partial<Record<PerguntaParq, boolean>>;
  aceitaTermos: boolean;
  aceitaSaude: boolean;
}

export type CampoPerfil = keyof FormPerfil;
export type Erros = Partial<Record<CampoPerfil, string>>;

export const FORM_VAZIO: FormPerfil = {
  nome: "",
  dataNascimento: "",
  alturaCm: "",
  pesoKg: "",
  objetivo: "",
  nivel: "",
  diasSemana: 3,
  minutosSessao: 60,
  equipamentos: [],
  limitacoes: "",
  parq: {},
  aceitaTermos: false,
  aceitaSaude: false,
};

export function validarPerfil(f: FormPerfil, hoje: Date, campos?: readonly CampoPerfil[]): Erros {
  const e: Erros = {};
  const nome = f.nome.trim();
  if (!nome) e.nome = "Informe seu nome.";
  else if (nome.length > 80) e.nome = "Use no máximo 80 caracteres.";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dataNascimento)) e.dataNascimento = "Informe sua data de nascimento.";
  else {
    const anos = idade(f.dataNascimento, hoje);
    if (anos < 0 || anos > 110) e.dataNascimento = "Data de nascimento inválida.";
    else if (anos < IDADE_MINIMA) e.dataNascimento = `Por enquanto o FitPro AI é só para maiores de ${IDADE_MINIMA} anos.`;
  }

  const altura = numero(f.alturaCm);
  if (!Number.isFinite(altura) || altura < 100 || altura > 250) e.alturaCm = "Altura entre 100 e 250 cm.";
  const peso = numero(f.pesoKg);
  if (!Number.isFinite(peso) || peso < 30 || peso > 300) e.pesoKg = "Peso entre 30 e 300 kg.";

  if (!f.objetivo) e.objetivo = "Escolha um objetivo.";
  if (!f.nivel) e.nivel = "Escolha seu nível.";
  if (!Number.isInteger(f.diasSemana) || f.diasSemana < 1 || f.diasSemana > 7) e.diasSemana = "De 1 a 7 dias.";
  if (!Number.isInteger(f.minutosSessao) || f.minutosSessao < 15 || f.minutosSessao > 180) e.minutosSessao = "De 15 a 180 minutos.";
  if (!f.equipamentos.length) e.equipamentos = "Marque pelo menos uma opção.";
  if (f.limitacoes.length > 1000) e.limitacoes = "Use no máximo 1000 caracteres.";
  if ((Object.keys(PARQ) as PerguntaParq[]).some((p) => f.parq[p] === undefined)) e.parq = "Responda todas as perguntas.";
  if (!f.aceitaTermos) e.aceitaTermos = "É preciso aceitar para continuar.";
  if (!f.aceitaSaude) e.aceitaSaude = "É preciso autorizar para continuar.";

  if (!campos) return e;
  return Object.fromEntries(Object.entries(e).filter(([k]) => campos.includes(k as CampoPerfil))) as Erros;
}

/** Converte o formulário validado no perfil a salvar. Consentimentos existentes mantêm a data original. */
export function paraPerfil(f: FormPerfil, agora: Date, anterior?: PerfilCompleto | null): PerfilCompleto {
  const iso = agora.toISOString();
  return {
    nome: f.nome.trim(),
    dataNascimento: f.dataNascimento,
    alturaCm: Math.round(numero(f.alturaCm) * 10) / 10,
    pesoKg: Math.round(numero(f.pesoKg) * 10) / 10,
    objetivo: f.objetivo as Objetivo,
    nivel: f.nivel as Nivel,
    diasSemana: f.diasSemana,
    minutosSessao: f.minutosSessao,
    equipamentos: f.equipamentos,
    limitacoes: f.limitacoes.trim(),
    parq: f.parq,
    consentimentoTermosEm: anterior?.consentimentoTermosEm ?? iso,
    consentimentoSaudeEm: anterior?.consentimentoSaudeEm ?? iso,
    metaPesoKg: anterior?.metaPesoKg ?? null,
  };
}

export function deFormulario(p: PerfilCompleto): FormPerfil {
  const fmt = (n: number) => String(n).replace(".", ",");
  return {
    nome: p.nome,
    dataNascimento: p.dataNascimento,
    alturaCm: fmt(p.alturaCm),
    pesoKg: fmt(p.pesoKg),
    objetivo: p.objetivo,
    nivel: p.nivel,
    diasSemana: p.diasSemana,
    minutosSessao: p.minutosSessao,
    equipamentos: p.equipamentos,
    limitacoes: p.limitacoes,
    parq: p.parq,
    aceitaTermos: true,
    aceitaSaude: true,
  };
}

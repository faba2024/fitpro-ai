import { describe, expect, it } from "vitest";
import { PARQ, type PerguntaParq } from "@/domain/tipos";
import { deLinha, paraLinha, resumo } from "@/data/perfilMapper";
import { deFormulario, FORM_VAZIO, idade, numero, paraPerfil, validarEmail, validarPerfil, validarSenha, type FormPerfil } from "./validacao";

const HOJE = new Date(2026, 9, 28);
const todasNao = Object.fromEntries((Object.keys(PARQ) as PerguntaParq[]).map((k) => [k, false]));

const valido: FormPerfil = {
  ...FORM_VAZIO,
  nome: " Fabrício Souza ",
  dataNascimento: "1995-06-15",
  alturaCm: "178",
  pesoKg: "78,4",
  objetivo: "hipertrofia",
  nivel: "intermediario",
  diasSemana: 4,
  minutosSessao: 60,
  equipamentos: ["academia_completa"],
  parq: todasNao,
  aceitaTermos: true,
  aceitaSaude: true,
};

describe("conta", () => {
  it("valida e-mail", () => {
    expect(validarEmail("")).toMatch(/Informe/);
    expect(validarEmail("joao@")).toMatch(/inválido/);
    expect(validarEmail(" joao@email.com ")).toBeNull();
  });

  it("exige senha com 8+ caracteres, letras e números", () => {
    expect(validarSenha("abc12")).toMatch(/8 caracteres/);
    expect(validarSenha("abcdefgh")).toMatch(/letras e números/);
    expect(validarSenha("12345678")).toMatch(/letras e números/);
    expect(validarSenha("treino2026")).toBeNull();
  });
});

describe("perfil", () => {
  it("formulário completo não tem erros", () => {
    expect(validarPerfil(valido, HOJE)).toEqual({});
  });

  it("calcula idade considerando se já fez aniversário", () => {
    expect(idade("2000-10-28", HOJE)).toBe(26);
    expect(idade("2000-10-29", HOJE)).toBe(25);
  });

  it("bloqueia menores de 18 anos", () => {
    expect(validarPerfil({ ...valido, dataNascimento: "2010-01-01" }, HOJE).dataNascimento).toMatch(/maiores de 18/);
  });

  it("aceita vírgula decimal e rejeita valores fora da faixa", () => {
    expect(numero("78,4")).toBe(78.4);
    const e = validarPerfil({ ...valido, alturaCm: "90", pesoKg: "abc" }, HOJE);
    expect(e.alturaCm).toBeDefined();
    expect(e.pesoKg).toBeDefined();
  });

  it("exige todas as respostas do PAR-Q e os dois consentimentos", () => {
    const e = validarPerfil({ ...valido, parq: { coracao: false }, aceitaTermos: false, aceitaSaude: false }, HOJE);
    expect(e.parq).toBeDefined();
    expect(e.aceitaTermos).toBeDefined();
    expect(e.aceitaSaude).toBeDefined();
  });

  it("filtra erros pelos campos da etapa", () => {
    expect(validarPerfil(FORM_VAZIO, HOJE, ["nome"])).toEqual({ nome: "Informe seu nome." });
  });

  it("converte para perfil mantendo datas de consentimento anteriores", () => {
    const p = paraPerfil(valido, new Date("2026-10-28T12:00:00Z"));
    expect(p.nome).toBe("Fabrício Souza");
    expect(p.pesoKg).toBe(78.4);
    expect(p.consentimentoSaudeEm).toBe("2026-10-28T12:00:00.000Z");

    const editado = paraPerfil({ ...valido, pesoKg: "77" }, new Date("2026-12-01T00:00:00Z"), p);
    expect(editado.consentimentoSaudeEm).toBe("2026-10-28T12:00:00.000Z");
    expect(deFormulario(editado).pesoKg).toBe("77");
  });
});

describe("perfilMapper", () => {
  it("ida e volta pelo formato do banco preserva os dados", () => {
    const p = paraPerfil({ ...valido, parq: { ...todasNao, osso_articulacao: true } }, HOJE);
    const linha = paraLinha("u1", p);
    expect(linha.parq_alerta).toBe(true);
    // PostgREST devolve numeric como string
    const volta = deLinha({ ...linha, altura_cm: "178.0", peso_kg: "78.4", equipamentos: [...linha.equipamentos, "desconhecido"] });
    expect(volta).toEqual(p);
    expect(resumo(volta)).toMatchObject({ nome: "Fabrício", metaSemanal: 4 });
  });
});

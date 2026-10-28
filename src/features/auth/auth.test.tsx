import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemoryRouter, useRoutes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthProvider, mensagemAuth } from "@/app/auth";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { TreinoProvider } from "@/app/treinoAtivo";
import { paraLinha } from "@/data/perfilMapper";
import { PARQ } from "@/domain/tipos";
import { supabaseFalso } from "@/test/supabaseFalso";

function Rotas() {
  return useRoutes(rotas);
}

function renderApp(cliente: SupabaseClient, caminho = "/") {
  return render(
    <TemaProvider>
      <AuthProvider cliente={cliente}>
        <DadosProvider>
          <TreinoProvider>
          <MemoryRouter initialEntries={[caminho]}>
            <Rotas />
          </MemoryRouter>
          </TreinoProvider>
        </DadosProvider>
      </AuthProvider>
    </TemaProvider>,
  );
}

const perfilSalvo = paraLinha("user-1", {
  nome: "Joana Lima",
  dataNascimento: "1992-03-10",
  alturaCm: 165,
  pesoKg: 61.5,
  objetivo: "forca",
  nivel: "iniciante",
  diasSemana: 3,
  minutosSessao: 45,
  equipamentos: ["halteres"],
  limitacoes: "",
  parq: Object.fromEntries(Object.keys(PARQ).map((k) => [k, false])),
  consentimentoTermosEm: "2026-10-01T00:00:00Z",
  consentimentoSaudeEm: "2026-10-01T00:00:00Z",
});

describe("contas e rotas protegidas", () => {
  beforeEach(() => sessionStorage.clear());

  it("traduz erros do Supabase Auth sem expor a mensagem original", () => {
    expect(mensagemAuth({ code: "invalid_credentials", message: "Invalid login credentials", status: 400 })).toBe("E-mail ou senha incorretos.");
    expect(mensagemAuth({ code: "qualquer", message: "boom", status: 500 })).toMatch(/Algo deu errado/);
  });

  it("sem login, o app manda para a tela de entrar", async () => {
    renderApp(supabaseFalso().cliente);
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("valida o formulário antes de enviar e mostra erro do servidor", async () => {
    const { cliente, chamadas } = supabaseFalso({ erroLogin: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 } });
    renderApp(cliente, "/entrar");
    await userEvent.click(await screen.findByRole("button", { name: "Entrar" }));
    expect(screen.getByText("Informe seu e-mail.")).toBeInTheDocument();
    expect(chamadas.signIn).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("E-mail"), "aluno@teste.local");
    await userEvent.type(screen.getByLabelText("Senha"), "errada123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeInTheDocument();
  });

  it("criar conta com confirmação de e-mail mostra o aviso", async () => {
    const { cliente, chamadas } = supabaseFalso({ precisaConfirmar: true });
    renderApp(cliente, "/criar-conta");
    await userEvent.type(await screen.findByLabelText("E-mail"), "novo@teste.local");
    await userEvent.type(screen.getByLabelText("Senha"), "fraca");
    await userEvent.type(screen.getByLabelText("Confirme a senha"), "fraca");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(screen.getByText("Use pelo menos 8 caracteres.")).toBeInTheDocument();
    expect(chamadas.signUp).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText("Senha"));
    await userEvent.clear(screen.getByLabelText("Confirme a senha"));
    await userEvent.type(screen.getByLabelText("Senha"), "treino2026");
    await userEvent.type(screen.getByLabelText("Confirme a senha"), "treino2026");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByRole("heading", { name: "Confirme seu e-mail" })).toBeInTheDocument();
  });

  it("logado sem perfil vai para o cadastro, preenche as etapas e salva", async () => {
    const { cliente, chamadas } = supabaseFalso({ logado: true });
    renderApp(cliente);
    expect(await screen.findByRole("heading", { name: "Sobre você" })).toBeInTheDocument();

    // não avança com campos vazios
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nome"), "Joana Lima");
    await userEvent.type(screen.getByLabelText("Data de nascimento"), "1992-03-10");
    await userEvent.type(screen.getByLabelText("Altura (cm)"), "165");
    await userEvent.type(screen.getByLabelText("Peso (kg)"), "61,5");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Objetivo e rotina" })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/^Força/));
    await userEvent.click(screen.getByLabelText(/^Iniciante/));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Equipamentos" })).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Halteres"));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Saúde e segurança" })).toBeInTheDocument();
    for (const grupo of screen.getAllByRole("radiogroup")) {
      await userEvent.click(grupo.querySelectorAll("input")[1]!); // "Não"
    }
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByRole("heading", { name: "Privacidade" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
    expect(screen.getByText("É preciso aceitar para continuar.")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Termos de Uso/));
    await userEvent.click(screen.getByLabelText(/dados de saúde/));
    await userEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));

    await waitFor(() => expect(chamadas.upsert).toHaveBeenCalledTimes(1));
    expect(chamadas.upsert.mock.calls[0]![0]).toMatchObject({ id: "user-1", nome: "Joana Lima", peso_kg: 61.5, objetivo: "forca", parq_alerta: false });
    expect(await screen.findByText(/Sua ficha está a caminho/)).toBeInTheDocument();
  });

  it("com perfil salvo, entra direto no dashboard com o primeiro nome", async () => {
    renderApp(supabaseFalso({ logado: true, perfil: perfilSalvo }).cliente);
    expect(await screen.findByRole("heading", { name: /, Joana$/ })).toBeInTheDocument();
  });

  it("excluir conta exige digitar EXCLUIR e volta para entrar", async () => {
    const { cliente, chamadas } = supabaseFalso({ logado: true, perfil: perfilSalvo });
    renderApp(cliente, "/perfil");
    await userEvent.click(await screen.findByRole("button", { name: "Excluir minha conta" }));
    const botao = screen.getByRole("button", { name: "Excluir definitivamente" });
    expect(botao).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/digite EXCLUIR/), "excluir");
    await userEvent.click(botao);
    await waitFor(() => expect(chamadas.rpc).toHaveBeenCalledWith("excluir_minha_conta"));
    expect(await screen.findByText(/conta e todos os seus dados foram excluídos/)).toBeInTheDocument();
  });
});

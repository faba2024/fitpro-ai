import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/app/auth";
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

const ESPERA = { timeout: 5000 };

const perfil = paraLinha("user-1", {
  nome: "Joana Lima",
  dataNascimento: "1992-03-10",
  alturaCm: 165,
  pesoKg: 61.5,
  objetivo: "hipertrofia",
  nivel: "iniciante",
  diasSemana: 3,
  minutosSessao: 45,
  equipamentos: ["halteres"],
  limitacoes: "dor no joelho direito",
  parq: { ...Object.fromEntries(Object.keys(PARQ).map((k) => [k, false])), osso_articulacao: true },
  consentimentoTermosEm: "2026-10-01T00:00:00Z",
  consentimentoSaudeEm: "2026-10-01T00:00:00Z",
});

function renderApp() {
  const { cliente } = supabaseFalso({ logado: true, perfil });
  return render(
    <TemaProvider>
      <AuthProvider cliente={cliente}>
        <DadosProvider>
          <TreinoProvider>
            <MemoryRouter initialEntries={["/assistente"]}>
              <Rotas />
            </MemoryRouter>
          </TreinoProvider>
        </DadosProvider>
      </AuthProvider>
    </TemaProvider>,
  );
}

const respostaOk = (texto: string, exercicios: { id: string; nome: string }[] = [], restantes = 29) =>
  new Response(JSON.stringify({ texto, exercicios, restantes }), { status: 200, headers: { "Content-Type": "application/json" } });

const corpoEnviado = (f: ReturnType<typeof vi.fn>, i = 0) => JSON.parse((f.mock.calls[i]![1] as RequestInit).body as string);

describe("assistente de IA", { timeout: 30000 }, () => {
  let fetchFalso: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("envia a pergunta com o token e mostra a resposta com link só para exercícios citados", async () => {
    fetchFalso.mockResolvedValue(respostaOk("Uma boa opção é:\n- [[agachamento-goblet]]\n- [[inventado]]", [{ id: "agachamento-goblet", nome: "Agachamento goblet" }]));
    renderApp();
    await userEvent.type(await screen.findByLabelText("Sua pergunta", {}, ESPERA), "O que substitui o leg press?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar pergunta" }));

    expect(await screen.findByRole("link", { name: "Agachamento goblet" }, ESPERA)).toHaveAttribute("href", "/exercicios/agachamento-goblet");
    expect(screen.queryByText(/inventado/)).not.toBeInTheDocument();
    expect(screen.getByText(/29 perguntas restantes hoje/)).toBeInTheDocument();
    const [url, init] = fetchFalso.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe("/api/assistente");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-falso");
  });

  it("sem autorização não envia nenhum dado do perfil", async () => {
    fetchFalso.mockResolvedValue(respostaOk("ok"));
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Como respirar no agachamento?" }, ESPERA));
    await waitFor(() => expect(fetchFalso).toHaveBeenCalled());
    expect(corpoEnviado(fetchFalso).contexto).toBeNull();
  });

  it("com autorização envia perfil e ficha; saúde só com a segunda autorização; nunca nome ou nascimento", async () => {
    fetchFalso.mockResolvedValue(respostaOk("ok"));
    renderApp();
    await userEvent.click(await screen.findByText("Seus dados e privacidade", {}, ESPERA));
    const saude = screen.getByLabelText(/limitações e o resultado do questionário/);
    expect(saude).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/Usar meu objetivo/));
    await userEvent.type(screen.getByLabelText("Sua pergunta"), "Meu treino está bom?{enter}");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(1));
    const c1 = corpoEnviado(fetchFalso).contexto;
    expect(c1).toMatchObject({ objetivo: "hipertrofia", nivel: "iniciante", equipamentos: ["halteres"] });
    expect(c1.limitacoes).toBeUndefined();
    expect(JSON.stringify(c1)).not.toMatch(/Joana|1992/);

    await userEvent.click(saude);
    await userEvent.type(screen.getByLabelText("Sua pergunta"), "E com meu joelho?{enter}");
    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(2));
    expect(corpoEnviado(fetchFalso, 1).contexto).toMatchObject({ limitacoes: "dor no joelho direito", parqAlerta: true });
    // a conversa anterior vai junto, sem campos extras
    expect(corpoEnviado(fetchFalso, 1).mensagens).toEqual([
      { papel: "usuario", texto: "Meu treino está bom?" },
      { papel: "assistente", texto: "ok" },
      { papel: "usuario", texto: "E com meu joelho?" },
    ]);
  });

  it("mostra a mensagem do servidor quando o limite do dia acaba", async () => {
    fetchFalso.mockResolvedValue(new Response(JSON.stringify({ erro: "Você chegou ao limite de 30 perguntas de hoje. Volte amanhã." }), { status: 429 }));
    renderApp();
    await userEvent.type(await screen.findByLabelText("Sua pergunta", {}, ESPERA), "oi{enter}");
    expect(await screen.findByText(/limite de 30 perguntas/, {}, ESPERA)).toBeInTheDocument();
  });

  it("sem internet avisa e mantém a pergunta na conversa", async () => {
    fetchFalso.mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp();
    await userEvent.type(await screen.findByLabelText("Sua pergunta", {}, ESPERA), "Quantas séries?{enter}");
    expect(await screen.findByText(/Sem conexão/, {}, ESPERA)).toBeInTheDocument();
    expect(screen.getByText("Quantas séries?")).toBeInTheDocument();
  });
});

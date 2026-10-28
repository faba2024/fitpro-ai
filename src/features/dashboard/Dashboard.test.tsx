import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { LocalRepositorio } from "@/data/local";

// Roteador declarativo nos testes: o data router cria Request com o AbortSignal do jsdom,
// que o fetch do Node rejeita. As rotas são as mesmas do app.
function Rotas() {
  return useRoutes(rotas);
}

function renderApp(caminho = "/") {
  return render(
    <TemaProvider>
      <DadosProvider repositorio={new LocalRepositorio(localStorage)}>
        <MemoryRouter initialEntries={[caminho]}>
          <Rotas />
        </MemoryRouter>
      </DadosProvider>
    </TemaProvider>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => localStorage.clear());

  it("sem dados mostra boas-vindas e carrega o exemplo com aviso", async () => {
    renderApp();
    const botao = await screen.findByRole("button", { name: "Explorar com exemplo" });
    await userEvent.click(botao);

    expect(await screen.findByText("Treino do dia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Iniciar treino/ })).toHaveAttribute("href", "/treino/sessao");
    expect(screen.getByText(/dados de exemplo/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Meta semanal de treinos" })).toBeInTheDocument();
  });

  it("limpar o exemplo volta para as boas-vindas", async () => {
    await new LocalRepositorio(localStorage).carregarExemplo();
    renderApp();
    await userEvent.click(await screen.findByRole("button", { name: "Limpar" }));
    expect(await screen.findByRole("button", { name: "Explorar com exemplo" })).toBeInTheDocument();
  });

  it("navega pela barra para o plano semanal", async () => {
    await new LocalRepositorio(localStorage).carregarExemplo();
    renderApp();
    await screen.findByText("Treino do dia");
    const links = screen.getAllByRole("link", { name: "Treino" });
    await userEvent.click(links[0]!);
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Treino" })).toBeInTheDocument());
    expect(screen.getByText("Peito e tríceps")).toBeInTheDocument();
  });

  it("etapas futuras dizem que ainda não estão prontas", async () => {
    renderApp("/treino/sessao");
    expect(await screen.findByText("Chega na etapa 8")).toBeInTheDocument();
  });

  it("rota desconhecida mostra página não encontrada", async () => {
    renderApp("/nao-existe");
    expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { TreinoProvider } from "@/app/treinoAtivo";
import { EXERCICIOS } from "@/data/catalogo";
import { LocalRepositorio } from "@/data/local";

function Rotas() {
  return useRoutes(rotas);
}

function renderApp(caminho: string) {
  return render(
    <TemaProvider>
      <DadosProvider repositorio={new LocalRepositorio(localStorage)}>
        <TreinoProvider>
          <MemoryRouter initialEntries={[caminho]}>
          <Rotas />
        </MemoryRouter>
          </TreinoProvider>
      </DadosProvider>
    </TemaProvider>,
  );
}

describe("biblioteca de exercícios", () => {
  beforeEach(() => localStorage.clear());

  it("lista todo o catálogo e filtra pela busca sem acento", async () => {
    renderApp("/exercicios");
    // primeira carga da tela preguiçosa (import dinâmico) pode passar de 1 s no ambiente de testes
    expect(await screen.findByText(`${EXERCICIOS.length} exercícios`, {}, { timeout: 5000 })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Buscar exercício"), "triceps frances");
    expect(screen.getByText("1 exercício")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tríceps francês com halter/ })).toHaveAttribute("href", "/exercicios/triceps-frances");
  });

  it("filtra por grupo muscular e lê o filtro da URL", async () => {
    renderApp("/exercicios?grupo=abdomen");
    const lista = await screen.findByRole("list");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(EXERCICIOS.filter((e) => e.musculosPrincipais.includes("abdomen")).length);
    expect(screen.getByRole("button", { name: "Abdômen" })).toHaveAttribute("aria-pressed", "true");
  });

  it("favoritar mostra o exercício no filtro de favoritos e guarda no navegador", async () => {
    renderApp("/exercicios?q=prancha");
    await userEvent.click(await screen.findByRole("button", { name: "Adicionar Prancha aos favoritos" }));
    expect(screen.getByRole("button", { name: "Remover Prancha dos favoritos" })).toHaveAttribute("aria-pressed", "true");
    expect(JSON.parse(localStorage.getItem("fitpro:favoritos:v1")!)).toEqual(["prancha"]);
  });

  it("favoritos vazio orienta a pessoa", async () => {
    renderApp("/exercicios?fav=1");
    expect(await screen.findByText("Você ainda não tem favoritos")).toBeInTheDocument();
  });
});

describe("detalhe do exercício", () => {
  beforeEach(() => localStorage.clear());

  it("mostra passo a passo, erros, segurança, prescrição e alternativas", async () => {
    renderApp("/exercicios/supino-reto-barra");
    expect(await screen.findByRole("heading", { level: 1, name: "Supino reto com barra" })).toBeInTheDocument();
    expect(screen.getByText(/Deite no banco com os olhos/)).toBeInTheDocument();
    expect(screen.getByText("Quicar a barra no peito.")).toBeInTheDocument();
    expect(screen.getByText(/use um auxiliar ou travas/)).toBeInTheDocument();
    // sem perfil: padrão hipertrofia/intermediário → 4 × 6–10
    expect(screen.getByText(/4 × 6–10 repetições/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Flexão de braço/ })).toHaveAttribute("href", "/exercicios/flexao");
  });

  it("isometria mostra segundos", async () => {
    renderApp("/exercicios/prancha");
    expect(await screen.findByText(/× 30–60 segundos/)).toBeInTheDocument();
  });

  it("alterna as fotos de início e fim", async () => {
    renderApp("/exercicios/flexao");
    await userEvent.click(await screen.findByRole("button", { name: "Fim" }));
    expect(screen.getByRole("img", { name: "Flexão de braço: posição final" })).toHaveAttribute("src", expect.stringMatching(/Pushups\/1\.jpg$/));
  });

  it("id desconhecido mostra página não encontrada", async () => {
    renderApp("/exercicios/nao-existe");
    expect(await screen.findByText("Página não encontrada")).toBeInTheDocument();
  });
});

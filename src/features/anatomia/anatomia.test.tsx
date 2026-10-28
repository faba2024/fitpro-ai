import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { LocalRepositorio } from "@/data/local";
import { MUSCULOS, type Musculo } from "@/domain/exercicios";
import { caminhos, curva, SILHUETA, vistasDoMusculo } from "./regioes";

function Rotas() {
  return useRoutes(rotas);
}

function renderApp(caminho: string) {
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

const ESPERA = { timeout: 5000 };

describe("desenho do corpo", () => {
  it("todo músculo do catálogo aparece em pelo menos uma vista", () => {
    for (const m of Object.keys(MUSCULOS) as Musculo[]) expect(vistasDoMusculo(m).length, m).toBeGreaterThan(0);
  });

  it("cada forma gera o lado direito e o espelhado", () => {
    for (const [, ds] of caminhos("frente")) expect(ds.length % 2).toBe(0);
  });

  it("curvas são caminhos SVG fechados e válidos", () => {
    expect(SILHUETA).toMatch(/^M[\d.]+,[\d.]+( C[\d.,\s]+)+ Z$/);
    expect(curva([[0, 0], [10, 0], [10, 10]], true)).toMatch(/Z$/);
  });
});

describe("mapa muscular", () => {
  beforeEach(() => localStorage.clear());

  it("sem músculo escolhido, orienta a pessoa", async () => {
    renderApp("/anatomia");
    expect(await screen.findByText("Escolha um músculo", {}, ESPERA)).toBeInTheDocument();
  });

  it("clicar no músculo do desenho lista os exercícios principais e secundários", async () => {
    renderApp("/anatomia");
    const mapa = await screen.findByRole("group", { name: /vista de frente/ }, ESPERA);
    await userEvent.click(within(mapa).getByRole("button", { name: "Peitoral" }));

    expect(screen.getByRole("heading", { level: 2, name: "Peitoral" })).toBeInTheDocument();
    expect(within(mapa).getByRole("button", { name: "Peitoral" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Trabalha como músculo principal \(\d+\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Supino reto com barra/ })).toHaveAttribute("href", "/exercicios/supino-reto-barra");
  });

  it("funciona pelo teclado e um segundo toque desmarca", async () => {
    renderApp("/anatomia");
    const mapa = await screen.findByRole("group", { name: /vista de frente/ }, ESPERA);
    within(mapa).getByRole("button", { name: "Bíceps" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 2, name: "Bíceps" })).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("Escolha um músculo")).toBeInTheDocument();
  });

  it("músculo só das costas abre direto na vista de costas", async () => {
    renderApp("/anatomia?musculo=gluteos");
    expect(await screen.findByRole("group", { name: /vista de costas/ }, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Costas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filtro de nível reduz a lista", async () => {
    renderApp("/anatomia?musculo=abdomen");
    await screen.findByRole("heading", { level: 2, name: "Abdômen" }, ESPERA);
    expect(screen.getByRole("link", { name: /Elevação de pernas na barra/ })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Dificuldade"), "iniciante");
    expect(screen.queryByRole("link", { name: /Elevação de pernas na barra/ })).not.toBeInTheDocument();
  });
});

describe("mapa no detalhe do exercício", () => {
  it("destaca os músculos principais e liga cada um ao mapa", async () => {
    renderApp("/exercicios/agachamento-livre");
    expect(await screen.findAllByRole("img", { name: /destaque em Quadríceps, Glúteos/ }, ESPERA)).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Quadríceps" })).toHaveAttribute("href", "/anatomia?musculo=quadriceps");
  });
});

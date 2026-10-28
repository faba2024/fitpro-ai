import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { TreinoProvider } from "@/app/treinoAtivo";
import { LocalRepositorio } from "@/data/local";

function Rotas() {
  return useRoutes(rotas);
}

const ESPERA = { timeout: 5000 };

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

const guardado = () => JSON.parse(localStorage.getItem("fitpro:treino-ativo:local") ?? "null");

async function comecar(sessao = "a") {
  renderApp(`/treino/sessao?sessao=${sessao}`);
  await userEvent.click(await screen.findByRole("button", { name: "Começar treino" }, ESPERA));
  return screen.findByRole("region", { name: /^Exercício 1:/ }, ESPERA);
}

async function registrar(card: HTMLElement, serie: number, kg: string, reps: string) {
  const carga = within(card).getByLabelText(`Carga da série ${serie}`);
  await userEvent.clear(carga);
  await userEvent.type(carga, kg);
  await userEvent.type(within(card).getByLabelText(`Repetições da série ${serie}`), reps);
  await userEvent.click(within(card).getByRole("button", { name: `Concluir série ${serie}` }));
}

describe("modo treino", { timeout: 30000 }, () => {
  beforeEach(async () => {
    localStorage.clear();
    await new LocalRepositorio(localStorage).carregarExemplo();
  });

  it("começa pelo treino escolhido e mostra os exercícios da ficha", async () => {
    const card = await comecar("b");
    expect(within(card).getByRole("heading", { name: "Puxada na frente" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "B · Costas e bíceps" })).toBeInTheDocument();
  });

  it("não conclui série sem repetições", async () => {
    const card = await comecar();
    await userEvent.click(within(card).getByRole("button", { name: "Concluir série 1" }));
    expect(within(card).getByText("Informe as repetições.")).toBeInTheDocument();
  });

  it("concluir série inicia o descanso e já fica salvo no aparelho", async () => {
    const card = await comecar();
    await registrar(card, 1, "50", "10");
    expect(screen.getByRole("timer", { name: "Descanso" })).toBeInTheDocument();
    const s = guardado().sessao;
    expect(s.exercicios[0].series[0]).toMatchObject({ feita: true, cargaKg: 50, reps: 10 });
    expect(s.descanso).not.toBeNull();
    // a próxima série herda a carga
    expect(within(card).getByLabelText("Carga da série 2")).toHaveValue("50");
    await userEvent.click(screen.getByRole("button", { name: "Pular descanso" }));
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("retoma o treino depois de fechar e abrir o app", async () => {
    const card = await comecar();
    await registrar(card, 1, "40", "12");
    // simula fechar a aba e abrir de novo
    const { unmount } = { unmount: () => document.body.replaceChildren() };
    unmount();
    renderApp("/");
    expect(await screen.findByText("Treino em andamento", {}, ESPERA)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Retomar treino/ }));
    const card2 = await screen.findByRole("region", { name: /^Exercício 1:/ }, ESPERA);
    expect(within(card2).getByRole("button", { name: "Desfazer série 1" })).toBeInTheDocument();
    expect(within(card2).getByLabelText("Repetições da série 1")).toHaveValue("12");
  });

  it("pausa e retoma", async () => {
    await comecar();
    await userEvent.click(screen.getByRole("button", { name: "Pausar treino" }));
    expect(screen.getByRole("dialog", { name: "Treino pausado" })).toBeInTheDocument();
    expect(guardado().sessao.pausadaEm).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Retomar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("concluir gera o resumo, guarda o histórico e libera o próximo treino", async () => {
    const card = await comecar();
    await registrar(card, 1, "60", "10");
    await userEvent.click(screen.getByRole("button", { name: "Encerrar treino" }));
    await userEvent.click(screen.getByRole("button", { name: "Concluir treino" }));

    expect(await screen.findByRole("heading", { name: "Treino concluído" }, ESPERA)).toBeInTheDocument();
    expect(screen.getByText("de volume").previousSibling).toHaveTextContent("600 kg");
    expect(screen.getByText(/Próxima vez:/)).toBeInTheDocument();
    expect(guardado()).toBeNull();

    // histórico local: a série aparece no detalhe do exercício
    document.body.replaceChildren();
    renderApp("/exercicios/supino-reto-barra");
    expect(await screen.findByText(/60×10/, {}, ESPERA)).toBeInTheDocument();
  });

  it("encerrar sem séries descarta o treino", async () => {
    await comecar();
    await userEvent.click(screen.getByRole("button", { name: "Encerrar treino" }));
    expect(screen.getByText(/Descartar o treino\?/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(guardado()).toBeNull();
    expect(await screen.findByRole("heading", { level: 1, name: "Treino" }, ESPERA)).toBeInTheDocument();
  });
});

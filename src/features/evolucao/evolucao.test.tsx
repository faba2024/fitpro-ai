import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { TreinoProvider } from "@/app/treinoAtivo";
import { LocalRepositorio } from "@/data/local";
import { chaveDia } from "@/domain/datas";

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

describe("evolução (modo local com exemplo)", { timeout: 30000 }, () => {
  beforeEach(async () => {
    localStorage.clear();
    await new LocalRepositorio(localStorage).carregarExemplo();
  });

  it("mostra o resumo do período e muda o período pela URL", async () => {
    renderApp("/evolucao?periodo=30");
    const resumo = await screen.findByRole("region", { name: "Resumo do período" }, ESPERA);
    expect(within(resumo).getByText("Treinos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 dias" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Tudo" }));
    expect(screen.getByRole("button", { name: "Tudo" })).toHaveAttribute("aria-pressed", "true");
  });

  it("gráficos têm descrição acessível e tabela de dados", async () => {
    renderApp("/evolucao");
    expect(await screen.findByRole("img", { name: /Peso \(kg\): gráfico de linha/ }, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Treinos por semana: gráfico de barras com 12 barras/ })).toBeInTheDocument();
    expect(screen.getAllByText("Ver dados em tabela").length).toBeGreaterThanOrEqual(3);
  });

  it("registra medidas com validação e mostra no histórico", async () => {
    renderApp("/evolucao");
    await userEvent.click(await screen.findByRole("button", { name: "Registrar" }, ESPERA));
    await userEvent.click(screen.getByRole("button", { name: "Salvar medidas" }));
    expect(screen.getByText("Preencha pelo menos uma medida.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Peso (kg)"), "77,9");
    await userEvent.click(screen.getByRole("button", { name: /Mais medidas/ }));
    await userEvent.type(screen.getByLabelText("Cintura (cm)"), "86");
    await userEvent.click(screen.getByRole("button", { name: "Salvar medidas" }));

    expect(await screen.findByText(/77,9 kg · cintura 86 cm/, {}, ESPERA)).toBeInTheDocument();
    const salvo = JSON.parse(localStorage.getItem("fitpro:dados:v1")!);
    expect(salvo.medidas.find((m: { data: string }) => m.data === chaveDia(new Date()))).toMatchObject({ pesoKg: 77.9, cinturaCm: 86 });
  });

  it("fotos explicam que precisam de conta no modo local", async () => {
    renderApp("/evolucao");
    expect(await screen.findByText("Fotos ficam disponíveis com conta", {}, ESPERA)).toBeInTheDocument();
  });

  it("cargas e recordes aparecem depois de registrar séries", async () => {
    // treino com supino registrado direto no repositório local
    const repo = new LocalRepositorio(localStorage);
    const agora = new Date().toISOString();
    await repo.salvarSessao({
      id: "s1", planoId: null, planoSessaoId: "a", letra: "A", titulo: "Peito", status: "concluida",
      iniciadaEm: agora, finalizadaEm: agora, pausadaEm: null, pausaMs: 0, atual: 0, descanso: null, atualizadoEm: agora,
      exercicios: [{
        exercicioId: "supino-reto-barra", nome: "Supino reto com barra", tipo: "composto", porTempo: false, sugestao: null, pulado: false,
        alvo: { series: 1, repsMin: 8, repsMax: 10, descansoS: 90 },
        series: [{ id: "x1", cargaKg: 70, reps: 8, feita: true, feitaEm: agora }],
      }],
    });
    renderApp("/evolucao");
    const recordes = await screen.findByRole("heading", { name: "Recordes pessoais" }, ESPERA);
    const card = recordes.closest("section")!;
    expect(await within(card).findByText("70 kg", {}, ESPERA)).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: /Maior carga — Supino reto com barra/ }, ESPERA)).toBeInTheDocument();
  });
});

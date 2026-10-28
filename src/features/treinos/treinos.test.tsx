import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemoryRouter, useRoutes } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthProvider } from "@/app/auth";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { LocalRepositorio } from "@/data/local";
import { paraLinha } from "@/data/perfilMapper";
import { PARQ } from "@/domain/tipos";
import { supabaseFalso } from "@/test/supabaseFalso";

function Rotas() {
  return useRoutes(rotas);
}

const ESPERA = { timeout: 5000 };

function renderLocal(caminho: string) {
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

function renderNuvem(cliente: SupabaseClient, caminho: string) {
  return render(
    <TemaProvider>
      <AuthProvider cliente={cliente}>
        <DadosProvider>
          <MemoryRouter initialEntries={[caminho]}>
            <Rotas />
          </MemoryRouter>
        </DadosProvider>
      </AuthProvider>
    </TemaProvider>,
  );
}

const perfil = paraLinha("user-1", {
  nome: "Joana Lima",
  dataNascimento: "1992-03-10",
  alturaCm: 165,
  pesoKg: 61.5,
  objetivo: "hipertrofia",
  nivel: "intermediario",
  diasSemana: 4,
  minutosSessao: 60,
  equipamentos: ["halteres", "banco"],
  limitacoes: "",
  parq: Object.fromEntries(Object.keys(PARQ).map((k) => [k, false])),
  consentimentoTermosEm: "2026-10-01T00:00:00Z",
  consentimentoSaudeEm: "2026-10-01T00:00:00Z",
});

describe("montar treino (conta)", { timeout: 30000 }, () => {
  beforeEach(() => sessionStorage.clear());

  it("sem ficha, oferece montar; a prévia segue o perfil e salva a ficha ativa", async () => {
    const { cliente, chamadas } = supabaseFalso({ logado: true, perfil });
    renderNuvem(cliente, "/treino");
    await userEvent.click(await screen.findByRole("link", { name: "Montar meu treino" }, ESPERA));

    expect(await screen.findByRole("heading", { name: "Montar treino" }, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Superiores/inferiores" })).toBeInTheDocument();
    // só halteres e banco: nada de barra ou máquina
    expect(screen.queryByText("Supino reto com barra")).not.toBeInTheDocument();
    expect(screen.queryByText("Leg press 45°")).not.toBeInTheDocument();

    // mudar os dias muda a divisão na hora
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByRole("heading", { name: "Empurrar, puxar e pernas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Usar esta ficha" }));
    await waitFor(() => expect(chamadas.upsertPlano).toHaveBeenCalledTimes(1));
    const linha = chamadas.upsertPlano.mock.calls[0]![0] as Record<string, unknown>;
    expect(linha).toMatchObject({ aluno_id: "user-1", ativo: true, origem: "motor", nome: "Empurrar, puxar e pernas" });
    expect((linha.estrutura as unknown[]).length).toBe(3);

    expect(await screen.findByText("Montada pelo app · não revisada", {}, ESPERA)).toBeInTheDocument();
  });
});

describe("editar ficha (modo local)", { timeout: 30000 }, () => {
  beforeEach(async () => {
    localStorage.clear();
    await new LocalRepositorio(localStorage).carregarExemplo();
  });

  it("valida campos, troca exercício e salva como editada", async () => {
    renderLocal("/treino/editar");
    const treinoA = await screen.findByRole("region", { name: "Treino A" }, ESPERA);

    const series = within(treinoA).getAllByLabelText("Séries")[0]!;
    await userEvent.clear(series);
    await userEvent.type(series, "0");
    expect(within(treinoA).getByText("De 1 a 10 séries.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar ficha" }));
    expect(screen.getByText(/Corrija os campos destacados/)).toBeInTheDocument();
    await userEvent.clear(series);
    await userEvent.type(series, "5");

    await userEvent.click(within(treinoA).getByRole("button", { name: "Trocar Supino reto com barra" }));
    await userEvent.click(within(treinoA).getByRole("button", { name: /Flexão de braço/ }));
    expect(within(treinoA).getByText("Flexão de braço")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Salvar ficha" }));
    expect(await screen.findByText("Editada por você · não revisada", {}, ESPERA)).toBeInTheDocument();
    const salvo = JSON.parse(localStorage.getItem("fitpro:dados:v1")!);
    expect(salvo.plano.sessoes[0].itens[0]).toMatchObject({ exercicioId: "flexao", series: 5 });
  });

  it("remover todos os exercícios de um treino gera erro na conferência", async () => {
    renderLocal("/treino/editar");
    const treinoA = await screen.findByRole("region", { name: "Treino A" }, ESPERA);
    // um de cada vez: a lista é redesenhada após cada remoção
    while (within(treinoA).queryAllByRole("button", { name: /^Remover / }).length) {
      await userEvent.click(within(treinoA).getAllByRole("button", { name: /^Remover / })[0]!);
    }
    expect(screen.getByText("Treino A está sem exercícios.")).toBeInTheDocument();
  });
});

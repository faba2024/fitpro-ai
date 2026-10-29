import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useRoutes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AcademiaProvider } from "@/app/academia";
import { AuthProvider } from "@/app/auth";
import { DadosProvider } from "@/app/dados";
import { rotas } from "@/app/rotas";
import { TemaProvider } from "@/app/tema";
import { TreinoProvider } from "@/app/treinoAtivo";
import type { DetalheAluno } from "@/data/academia";
import { paraLinha } from "@/data/perfilMapper";
import { competenciaDe, type Membro } from "@/domain/academia";
import { PARQ, type PerfilCompleto } from "@/domain/tipos";
import { repoAcademiaFalso } from "@/test/repoAcademiaFalso";
import { supabaseFalso } from "@/test/supabaseFalso";

function Rotas() {
  return useRoutes(rotas);
}

const ESPERA = { timeout: 5000 };

const perfilAluna: PerfilCompleto = {
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
  metaPesoKg: null,
};

function renderApp(rota: string, falso: ReturnType<typeof repoAcademiaFalso>, opcoes: { local?: boolean } = {}) {
  const cliente = opcoes.local ? null : supabaseFalso({ logado: true, perfil: paraLinha("user-1", perfilAluna) }).cliente;
  return render(
    <TemaProvider>
      <AuthProvider cliente={cliente}>
        <DadosProvider>
          <AcademiaProvider repo={opcoes.local ? undefined : falso.repo}>
            <TreinoProvider>
              <MemoryRouter initialEntries={[rota]}>
                <Rotas />
              </MemoryRouter>
            </TreinoProvider>
          </AcademiaProvider>
        </DadosProvider>
      </AuthProvider>
    </TemaProvider>,
  );
}

const vinculoProfessor = { academiaId: "acad-1", academiaNome: "Academia Teste", papel: "professor" as const, ativo: true, professorId: null, professorNome: null };
const vinculoAdmin = { ...vinculoProfessor, papel: "admin" as const };

const membro = (userId: string, nome: string, papel: Membro["papel"], extra: Partial<Membro> = {}): Membro => ({
  userId,
  nome,
  papel,
  professorId: null,
  ativo: true,
  desde: "2026-10-01T00:00:00Z",
  ...extra,
});

describe("academias e painéis", { timeout: 30000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it("no modo local explica que precisa de conta, sem simular", async () => {
    renderApp("/academia", repoAcademiaFalso(), { local: true });
    expect(await screen.findByText("Disponível só com conta", {}, ESPERA)).toBeInTheDocument();
    expect(screen.queryByLabelText("Código do convite")).not.toBeInTheDocument();
  });

  it("entra com código de convite (normalizado) e mostra o vínculo com o professor", async () => {
    const falso = repoAcademiaFalso({ codigoValido: "A1B2C3D4E5" });
    renderApp("/academia", falso);
    const campo = await screen.findByLabelText("Código do convite", {}, ESPERA);

    await userEvent.type(campo, "xyz");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(/10 letras e números/)).toBeInTheDocument();
    expect(falso.repo.aceitarConvite).not.toHaveBeenCalled();

    await userEvent.clear(campo);
    await userEvent.type(campo, "a1b2c-3d4e5");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(/Você entrou em Academia Teste como aluno/, {}, ESPERA)).toBeInTheDocument();
    expect(falso.repo.aceitarConvite).toHaveBeenCalledWith("A1B2C3D4E5");
    expect(await screen.findByText(/professor: Carlos Prof/, {}, ESPERA)).toBeInTheDocument();

    // sair pede confirmação e explica a consequência
    await userEvent.click(screen.getByRole("button", { name: /Sair de Academia Teste/ }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/professor deixa de ver/));
    await waitFor(() => expect(screen.queryByText(/professor: Carlos Prof/)).not.toBeInTheDocument());
  });

  it("código errado mostra a mensagem do servidor", async () => {
    renderApp("/academia", repoAcademiaFalso({ codigoValido: "FFFFFFFFFF" }));
    await userEvent.type(await screen.findByLabelText("Código do convite", {}, ESPERA), "A1B2C3D4E5{enter}");
    expect(await screen.findByText(/Convite inválido ou expirado/, {}, ESPERA)).toBeInTheDocument();
  });

  it("cria academia e abre a gestão", async () => {
    const falso = repoAcademiaFalso();
    renderApp("/academia", falso);
    await userEvent.click(await screen.findByRole("button", { name: "Criar academia" }, ESPERA));
    await userEvent.type(screen.getByLabelText("Nome da academia"), "Studio Movimento");
    await userEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(falso.repo.criarAcademia).toHaveBeenCalledWith("Studio Movimento");
    expect(await screen.findByRole("tablist", { name: "Seções da gestão" }, ESPERA)).toBeInTheDocument();
  });

  describe("professor", () => {
    const detalhe = (comPlano: boolean): DetalheAluno => ({
      id: "aluna-1",
      perfil: perfilAluna,
      plano: comPlano
        ? {
            id: "plano-1",
            nome: "Ficha da Joana",
            objetivo: "hipertrofia",
            origem: "motor",
            sessoes: [{ id: "s1", nome: "A", titulo: "Corpo inteiro", itens: [{ exercicioId: "agachamento-goblet", nome: "Agachamento goblet", grupo: "Pernas", series: 3, repsMin: 8, repsMax: 12, descansoS: 90, cargaKg: null }] }],
            revisadoEm: null,
            observacaoProfissional: null,
          }
        : null,
      sessoes: [{ id: "t1", planoSessaoId: "s1", titulo: "Corpo inteiro", status: "concluida", iniciadaEm: new Date().toISOString(), finalizadaEm: null, seriesConcluidas: 9, volumeKg: 1500 }],
      medidas: [{ data: "2026-10-20", pesoKg: 60.8 }],
    });

    const alunos = [
      {
        id: "aluna-1",
        academiaId: "acad-1",
        nome: "Joana Lima",
        objetivo: "hipertrofia" as const,
        nivel: "iniciante" as const,
        diasSemana: 3,
        parqAlerta: true,
        temLimitacoes: true,
        treinos30d: [new Date().toISOString()],
        ficha: { nome: "Ficha da Joana", origem: "motor" as const, revisadaEm: null },
      },
    ];

    it("lista os alunos com alertas de saúde e abre o detalhe para revisar a ficha", async () => {
      const falso = repoAcademiaFalso({ vinculos: [vinculoProfessor], alunos, detalhes: { "aluna-1": detalhe(true) } });
      renderApp("/professor", falso);
      expect(await screen.findByText("Questionário de saúde pede atenção", {}, ESPERA)).toBeInTheDocument();
      expect(screen.getByText("Ficha para revisar")).toBeInTheDocument();
      expect(screen.getByText(/1 treino em 7 dias, 1 em 30/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("link", { name: "Joana Lima" }));
      expect(await screen.findByText(/Respondeu “sim” no questionário/, {}, ESPERA)).toBeInTheDocument();
      expect(screen.getByText(/dor no joelho direito/)).toBeInTheDocument();
      expect(screen.getByText(/60,8 kg/)).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText("Observação para o aluno"), "Capriche no aquecimento.");
      await userEvent.click(screen.getByRole("button", { name: "Marcar como revisada" }));
      await waitFor(() => expect(falso.repo.revisarFicha).toHaveBeenCalledWith("plano-1", "Capriche no aquecimento."));
      expect(await screen.findByText(/Revisada por profissional/, {}, ESPERA)).toBeInTheDocument();
    });

    it("monta ficha nova pelo perfil do aluno (modo conservador) e salva para ele", async () => {
      const falso = repoAcademiaFalso({ vinculos: [vinculoProfessor], alunos, detalhes: { "aluna-1": detalhe(false) } });
      renderApp("/professor/alunos/aluna-1", falso);
      await userEvent.click(await screen.findByRole("link", { name: "Montar ficha" }, ESPERA));
      expect(await screen.findByRole("heading", { name: "Nova ficha para Joana" }, ESPERA)).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Salvar e enviar ao aluno" }));
      await waitFor(() => expect(falso.repo.salvarFichaDoAluno).toHaveBeenCalled());
      const [alunoId, plano] = falso.repo.salvarFichaDoAluno.mock.calls[0]!;
      expect(alunoId).toBe("aluna-1");
      expect(plano!.sessoes.length).toBeGreaterThan(0);
      // limitações/PAR-Q do aluno → motor conservador
      expect(plano!.parametros).toMatchObject({ conservador: true, equipamentos: ["halteres"] });
      expect(await screen.findByRole("heading", { name: "Joana Lima" }, ESPERA)).toBeInTheDocument();
    });

    it("sem vínculo de professor orienta a pedir convite", async () => {
      renderApp("/professor", repoAcademiaFalso());
      expect(await screen.findByText(/ainda não é professor/, {}, ESPERA)).toBeInTheDocument();
    });
  });

  describe("gestão (admin)", () => {
    const membros = [
      membro("admin-1", "Dona Admin", "admin"),
      membro("prof-1", "Carlos Prof", "professor"),
      membro("aluna-1", "Joana Lima", "aluno", { professorId: "prof-1" }),
      membro("aluno-2", "Pedro Souza", "aluno"),
    ];

    it("resumo conta membros e pagamentos do mês, sem dados de saúde", async () => {
      const competencia = competenciaDe(new Date());
      const falso = repoAcademiaFalso({
        vinculos: [vinculoAdmin],
        membros,
        pagamentos: [{ id: "p1", alunoId: "aluna-1", competencia, valor: 120, pagoEm: "2026-10-05", forma: "pix", observacao: "" }],
      });
      renderApp("/gestao/acad-1", falso);
      const numeros = await screen.findByText("Alunos ativos", {}, ESPERA);
      const dl = numeros.closest("dl")!;
      expect(within(dl).getByText("2", { selector: "dd" })).toBeInTheDocument();
      expect(await within(dl).findByText("1/2", {}, ESPERA)).toBeInTheDocument();
      expect(screen.queryByText(/joelho/)).not.toBeInTheDocument();
    });

    it("troca o professor de um aluno e desativa com confirmação", async () => {
      const falso = repoAcademiaFalso({ vinculos: [vinculoAdmin], membros });
      renderApp("/gestao/acad-1?aba=membros", falso);
      const select = await screen.findByLabelText("Professor de Pedro Souza", {}, ESPERA);
      await userEvent.selectOptions(select, "prof-1");
      await waitFor(() => expect(falso.repo.definirProfessor).toHaveBeenCalledWith("acad-1", "aluno-2", "prof-1"));

      await userEvent.click(screen.getByRole("button", { name: "Desativar Carlos Prof" }));
      expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/ficam sem professor/));
      await waitFor(() => expect(falso.repo.definirAtivo).toHaveBeenCalledWith("acad-1", "prof-1", "professor", false));
      expect(await screen.findByRole("button", { name: "Reativar Carlos Prof" }, ESPERA)).toBeInTheDocument();
    });

    it("registra mensalidade de quem está em aberto, com o valor padrão", async () => {
      const falso = repoAcademiaFalso({ vinculos: [vinculoAdmin], membros });
      renderApp("/gestao/acad-1?aba=mensalidades", falso);
      expect(await screen.findByText(/não faz cobranças/, {}, ESPERA)).toBeInTheDocument();
      await userEvent.click(await screen.findByRole("button", { name: "Registrar pagamento de Pedro Souza" }, ESPERA));
      expect(screen.getByLabelText("Valor (R$)")).toHaveValue("120");
      await userEvent.click(screen.getByRole("button", { name: "Salvar pagamento" }));
      await waitFor(() => expect(falso.repo.registrarPagamento).toHaveBeenCalled());
      expect(falso.repo.registrarPagamento.mock.calls[0]![1]).toMatchObject({ alunoId: "aluno-2", valor: 120, forma: "pix", competencia: competenciaDe(new Date()) });
      // Pedro sai da lista em aberto; Joana continua
      expect(await screen.findByText("Em aberto (1)", {}, ESPERA)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Registrar pagamento de Pedro Souza" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Registrar pagamento de Joana Lima" })).toBeInTheDocument();
    });

    it("cria convite de professor, mostra o código e revoga", async () => {
      const falso = repoAcademiaFalso({ vinculos: [vinculoAdmin], membros });
      renderApp("/gestao/acad-1?aba=convites", falso);
      await userEvent.click(await screen.findByRole("radio", { name: "Professor" }, ESPERA));
      await userEvent.click(screen.getByRole("button", { name: "Criar convite de professor" }));
      await waitFor(() => expect(falso.repo.criarConvite).toHaveBeenCalledWith("acad-1", "professor", 1, 7, false));
      const lista = await screen.findByRole("list", { name: "Convites abertos" }, ESPERA);
      expect(within(lista).getByText(/Professor · usado 0 de 1/)).toBeInTheDocument();
      await userEvent.click(within(lista).getByRole("button", { name: /Revogar convite/ }));
      await waitFor(() => expect(falso.repo.revogarConvite).toHaveBeenCalled());
      expect(await screen.findByText("Nenhum convite aberto.", {}, ESPERA)).toBeInTheDocument();
    });
  });
});

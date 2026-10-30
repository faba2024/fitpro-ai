// Jornada no modo local (sem conta): explorar com exemplo, treinar, fechar no meio, retomar e ver a evolução.
import { expect, test } from "@playwright/test";
import { registrarSerie, semProblemasGravesDeAcessibilidade, semRolagemLateral } from "./util";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("treino completo com retomada depois de recarregar a página", async ({ page }) => {
  await page.getByRole("button", { name: "Explorar com exemplo" }).click();
  await expect(page.getByText("Treino do dia")).toBeVisible();
  await expect(page.getByText(/dados de exemplo/).first()).toBeVisible();

  await page.getByRole("link", { name: /Iniciar treino/ }).click();
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.getByRole("region", { name: /^Exercício 1:/ })).toBeVisible();

  await registrarSerie(page, 1, "40", "12");
  await expect(page.getByRole("timer", { name: "Descanso" })).toBeVisible();

  // fecha "a aba" no meio do treino: recarregar perde toda a memória da página
  await page.goto("/");
  await page.reload();
  await expect(page.getByText("Treino em andamento")).toBeVisible();
  await page.getByRole("link", { name: /Retomar treino/ }).click();
  const card = page.getByRole("region", { name: /^Exercício 1:/ });
  await expect(card.getByRole("button", { name: "Desfazer série 1" })).toBeVisible();
  await expect(card.getByLabel("Repetições da série 1")).toHaveValue("12");

  await page.getByRole("button", { name: "Pular descanso" }).click();
  await registrarSerie(page, 2, "40", "10");
  await page.getByRole("button", { name: "Encerrar treino" }).click();
  await page.getByRole("button", { name: "Concluir treino" }).click();
  await expect(page.getByRole("heading", { name: "Treino concluído" })).toBeVisible();
  await expect(page.getByText(/Próxima vez:/).first()).toBeVisible();
  await semRolagemLateral(page);

  await page.goto("/evolucao");
  await expect(page.getByRole("heading", { level: 1, name: "Evolução" })).toBeVisible();
  await semRolagemLateral(page);
});

const ROTAS = ["/", "/treino", "/treino/novo", "/exercicios", "/exercicios/agachamento-goblet", "/anatomia", "/evolucao", "/assistente", "/academia", "/perfil", "/termos", "/privacidade", "/rota-que-nao-existe"];

test("todas as telas abrem sem rolagem lateral e sem problemas graves de acessibilidade", async ({ page }) => {
  // 13 telas com a varredura do axe: ~45 s numa máquina comum
  test.setTimeout(180_000);
  await page.getByRole("button", { name: "Explorar com exemplo" }).click();
  await expect(page.getByText("Treino do dia")).toBeVisible();
  for (const rota of ROTAS) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await semRolagemLateral(page);
    await semProblemasGravesDeAcessibilidade(page);
  }
});

test("tema escuro e claro passam na checagem de contraste", async ({ page }) => {
  await page.getByRole("button", { name: "Explorar com exemplo" }).click();
  for (const tema of ["escuro", "claro"]) {
    await page.evaluate((t) => localStorage.setItem("fitpro:tema", t), tema);
    await page.goto("/");
    await expect(page.getByText("Treino do dia")).toBeVisible();
    await semProblemasGravesDeAcessibilidade(page);
  }
});

// Jornada com conta: cadastro → onboarding → montar ficha → treinar → fechar a aba → retomar → concluir → evolução.
// O Supabase é o falso de e2e/supabaseFalso.ts (em memória); nenhuma conta real é criada.
import { expect, test } from "@playwright/test";
import { SupabaseFalso } from "./supabaseFalso";
import { registrarSerie, semProblemasGravesDeAcessibilidade, semRolagemLateral } from "./util";

test("sem login, as telas do app levam para Entrar", async ({ page }) => {
  await new SupabaseFalso().instalar(page);
  await page.goto("/treino");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await semProblemasGravesDeAcessibilidade(page);
  // documentos abrem sem login
  await page.getByRole("link", { name: "Termos de Uso" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Termos de Uso" })).toBeVisible();
});

test("jornada completa com conta", async ({ page }) => {
  const db = new SupabaseFalso();
  await db.instalar(page);

  await page.goto("/criar-conta");
  await page.getByLabel("E-mail").fill("joana@exemplo.test");
  await page.getByLabel("Senha", { exact: true }).fill("treino2026");
  await page.getByLabel("Confirme a senha").fill("treino2026");
  await page.getByRole("button", { name: "Criar conta" }).click();

  // onboarding em 5 etapas
  await expect(page.getByRole("heading", { name: "Sobre você" })).toBeVisible();
  await page.getByLabel("Nome").fill("Joana Lima");
  await page.getByLabel("Data de nascimento").fill("1992-03-10");
  await page.getByLabel("Altura (cm)").fill("165");
  await page.getByLabel("Peso (kg)").fill("61,5");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Objetivo e rotina" })).toBeVisible();
  await page.getByLabel(/^Hipertrofia/).check();
  await page.getByLabel(/^Iniciante/).check();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Equipamentos" })).toBeVisible();
  await page.getByLabel("Academia completa").check();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Saúde e segurança" })).toBeVisible();
  // o rádio fica escondido sob o rótulo "Não": clica no rótulo, como a pessoa faria
  for (const grupo of await page.getByRole("radiogroup").all()) await grupo.locator("label").nth(1).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Privacidade" })).toBeVisible();
  // os documentos existem e abrem em outra aba
  const [aba] = await Promise.all([page.context().waitForEvent("page"), page.getByRole("link", { name: "Política de Privacidade" }).click()]);
  await expect(aba.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeVisible();
  await aba.close();
  await page.getByLabel(/Termos de Uso/).check();
  await page.getByLabel(/dados de saúde/).check();
  await page.getByRole("button", { name: "Concluir cadastro" }).click();

  await expect(page.getByRole("heading", { name: /, Joana$/ })).toBeVisible();
  expect(db.tabela("perfis")).toHaveLength(1);
  expect(db.tabela("perfis")[0]).toMatchObject({ nome: "Joana Lima", objetivo: "hipertrofia", parq_alerta: false });

  // monta a ficha pelo motor
  await page.goto("/treino");
  await page.getByRole("link", { name: "Montar meu treino" }).click();
  await page.getByRole("button", { name: "Usar esta ficha" }).click();
  await expect(page.getByText("Montada pelo app · não revisada")).toBeVisible();
  expect(db.tabela("planos").filter((p) => p.ativo)).toHaveLength(1);

  // treina, "fecha a aba" e retoma
  await page.goto("/");
  await page.getByRole("link", { name: /Iniciar treino/ }).click();
  await page.getByRole("button", { name: "Começar treino" }).click();
  await registrarSerie(page, 1, "20", "12");
  await expect(page.getByRole("timer", { name: "Descanso" })).toBeVisible();

  await page.goto("/");
  await page.reload();
  await page.getByRole("link", { name: /Retomar treino/ }).click();
  await expect(page.getByRole("region", { name: /^Exercício 1:/ }).getByRole("button", { name: "Desfazer série 1" })).toBeVisible();
  await page.getByRole("button", { name: "Pular descanso" }).click();
  await registrarSerie(page, 2, "20", "10");
  await page.getByRole("button", { name: "Encerrar treino" }).click();
  await page.getByRole("button", { name: "Concluir treino" }).click();
  await expect(page.getByRole("heading", { name: "Treino concluído" })).toBeVisible();

  // a sessão e as séries foram para a conta
  await expect.poll(() => db.tabela("sessoes").filter((s) => s.status === "concluida").length).toBe(1);
  await expect.poll(() => db.tabela("series").length).toBe(2);

  await page.goto("/evolucao");
  await expect(page.getByRole("heading", { level: 1, name: "Evolução" })).toBeVisible();
  await semRolagemLateral(page);
  await semProblemasGravesDeAcessibilidade(page);

  // academias com conta: entrar com código mostra o aviso de privacidade
  await page.goto("/academia");
  await expect(page.getByLabel("Código do convite")).toBeVisible();
  await expect(page.getByText(/administração da academia vê só seu nome/)).toBeVisible();
  await semRolagemLateral(page);
  await semProblemasGravesDeAcessibilidade(page);
});

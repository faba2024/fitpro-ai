import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** A página não pode rolar para os lados (problema comum no celular). */
export async function semRolagemLateral(page: Page) {
  const { largura, conteudo } = await page.evaluate(() => ({ largura: window.innerWidth, conteudo: document.documentElement.scrollWidth }));
  expect.soft(conteudo, `conteúdo com ${conteudo}px numa tela de ${largura}px`).toBeLessThanOrEqual(largura);
}

/** Acessibilidade automática (axe): falha em problemas graves ou críticos. */
export async function semProblemasGravesDeAcessibilidade(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const resumo = graves.flatMap((v) => v.nodes.slice(0, 6).map((n) => `${v.id} (${v.impact}) ${n.target.join(" ")}: ${n.any[0]?.message ?? v.help}`));
  expect.soft(resumo, `problemas de acessibilidade em ${page.url()}`).toEqual([]);
}

/** Registra uma série no modo treino (exercício em foco). */
export async function registrarSerie(page: Page, serie: number, kg: string, reps: string) {
  const card = page.getByRole("region", { name: /^Exercício 1:/ });
  const carga = card.getByLabel(`Carga da série ${serie}`);
  await carga.fill(kg);
  await card.getByLabel(`Repetições da série ${serie}`).fill(reps);
  await card.getByRole("button", { name: `Concluir série ${serie}` }).click();
}

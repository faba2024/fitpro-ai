import { defineConfig, devices } from "@playwright/test";

// Dois servidores de teste:
//  • local: sem Supabase (dados só no navegador)
//  • nuvem: com um endereço fictício de Supabase, respondido pelo e2e/supabaseFalso.ts
// Nenhum teste fala com o Supabase real.
const PORTA_LOCAL = 5191;
const PORTA_NUVEM = 5192;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { trace: "retain-on-failure", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "local-celular", testMatch: /local\..*\.spec\.ts/, use: { ...devices["Pixel 7"], baseURL: `http://localhost:${PORTA_LOCAL}` } },
    { name: "local-computador", testMatch: /local\..*\.spec\.ts/, use: { ...devices["Desktop Chrome"], colorScheme: "dark", baseURL: `http://localhost:${PORTA_LOCAL}` } },
    { name: "nuvem-celular", testMatch: /nuvem\..*\.spec\.ts/, use: { ...devices["Pixel 7"], baseURL: `http://localhost:${PORTA_NUVEM}` } },
  ],
  webServer: [
    {
      command: `npx vite --port ${PORTA_LOCAL} --strictPort`,
      port: PORTA_LOCAL,
      reuseExistingServer: !process.env.CI,
      env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
    },
    {
      command: `npx vite --port ${PORTA_NUVEM} --strictPort`,
      port: PORTA_NUVEM,
      reuseExistingServer: !process.env.CI,
      env: { VITE_SUPABASE_URL: "http://supabase.e2e.test", VITE_SUPABASE_ANON_KEY: "anon-e2e" },
    },
  ],
});

// Supabase falso para os testes E2E: intercepta as chamadas do navegador ao endereço
// fictício configurado no build de teste e responde com um banco em memória.
// Nada sai para a internet e nenhuma conta real é criada.
import type { Page, Route } from "@playwright/test";

export const URL_FALSA = "http://supabase.e2e.test";

type Linha = Record<string, unknown>;

const USUARIO = {
  id: "00000000-0000-4000-8000-0000000000e2",
  aud: "authenticated",
  role: "authenticated",
  email: "",
  email_confirmed_at: "2026-10-29T00:00:00Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-10-29T00:00:00Z",
};

function sessao(email: string) {
  const agora = Math.floor(Date.now() / 1000);
  return {
    access_token: "token-e2e",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: agora + 3600,
    refresh_token: "refresh-e2e",
    user: { ...USUARIO, email },
  };
}

/** Aplica os filtros do PostgREST usados pelo app (eq, neq, in, not.in, gte, lte, is). */
function filtrar(linhas: Linha[], params: URLSearchParams): Linha[] {
  let saida = linhas;
  for (const [col, cond] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(col)) continue;
    const [op, ...resto] = cond.split(".");
    const valor = resto.join(".");
    const lista = (v: string) => v.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, ""));
    saida = saida.filter((l) => {
      const atual = l[col] == null ? null : String(l[col]);
      switch (op) {
        case "eq":
          return atual === valor;
        case "neq":
          return atual !== valor;
        case "in":
          return atual != null && lista(valor).includes(atual);
        case "not":
          return resto[0] === "in" ? !lista(resto.slice(1).join(".")).includes(String(atual)) : true;
        case "gte":
          return atual != null && atual >= valor;
        case "lte":
          return atual != null && atual <= valor;
        case "is":
          return valor === "null" ? atual == null : true;
        default:
          return true;
      }
    });
  }
  const ordem = params.get("order");
  if (ordem) {
    const [col, dir] = ordem.split(".");
    saida = [...saida].sort((a, b) => (String(a[col!]) < String(b[col!]) ? -1 : 1) * (dir === "desc" ? -1 : 1));
  }
  const limite = params.get("limit");
  return limite ? saida.slice(0, Number(limite)) : saida;
}

export class SupabaseFalso {
  tabelas: Record<string, Linha[]> = {};
  email = "";
  chamadas: { metodo: string; caminho: string }[] = [];

  tabela(nome: string) {
    return (this.tabelas[nome] ??= []);
  }

  async instalar(page: Page) {
    await page.route(`${URL_FALSA}/**`, (route) => this.responder(route));
  }

  private json(route: Route, status: number, corpo?: unknown) {
    return route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" },
      body: corpo === undefined ? "" : JSON.stringify(corpo),
    });
  }

  private async responder(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const metodo = req.method();
    if (metodo === "OPTIONS") return this.json(route, 204);
    this.chamadas.push({ metodo, caminho: url.pathname });
    const corpo = req.postData() ? (JSON.parse(req.postData()!) as unknown) : undefined;

    // ── Auth ──
    if (url.pathname === "/auth/v1/signup" || (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password")) {
      this.email = String((corpo as Linha).email);
      return this.json(route, 200, sessao(this.email));
    }
    if (url.pathname === "/auth/v1/token") return this.json(route, 200, sessao(this.email));
    if (url.pathname === "/auth/v1/user") return this.json(route, 200, { ...USUARIO, email: this.email });
    if (url.pathname === "/auth/v1/logout") return this.json(route, 204);

    // ── RPC ──
    const rpc = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
    if (rpc) {
      if (rpc[1] === "recordes") {
        const ids = ((corpo as Linha)?.p_exercicios as string[]) ?? [];
        const max = new Map<string, number>();
        for (const s of this.tabela("series")) {
          const id = String(s.exercicio_id);
          if (ids.includes(id) && s.carga_kg != null) max.set(id, Math.max(max.get(id) ?? 0, Number(s.carga_kg)));
        }
        return this.json(route, 200, [...max].map(([exercicio_id, max_carga_kg]) => ({ exercicio_id, max_carga_kg })));
      }
      if (rpc[1] === "excluir_minha_conta") {
        this.tabelas = {};
        return this.json(route, 204);
      }
      return this.json(route, 200, []);
    }

    // ── Storage (fotos): vazio ──
    if (url.pathname.startsWith("/storage/v1/")) return this.json(route, 200, []);

    // ── PostgREST ──
    const m = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
    if (!m) return this.json(route, 404, { message: "rota desconhecida no Supabase falso" });
    const nome = m[1]!;
    const linhas = this.tabela(nome);

    if (metodo === "GET") return this.json(route, 200, filtrar(linhas, url.searchParams));

    if (metodo === "POST") {
      const novas = (Array.isArray(corpo) ? corpo : [corpo]) as Linha[];
      const conflito = url.searchParams.get("on_conflict")?.split(",");
      const ignorar = (req.headers()["prefer"] ?? "").includes("ignore-duplicates");
      for (const nova of novas) {
        const chave = conflito ?? ("id" in nova ? ["id"] : Object.keys(nova));
        const existente = linhas.find((l) => chave.every((c) => String(l[c]) === String(nova[c])));
        const agora = new Date().toISOString();
        if (existente) {
          if (!ignorar) Object.assign(existente, nova, { atualizado_em: agora });
        } else {
          linhas.push({ id: crypto.randomUUID(), criado_em: agora, atualizado_em: agora, revisado_em: null, observacao_profissional: null, ...nova });
        }
        // gatilho do banco: uma ficha ativa por aluno
        if (nome === "planos" && nova.ativo) for (const l of linhas) if (l.aluno_id === nova.aluno_id && l.id !== nova.id) l.ativo = false;
      }
      return this.json(route, 201);
    }

    if (metodo === "PATCH") {
      for (const l of filtrar(linhas, url.searchParams)) Object.assign(l, corpo);
      return this.json(route, 204);
    }

    if (metodo === "DELETE") {
      const sair = new Set(filtrar(linhas, url.searchParams));
      this.tabelas[nome] = linhas.filter((l) => !sair.has(l));
      return this.json(route, 204);
    }

    return this.json(route, 405);
  }
}

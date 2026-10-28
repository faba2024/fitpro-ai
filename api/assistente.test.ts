import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase e Anthropic simulados: nenhuma chamada de rede
const estado = { usuario: { id: "u1" } as { id: string } | null, restantes: 29 as number | null };
const criarMensagem = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => (estado.usuario ? { data: { user: estado.usuario }, error: null } : { data: { user: null }, error: { message: "jwt" } }) },
    rpc: async () => ({ data: estado.restantes, error: null }),
  }),
}));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    beta = { messages: { create: criarMensagem } };
  }
  return { default: Anthropic };
});

const { POST } = await import("./assistente");

const pedido = (corpo: unknown, token: string | null = "token-valido") =>
  new Request("http://localhost/api/assistente", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

const pergunta = { mensagens: [{ papel: "usuario", texto: "Como respirar no supino?" }], contexto: null };

describe("POST /api/assistente", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "teste";
    process.env.VITE_SUPABASE_URL = "https://exemplo.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "publica";
    estado.usuario = { id: "u1" };
    estado.restantes = 29;
    criarMensagem.mockReset();
  });

  it("sem chave da IA configurada responde 503 com mensagem clara", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await POST(pedido(pergunta));
    expect(r.status).toBe(503);
    expect((await r.json()).erro).toMatch(/não foi configurado/);
  });

  it("sem login ou com sessão inválida responde 401", async () => {
    expect((await POST(pedido(pergunta, null))).status).toBe(401);
    estado.usuario = null;
    expect((await POST(pedido(pergunta))).status).toBe(401);
  });

  it("pergunta inválida responde 400 e não gasta cota nem chama a IA", async () => {
    expect((await POST(pedido("{não é json"))).status).toBe(400);
    expect((await POST(pedido({ mensagens: [] }))).status).toBe(400);
    expect(criarMensagem).not.toHaveBeenCalled();
  });

  it("acima do limite diário responde 429 sem chamar a IA", async () => {
    estado.restantes = -1;
    const r = await POST(pedido(pergunta));
    expect(r.status).toBe(429);
    expect(criarMensagem).not.toHaveBeenCalled();
  });

  it("responde com o texto conferido e as perguntas restantes, usando o modelo de reserva em recusas", async () => {
    criarMensagem.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "Solte o ar ao empurrar no [[supino-reto-barra]]." }] });
    const r = await POST(pedido(pergunta));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      texto: "Solte o ar ao empurrar no [[supino-reto-barra]].",
      exercicios: [{ id: "supino-reto-barra", nome: "Supino reto com barra" }],
      restantes: 29,
    });
    expect(criarMensagem.mock.calls[0]![0]).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("erro da API vira mensagem amigável, sem detalhes internos", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    criarMensagem.mockRejectedValue(new (Anthropic as unknown as { APIError: new (m: string) => Error }).APIError("falha interna xyz"));
    const r = await POST(pedido(pergunta));
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toMatch(/xyz/);
  });
});

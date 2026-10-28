// Vercel Function: POST /api/assistente
// Fluxo: confere o login (token do Supabase) → valida a pergunta → consome a cota do dia → Claude.
// A chave da Anthropic existe só aqui (variável ANTHROPIC_API_KEY); a conversa não é gravada.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { ErroEntrada, responder, validarEntrada, type ClienteClaude, type RespostaClaude } from "./_lib/assistente";

const LIMITE_DIARIO = 30;
const MAX_CORPO = 40_000;

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const erro = (mensagem: string, status: number) => json({ erro: mensagem }, status);

let anthropic: Anthropic | null = null;

function clienteClaude(): ClienteClaude {
  anthropic ??= new Anthropic();
  return {
    async criar(params) {
      // se o filtro de segurança recusar no modelo principal, a API tenta um modelo de reserva
      const r = await anthropic!.beta.messages.create({
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
      return r as unknown as RespostaClaude;
    },
  };
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return erro("O assistente ainda não foi configurado neste servidor (falta a chave da IA).", 503);
  }
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const chavePublica = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !chavePublica) return erro("Servidor sem configuração do Supabase.", 503);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return erro("Entre na sua conta para usar o assistente.", 401);

  // cliente do Supabase agindo como a própria pessoa: a RLS e a cota valem para ela
  const db = createClient(url, chavePublica, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: usuario, error: erroAuth } = await db.auth.getUser(token);
  if (erroAuth || !usuario.user) return erro("Sua sessão expirou. Entre de novo.", 401);

  const bruto = await req.text();
  if (bruto.length > MAX_CORPO) return erro("Mensagem grande demais.", 413);
  let entrada;
  try {
    entrada = validarEntrada(JSON.parse(bruto));
  } catch (e) {
    return erro(e instanceof ErroEntrada ? e.message : "Requisição inválida.", 400);
  }

  const { data: restantes, error: erroCota } = await db.rpc("consumir_cota_assistente", { p_limite: LIMITE_DIARIO });
  if (erroCota) return erro("Não foi possível verificar seu limite de perguntas. Tente de novo.", 503);
  if (restantes === -1) return erro(`Você chegou ao limite de ${LIMITE_DIARIO} perguntas de hoje. Volte amanhã.`, 429);

  try {
    const resultado = await responder(clienteClaude(), entrada);
    return json({ ...resultado, restantes });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return erro("O assistente está muito procurado agora. Tente em alguns instantes.", 503);
    if (e instanceof Anthropic.APIError) {
      console.error("Anthropic", e.status, e.message);
      return erro("O assistente não conseguiu responder agora. Tente de novo.", 502);
    }
    console.error(e);
    return erro("Erro inesperado no assistente.", 500);
  }
}

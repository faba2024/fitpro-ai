import { Bot, Lock, Send, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/auth";
import { useDados } from "@/app/dados";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState } from "@/components/ui";
import { parqPedeLiberacao, type PerfilCompleto, type Plano } from "@/domain/tipos";
import s from "./Assistente.module.css";

interface Mensagem {
  papel: "usuario" | "assistente";
  texto: string;
  exercicios?: { id: string; nome: string }[];
  erro?: boolean;
}

interface Consentimento {
  perfil: boolean;
  saude: boolean;
}

const MAX = 1500;
const SUGESTOES = [
  "Como respirar no agachamento?",
  "Qual exercício substitui o leg press se eu só tenho halteres?",
  "Quantas séries por semana são boas para hipertrofia?",
  "Meu treino de hoje está bom para o meu objetivo?",
];

const chave = (tipo: string, dono: string) => `fitpro:assistente:${tipo}:${dono}`;

function lerJson<T>(armazenamento: Storage, k: string, padrao: T): T {
  try {
    const v = armazenamento.getItem(k);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarJson(armazenamento: Storage, k: string, v: unknown) {
  try {
    armazenamento.setItem(k, JSON.stringify(v));
  } catch {}
}

/** Só o que a pessoa autorizou: nunca nome, e-mail ou data de nascimento. */
export function montarContexto(c: Consentimento, perfil: PerfilCompleto | null, plano: Plano | null) {
  if (!c.perfil || !perfil) return null;
  return {
    objetivo: perfil.objetivo,
    nivel: perfil.nivel,
    diasSemana: perfil.diasSemana,
    minutosSessao: perfil.minutosSessao,
    equipamentos: perfil.equipamentos,
    ...(plano ? { ficha: plano.sessoes.map((x) => ({ titulo: `${x.nome} · ${x.titulo}`, exercicios: x.itens.map((i) => i.nome) })) } : {}),
    ...(c.saude ? { limitacoes: perfil.limitacoes || undefined, parqAlerta: parqPedeLiberacao(perfil.parq) } : {}),
  };
}

/** Texto do assistente: parágrafos, listas com "- " e links para exercícios citados como [[id]]. */
function Resposta({ texto, exercicios }: { texto: string; exercicios: { id: string; nome: string }[] }) {
  const nomes = new Map(exercicios.map((e) => [e.id, e.nome]));
  const comLinks = (linha: string): ReactNode[] =>
    linha.split(/(\[\[[a-z0-9-]+\]\])/g).map((parte, i) => {
      const m = parte.match(/^\[\[([a-z0-9-]+)\]\]$/);
      if (!m) return <Fragment key={i}>{parte.replace(/\*\*/g, "")}</Fragment>;
      const nome = nomes.get(m[1]!);
      return nome ? <Link key={i} to={`/exercicios/${m[1]}`} className={s.linkExercicio}>{nome}</Link> : null;
    });

  const blocos: ReactNode[] = [];
  let lista: string[] = [];
  const fecharLista = () => {
    if (lista.length) blocos.push(<ul key={`l${blocos.length}`}>{lista.map((l, i) => <li key={i}>{comLinks(l)}</li>)}</ul>);
    lista = [];
  };
  for (const linha of texto.split("\n")) {
    const t = linha.trim();
    if (/^[-•*]\s+/.test(t)) lista.push(t.replace(/^[-•*]\s+/, ""));
    else {
      fecharLista();
      if (t) blocos.push(<p key={`p${blocos.length}`}>{comLinks(t)}</p>);
    }
  }
  fecharLista();
  return <div className={s.resposta}>{blocos}</div>;
}

export function Assistente() {
  const { estado: auth, cliente } = useAuth();
  const { estado } = useDados();
  const dono = auth.status === "logado" ? auth.user.id : null;
  const dados = estado.status === "pronto" ? estado.dados : null;

  const [consentimento, setConsentimento] = useState<Consentimento>({ perfil: false, saude: false });
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [restantes, setRestantes] = useState<number | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  // preferências ficam no aparelho (consentimento) e a conversa só na sessão do navegador
  useEffect(() => {
    if (!dono) return;
    setConsentimento(lerJson(localStorage, chave("consentimento", dono), { perfil: false, saude: false }));
    setMensagens(lerJson(sessionStorage, chave("conversa", dono), []));
  }, [dono]);

  useEffect(() => {
    if (dono) gravarJson(sessionStorage, chave("conversa", dono), mensagens);
    fim.current?.scrollIntoView?.({ block: "end" });
  }, [mensagens, dono]);

  if (auth.status === "desativado") {
    return (
      <>
        <PageHeader titulo="Assistente de IA" />
        <Card>
          <EmptyState icone={<Lock />} titulo="O assistente precisa de uma conta" texto="Ele roda num servidor protegido, com limite de uso por pessoa. Configure o Supabase e entre na sua conta para usar." />
        </Card>
      </>
    );
  }

  function mudarConsentimento(c: Consentimento) {
    // dados de saúde só com o perfil ligado
    const ajustado = { perfil: c.perfil, saude: c.perfil && c.saude };
    setConsentimento(ajustado);
    if (dono) gravarJson(localStorage, chave("consentimento", dono), ajustado);
  }

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || enviando || !cliente) return;
    const historico: Mensagem[] = [...mensagens.filter((m) => !m.erro), { papel: "usuario", texto: limpa.slice(0, MAX) }];
    setMensagens(historico);
    setTexto("");
    setEnviando(true);
    try {
      const { data } = await cliente.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre de novo.");
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mensagens: historico.map(({ papel, texto: t }) => ({ papel, texto: t })),
          contexto: montarContexto(consentimento, dados?.perfilCompleto ?? null, dados?.plano ?? null),
        }),
      });
      const corpo = (await r.json().catch(() => null)) as { texto?: string; exercicios?: Mensagem["exercicios"]; restantes?: number; erro?: string } | null;
      if (!r.ok || !corpo?.texto) throw new Error(corpo?.erro ?? "O assistente não respondeu agora. Tente de novo.");
      setMensagens((m) => [...m, { papel: "assistente", texto: corpo.texto!, exercicios: corpo.exercicios ?? [] }]);
      if (typeof corpo.restantes === "number") setRestantes(corpo.restantes);
    } catch (e) {
      const msg = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Sem conexão. Verifique a internet e tente de novo.";
      setMensagens((m) => [...m, { papel: "assistente", texto: msg, erro: true }]);
    } finally {
      setEnviando(false);
    }
  }

  function submeter(e: FormEvent) {
    e.preventDefault();
    void enviar(texto);
  }

  return (
    <div className={s.pagina}>
      <PageHeader
        titulo="Assistente de IA"
        subtitulo="Tire dúvidas sobre exercícios, técnica e treino."
        acao={mensagens.length ? <Button variante="fantasma" icone={<Trash2 />} onClick={() => setMensagens([])}>Limpar</Button> : undefined}
      />

      <details className={s.privacidade}>
        <summary><ShieldCheck aria-hidden="true" /> Seus dados e privacidade</summary>
        <label className={s.alternar}>
          <input type="checkbox" checked={consentimento.perfil} onChange={(e) => mudarConsentimento({ ...consentimento, perfil: e.target.checked })} disabled={!dados?.perfilCompleto} />
          <span>Usar meu objetivo, nível, rotina, equipamentos e ficha nas respostas</span>
        </label>
        <label className={s.alternar}>
          <input type="checkbox" checked={consentimento.saude} onChange={(e) => mudarConsentimento({ ...consentimento, saude: e.target.checked })} disabled={!consentimento.perfil} />
          <span>Incluir também minhas limitações e o resultado do questionário de saúde</span>
        </label>
        <p className={s.mini}>Nome, e-mail e data de nascimento nunca são enviados. A conversa fica só neste navegador e some ao fechar a aba; o servidor não a guarda.</p>
      </details>

      <div className={s.conversa} aria-live="polite">
        {!mensagens.length && (
          <div className={s.boasVindas}>
            <Bot aria-hidden="true" />
            <p>Pergunte sobre exercícios, técnica, respiração, séries ou alternativas. Eu indico só exercícios da biblioteca do app.</p>
            <div className={s.sugestoes}>
              {SUGESTOES.map((q) => <button key={q} type="button" onClick={() => void enviar(q)}>{q}</button>)}
            </div>
          </div>
        )}
        {mensagens.map((m, i) => (
          <div key={i} className={m.papel === "usuario" ? s.daPessoa : m.erro ? `${s.doAssistente} ${s.comErro}` : s.doAssistente}>
            <span className={s.avatar} aria-hidden="true">{m.papel === "usuario" ? <UserRound /> : <Bot />}</span>
            <div className={s.balao}>
              <span className="sr-only">{m.papel === "usuario" ? "Você:" : "Assistente:"}</span>
              {m.papel === "assistente" && !m.erro ? <Resposta texto={m.texto} exercicios={m.exercicios ?? []} /> : <p>{m.texto}</p>}
            </div>
          </div>
        ))}
        {enviando && (
          <div className={s.doAssistente} role="status">
            <span className={s.avatar} aria-hidden="true"><Bot /></span>
            <div className={`${s.balao} ${s.digitando}`}>Pensando…</div>
          </div>
        )}
        <div ref={fim} />
      </div>

      <form className={s.entrada} onSubmit={submeter}>
        <label className="sr-only" htmlFor="pergunta">Sua pergunta</label>
        <textarea
          id="pergunta"
          rows={2}
          maxLength={MAX}
          placeholder="Escreva sua dúvida…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviar(texto);
            }
          }}
        />
        <Button type="submit" icone={<Send />} disabled={enviando || !texto.trim()} aria-label="Enviar pergunta">Enviar</Button>
      </form>
      <p className={s.mini}>
        {restantes != null ? `${restantes} perguntas restantes hoje. ` : ""}O assistente pode errar e não substitui médico, fisioterapeuta nem profissional de educação física.
      </p>
    </div>
  );
}

import { Copy, Ticket, Trash2, UserRound } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { useAcademia, useCarga } from "@/app/academia";
import { useAuth } from "@/app/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, Card, EmptyState, Opcao } from "@/components/ui";
import { conviteAberto, formatarCodigo, PAPEIS, type Convite } from "@/domain/academia";
import { Carregando, ErroCarga } from "@/features/Estados";
import s from "./Academia.module.css";

/** Academias dependem de conta (Supabase): no modo local a tela explica em vez de simular. */
export function SoComConta({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { estado } = useAuth();
  const { repo } = useAcademia();
  if (estado.status === "desativado" || !repo) {
    return (
      <>
        <PageHeader titulo={titulo} />
        <Card>
          <EmptyState
            icone={<UserRound />}
            titulo="Disponível só com conta"
            texto="Academias, professores e convites ficam guardados na nuvem. Este aparelho está no modo local, sem contas, então esta área não funciona aqui."
          />
        </Card>
      </>
    );
  }
  return <>{children}</>;
}

export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/**
 * Convites de uma academia. Admin vê e cria convites de aluno e professor;
 * professor cria convites de aluno que já vinculam o aluno a ele.
 */
export function BlocoConvites({ academiaId, podeConvidarProfessor, ehProfessor }: { academiaId: string; podeConvidarProfessor: boolean; ehProfessor: boolean }) {
  const { repo } = useAcademia();
  const carregar = useCallback(() => repo!.convites(academiaId), [repo, academiaId]);
  const { estado, recarregar } = useCarga(carregar);
  const [papel, setPapel] = useState<Convite["papel"]>("aluno");
  const [usos, setUsos] = useState(1);
  const [dias, setDias] = useState(7);
  const [vincular, setVincular] = useState(true);
  const [novo, setNovo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function criar() {
    setOcupado(true);
    setErro(null);
    setCopiado(false);
    try {
      // quem é só professor sempre vincula; o admin que também dá aula escolhe
      const codigo = await repo!.criarConvite(academiaId, papel, usos, dias, papel === "aluno" && ehProfessor && vincular);
      setNovo(codigo);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar o convite.");
    } finally {
      setOcupado(false);
    }
  }

  async function revogar(c: Convite) {
    if (!window.confirm(`Revogar o convite ${formatarCodigo(c.codigo)}? Quem ainda não usou não vai conseguir entrar com ele.`)) return;
    setErro(null);
    try {
      await repo!.revogarConvite(c.codigo);
      if (novo === c.codigo) setNovo(null);
      recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível revogar.");
    }
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  const abertos = estado.status === "pronto" ? estado.dados.filter((c) => conviteAberto(c)) : [];

  return (
    <Card titulo="Convites">
      <div className={s.form}>
        <p className={s.texto}>
          Entrar na academia só é possível com um código de convite. Passe o código para a pessoa; ela digita em <b>Academias</b> no app, já com a conta criada.
        </p>
        {podeConvidarProfessor && (
          <div className={s.linha} role="radiogroup" aria-label="Convite para">
            <Opcao name="papel-convite" rotulo="Aluno" checked={papel === "aluno"} onChange={() => setPapel("aluno")} />
            <Opcao name="papel-convite" rotulo="Professor" checked={papel === "professor"} onChange={() => setPapel("professor")} />
          </div>
        )}
        <div className={s.linha}>
          <label className={s.texto}>
            Pode ser usado por{" "}
            <select className={s.select} value={usos} onChange={(e) => setUsos(Number(e.target.value))}>
              {[1, 5, 20, 50].map((n) => <option key={n} value={n}>{n === 1 ? "1 pessoa" : `${n} pessoas`}</option>)}
            </select>
          </label>
          <label className={s.texto}>
            Vale por{" "}
            <select className={s.select} value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              {[1, 7, 30].map((n) => <option key={n} value={n}>{n === 1 ? "1 dia" : `${n} dias`}</option>)}
            </select>
          </label>
        </div>
        {papel === "aluno" && ehProfessor && podeConvidarProfessor && (
          <Opcao tipo="checkbox" rotulo="Os alunos que entrarem ficam comigo como professor" checked={vincular} onChange={(e) => setVincular(e.target.checked)} />
        )}
        <div>
          <Button icone={<Ticket />} onClick={() => void criar()} disabled={ocupado}>{ocupado ? "Criando…" : `Criar convite de ${PAPEIS[papel].toLowerCase()}`}</Button>
        </div>
        {novo && (
          <div className={s.form} aria-live="polite">
            <p className={s.codigoGrande} aria-label={`Código do convite: ${novo.split("").join(" ")}`}>{formatarCodigo(novo)}</p>
            <div className={s.acoes}>
              <Button variante="secundario" icone={<Copy />} onClick={() => void copiar(novo)}>{copiado ? "Copiado" : "Copiar código"}</Button>
            </div>
          </div>
        )}
        {erro && <p className={s.erro} role="alert">{erro}</p>}

        {estado.status === "carregando" && <p className={s.nota}>Carregando convites…</p>}
        {estado.status === "erro" && <ErroCarga mensagem={estado.mensagem} tentar={recarregar} />}
        {estado.status === "pronto" && (
          abertos.length ? (
            <ul className={s.lista} aria-label="Convites abertos">
              {abertos.map((c) => (
                <li key={c.codigo}>
                  <div className={s.info}>
                    <strong className={s.codigo}>{formatarCodigo(c.codigo)}</strong>
                    <span>{PAPEIS[c.papel]} · usado {c.usos} de {c.usosMax} · vale até {dataCurta(c.expiraEm)}</span>
                  </div>
                  <Button variante="fantasma" icone={<Trash2 />} aria-label={`Revogar convite ${formatarCodigo(c.codigo)}`} onClick={() => void revogar(c)}>Revogar</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.nota}>Nenhum convite aberto.</p>
          )
        )}
      </div>
    </Card>
  );
}

export function CargaOuErro<T>({ estado, tentar, children }: { estado: ReturnType<typeof useCarga<T>>["estado"]; tentar: () => void; children: (dados: T) => ReactNode }) {
  if (estado.status === "carregando") return <Carregando />;
  if (estado.status === "erro") return <ErroCarga mensagem={estado.mensagem} tentar={tentar} />;
  return <>{children(estado.dados)}</>;
}

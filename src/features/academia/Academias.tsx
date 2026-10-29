import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useAcademia } from "@/app/academia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, ButtonLink, Campo, Card } from "@/components/ui";
import { normalizarCodigo, PAPEIS } from "@/domain/academia";
import type { Vinculo } from "@/data/academia";
import { Carregando, ErroCarga } from "@/features/Estados";
import { SoComConta } from "./comuns";
import s from "./Academia.module.css";

export function Academias() {
  return (
    <SoComConta titulo="Academias">
      <Conteudo />
    </SoComConta>
  );
}

function Conteudo() {
  const { vinculos, recarregarVinculos } = useAcademia();
  if (vinculos.status === "carregando") return <Carregando />;
  if (vinculos.status === "erro") return <ErroCarga mensagem={vinculos.mensagem} tentar={recarregarVinculos} />;
  const lista = vinculos.lista.filter((v) => v.ativo);

  return (
    <div className={s.pagina}>
      <PageHeader titulo="Academias" subtitulo="Seus vínculos com academias, professores e administração." />
      {lista.length > 0 && (
        <Card titulo="Seus vínculos">
          <ul className={s.lista}>
            {lista.map((v) => <LinhaVinculo key={`${v.academiaId}-${v.papel}`} v={v} />)}
          </ul>
        </Card>
      )}
      <EntrarComCodigo />
      <CriarAcademia />
    </div>
  );
}

function LinhaVinculo({ v }: { v: Vinculo }) {
  const { repo, recarregarVinculos } = useAcademia();
  const [erro, setErro] = useState<string | null>(null);

  async function sair() {
    const aviso =
      v.papel === "aluno"
        ? `Sair de ${v.academiaNome}? Seu professor deixa de ver seu perfil, treinos e medidas. Para voltar, você vai precisar de um novo convite.`
        : `Deixar de ser ${PAPEIS[v.papel].toLowerCase()} em ${v.academiaNome}? Para voltar, você vai precisar de um novo convite.`;
    if (!window.confirm(aviso)) return;
    setErro(null);
    try {
      await repo!.sairDaAcademia(v.academiaId, v.papel);
      recarregarVinculos();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível sair.");
    }
  }

  return (
    <li>
      <div className={s.info}>
        <strong>{v.academiaNome}</strong>
        <span>
          {PAPEIS[v.papel]}
          {v.papel === "aluno" && (v.professorNome ? ` · professor: ${v.professorNome}` : " · ainda sem professor")}
        </span>
        {erro && <span className={s.erro} role="alert">{erro}</span>}
      </div>
      <div className={s.acoes}>
        {v.papel === "professor" && <ButtonLink to="/professor" variante="secundario">Meus alunos</ButtonLink>}
        {v.papel === "admin" && <ButtonLink to={`/gestao/${v.academiaId}`} variante="secundario">Gerenciar</ButtonLink>}
        <Button variante="fantasma" icone={<LogOut />} aria-label={`Sair de ${v.academiaNome} (${PAPEIS[v.papel]})`} onClick={() => void sair()}>Sair</Button>
      </div>
    </li>
  );
}

function EntrarComCodigo() {
  const { repo, recarregarVinculos } = useAcademia();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    const codigo = normalizarCodigo(texto);
    if (!codigo) {
      setErro("O código tem 10 letras e números (de 0 a 9 e de A a F).");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await repo!.aceitarConvite(codigo);
      setOk(`Pronto! Você entrou em ${r.academiaNome} como ${PAPEIS[r.papel].toLowerCase()}.`);
      setTexto("");
      recarregarVinculos();
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não foi possível usar o convite.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card titulo="Entrar com código de convite">
      <form className={s.form} onSubmit={(e) => void enviar(e)} noValidate>
        <div className={s.privacidade}>
          <ShieldCheck aria-hidden="true" />
          <p>
            Como aluno, o professor responsável passa a ver seu perfil (incluindo limitações e o questionário de saúde), suas fichas, treinos e medidas.
            A administração da academia vê só seu nome e os pagamentos registrados. Suas fotos não são compartilhadas com ninguém. Você pode sair quando quiser.
          </p>
        </div>
        <div className={s.linha}>
          <Campo
            rotulo="Código do convite"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={14}
            placeholder="A1B2C-3D4E5"
            erro={erro ?? undefined}
          />
          <Button type="submit" disabled={enviando || !texto.trim()}>{enviando ? "Entrando…" : "Entrar"}</Button>
        </div>
        {ok && <p className={s.ok} role="status">{ok}</p>}
      </form>
    </Card>
  );
}

function CriarAcademia() {
  const { repo, recarregarVinculos } = useAcademia();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpo = nome.trim();
    if (limpo.length < 2 || limpo.length > 120) {
      setErro("Informe o nome da academia (de 2 a 120 caracteres).");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const id = await repo!.criarAcademia(limpo);
      recarregarVinculos();
      navegar(`/gestao/${id}`);
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não foi possível criar a academia.");
      setEnviando(false);
    }
  }

  return (
    <Card titulo="Tem uma academia ou estúdio?">
      {!aberto ? (
        <div className={s.form}>
          <p className={s.texto}>Crie o espaço da sua academia para convidar professores e alunos e registrar mensalidades. Você fica como administrador(a).</p>
          <div><Button variante="secundario" icone={<Building2 />} onClick={() => setAberto(true)}>Criar academia</Button></div>
        </div>
      ) : (
        <form className={s.form} onSubmit={(e) => void enviar(e)} noValidate>
          <Campo rotulo="Nome da academia" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} erro={erro ?? undefined} autoFocus />
          <p className={s.nota}>Como administrador(a), você vê o nome dos membros e os pagamentos, mas não os dados de saúde, fichas ou treinos dos alunos.</p>
          <div className={s.acoes}>
            <Button type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar"}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

import { HardDrive, LogOut, Monitor, Moon, Pencil, ShieldCheck, Sun, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/app/auth";
import { useDados } from "@/app/dados";
import { useTema, type Tema } from "@/app/tema";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge, Button, ButtonLink, Campo, Card } from "@/components/ui";
import { EQUIPAMENTOS, NIVEIS, OBJETIVOS, parqPedeLiberacao, type PerfilCompleto } from "@/domain/tipos";
import { avisarNoLogin } from "@/features/auth/aviso";
import { idade } from "./validacao";
import s from "./Perfil.module.css";

const TEMAS: { valor: Tema; rotulo: string; icone: React.ReactNode }[] = [
  { valor: "sistema", rotulo: "Sistema", icone: <Monitor /> },
  { valor: "claro", rotulo: "Claro", icone: <Sun /> },
  { valor: "escuro", rotulo: "Escuro", icone: <Moon /> },
];

const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function Perfil() {
  const { estado, modo, exemplo, limpar } = useDados();
  const { estado: auth, sair } = useAuth();
  const { tema, setTema } = useTema();
  const local = useLocation();
  const salvo = (local.state as { salvo?: boolean } | null)?.salvo;
  const dados = estado.status === "pronto" ? estado.dados : null;
  const email = auth.status === "logado" ? auth.user.email : null;

  function apagarLocal() {
    if (confirm("Apagar todos os dados salvos neste navegador?")) void limpar();
  }

  return (
    <div className={s.pagina}>
      <PageHeader titulo="Perfil" subtitulo={email ?? undefined} />
      {salvo && <p className={s.ok} role="status">Perfil atualizado.</p>}

      {dados?.perfilCompleto ? (
        <DadosPerfil p={dados.perfilCompleto} />
      ) : (
        <Card titulo="Você">
          {dados?.perfil ? (
            <dl className={s.dados}>
              <div><dt>Nome</dt><dd>{dados.perfil.nome} {exemplo && <Badge tom="alerta">Exemplo</Badge>}</dd></div>
              <div><dt>Objetivo</dt><dd>{OBJETIVOS[dados.perfil.objetivo]}</dd></div>
              <div><dt>Nível</dt><dd>{NIVEIS[dados.perfil.nivel]}</dd></div>
            </dl>
          ) : (
            <p className={s.texto}>Configure o Supabase para criar sua conta e salvar o perfil (veja o README).</p>
          )}
        </Card>
      )}

      <Card titulo="Aparência">
        <div className={s.temas} role="radiogroup" aria-label="Tema">
          {TEMAS.map((t) => (
            <button key={t.valor} type="button" role="radio" aria-checked={tema === t.valor} className={tema === t.valor ? `${s.tema} ${s.ativo}` : s.tema} onClick={() => setTema(t.valor)}>
              {t.icone}
              {t.rotulo}
            </button>
          ))}
        </div>
      </Card>

      {modo === "local" ? (
        <Card titulo="Onde ficam seus dados">
          <p className={s.linha}><HardDrive aria-hidden="true" /> <span><b>Modo local.</b> Tudo fica salvo só neste navegador. Se limpar os dados do navegador ou trocar de aparelho, perde o histórico.</span></p>
          <Button variante="secundario" icone={<Trash2 />} onClick={apagarLocal}>Apagar dados deste navegador</Button>
        </Card>
      ) : (
        <>
          <Card titulo="Conta e privacidade">
            <p className={s.linha}><ShieldCheck aria-hidden="true" className={s.verde} /> <span>Seus dados ficam na sua conta, protegidos por regras de acesso no banco. Só você (e o professor vinculado, se houver) pode vê-los.</span></p>
            <Button variante="secundario" icone={<LogOut />} onClick={() => void sair()}>Sair da conta</Button>
          </Card>
          <ExcluirConta />
        </>
      )}
    </div>
  );
}

function DadosPerfil({ p }: { p: PerfilCompleto }) {
  return (
    <Card titulo="Você" acao={<ButtonLink to="/perfil/editar" variante="fantasma" icone={<Pencil />}>Editar</ButtonLink>}>
      <dl className={s.dados}>
        <div><dt>Nome</dt><dd>{p.nome}</dd></div>
        <div><dt>Idade</dt><dd>{idade(p.dataNascimento, new Date())} anos</dd></div>
        <div><dt>Altura e peso</dt><dd>{fmtNum.format(p.alturaCm)} cm · {fmtNum.format(p.pesoKg)} kg</dd></div>
        <div><dt>Objetivo</dt><dd>{OBJETIVOS[p.objetivo]}</dd></div>
        <div><dt>Nível</dt><dd>{NIVEIS[p.nivel]}</dd></div>
        <div><dt>Rotina</dt><dd>{p.diasSemana}× por semana · {p.minutosSessao} min</dd></div>
        <div><dt>Equipamentos</dt><dd className={s.quebra}>{p.equipamentos.map((e) => EQUIPAMENTOS[e]).join(", ")}</dd></div>
        <div><dt>Limitações</dt><dd className={s.quebra}>{p.limitacoes || "Nenhuma informada"}</dd></div>
      </dl>
      {parqPedeLiberacao(p.parq) && (
        <p className={s.aviso}><TriangleAlert aria-hidden="true" /> Pelas suas respostas no questionário, procure liberação médica antes de treinos intensos.</p>
      )}
    </Card>
  );
}

function ExcluirConta() {
  const { excluirConta } = useDados();
  const navegar = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    setErro(null);
    try {
      // a sessão termina dentro de excluirConta e a rota protegida redireciona sozinha;
      // o aviso vai pela sessionStorage para a tela de entrar mostrar
      avisarNoLogin("Sua conta e todos os seus dados foram excluídos.");
      await excluirConta();
      navegar("/entrar", { replace: true });
    } catch (e) {
      avisarNoLogin(null);
      setErro(e instanceof Error ? e.message : "Não foi possível excluir a conta.");
      setExcluindo(false);
    }
  }

  return (
    <Card titulo="Excluir conta" className={s.perigo}>
      <p className={s.texto}>Apaga sua conta e todos os dados (perfil, treinos, medidas) de forma permanente. Não dá para desfazer.</p>
      {!aberto ? (
        <Button variante="secundario" icone={<Trash2 />} onClick={() => setAberto(true)} className={s.btnPerigo}>Excluir minha conta</Button>
      ) : (
        <div className={s.confirmar}>
          <Campo rotulo='Para confirmar, digite EXCLUIR' value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
          {erro && <p className={s.erro} role="alert">{erro}</p>}
          <div className={s.acoes}>
            <Button variante="secundario" onClick={() => { setAberto(false); setConfirmacao(""); }} disabled={excluindo}>Cancelar</Button>
            <Button onClick={() => void excluir()} disabled={confirmacao.trim().toUpperCase() !== "EXCLUIR" || excluindo} className={s.btnPerigoCheio}>
              {excluindo ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

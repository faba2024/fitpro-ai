import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/app/auth";
import { useDados } from "@/app/dados";
import { Logo } from "@/components/layout/Logo";
import { Button, ProgressBar } from "@/components/ui";
import { CAMPOS_DA_SECAO, SecaoPerfil, TITULO_DA_SECAO, type Secao } from "./SecoesPerfil";
import { FORM_VAZIO, paraPerfil, validarPerfil, type Erros, type FormPerfil } from "./validacao";
import s from "./Onboarding.module.css";

const ETAPAS: Secao[] = ["sobre", "objetivo", "equipamentos", "saude", "consentimento"];
const RASCUNHO = "fitpro:onboarding";

function lerRascunho(): FormPerfil {
  try {
    const r = sessionStorage.getItem(RASCUNHO);
    return r ? { ...FORM_VAZIO, ...(JSON.parse(r) as Partial<FormPerfil>) } : FORM_VAZIO;
  } catch {
    return FORM_VAZIO;
  }
}

/** Cadastro inicial em etapas. O rascunho fica na sessão para não perder nada ao recarregar. */
export function Onboarding() {
  const { estado, salvarPerfil } = useDados();
  const { sair } = useAuth();
  const navegar = useNavigate();
  const [etapa, setEtapa] = useState(0);
  const [form, setForm] = useState<FormPerfil>(lerRascunho);
  const [erros, setErros] = useState<Erros>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(RASCUNHO, JSON.stringify({ ...form, aceitaTermos: false, aceitaSaude: false }));
    } catch {}
  }, [form]);

  useEffect(() => {
    window.scrollTo(0, 0);
    titulo.current?.focus();
  }, [etapa]);

  if (estado.status === "pronto" && estado.dados.perfilCompleto) return <Navigate to="/" replace />;

  const secao = ETAPAS[etapa]!;
  const ultima = etapa === ETAPAS.length - 1;

  function mudar(parcial: Partial<FormPerfil>) {
    setForm((f) => ({ ...f, ...parcial }));
    setErros((e) => {
      const novo = { ...e };
      for (const k of Object.keys(parcial)) delete novo[k as keyof Erros];
      return novo;
    });
  }

  async function avancar(e: FormEvent) {
    e.preventDefault();
    const v = validarPerfil(form, new Date(), CAMPOS_DA_SECAO[secao]);
    setErros(v);
    if (Object.keys(v).length) return;
    if (!ultima) return setEtapa(etapa + 1);

    setEnviando(true);
    setErroEnvio(null);
    try {
      await salvarPerfil(paraPerfil(form, new Date()));
      try {
        sessionStorage.removeItem(RASCUNHO);
      } catch {}
      navegar("/", { replace: true });
    } catch (err) {
      setErroEnvio(err instanceof Error ? err.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={s.tela}>
      <header className={s.topo}>
        <Logo />
        <button type="button" className={s.sair} onClick={() => void sair()}>Sair</button>
      </header>

      <form className={s.card} onSubmit={avancar} noValidate>
        <div className={s.progresso}>
          <span>Etapa {etapa + 1} de {ETAPAS.length}</span>
          <ProgressBar valor={etapa + 1} max={ETAPAS.length} rotulo="Progresso do cadastro" />
        </div>
        <h1 ref={titulo} tabIndex={-1} className={s.titulo}>{TITULO_DA_SECAO[secao]}</h1>

        <SecaoPerfil secao={secao} form={form} erros={erros} mudar={mudar} />

        {erroEnvio && <p className={s.erro} role="alert">{erroEnvio}</p>}

        <div className={s.acoes}>
          {etapa > 0 && (
            <Button variante="secundario" icone={<ArrowLeft />} onClick={() => setEtapa(etapa - 1)} disabled={enviando}>
              Voltar
            </Button>
          )}
          <Button type="submit" icone={ultima ? <Check /> : <ArrowRight />} disabled={enviando} className={s.principal}>
            {ultima ? (enviando ? "Salvando…" : "Concluir cadastro") : "Continuar"}
          </Button>
        </div>
      </form>
    </main>
  );
}

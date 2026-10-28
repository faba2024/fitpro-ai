import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/app/auth";
import { Button, Campo } from "@/components/ui";
import { validarEmail, validarSenha } from "@/features/perfil/validacao";
import { Alerta, AuthLayout } from "./AuthLayout";
import { consumirAvisoLogin } from "./aviso";
import s from "./Auth.module.css";

/** Estado de envio comum aos formulários: evita duplo envio e guarda a mensagem de erro. */
function useEnvio() {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function enviar(acao: () => Promise<void>) {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }
  return { enviando, erro, enviar };
}

/** Quem já está logado não precisa ver as telas de conta. */
function JaLogado() {
  const { estado } = useAuth();
  return estado.status === "logado" || estado.status === "desativado" ? <Navigate to="/" replace /> : null;
}

export function Entrar() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const destino = (local.state as { de?: string } | null)?.de ?? "/";
  const [aviso] = useState(consumirAvisoLogin);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erros, setErros] = useState<{ email?: string; senha?: string }>({});
  const { enviando, erro, enviar } = useEnvio();

  function submeter(e: FormEvent) {
    e.preventDefault();
    const v = { email: validarEmail(email) ?? undefined, senha: senha ? undefined : "Informe sua senha." };
    setErros(v);
    if (v.email || v.senha) return;
    void enviar(async () => {
      await entrar(email, senha);
      navegar(destino, { replace: true });
    });
  }

  return (
    <AuthLayout titulo="Entrar" rodape={<>Ainda não tem conta? <Link to="/criar-conta">Criar conta</Link></>}>
      <JaLogado />
      {aviso && <Alerta tom="sucesso">{aviso}</Alerta>}
      {erro && <Alerta>{erro}</Alerta>}
      <form className={s.form} onSubmit={submeter} noValidate>
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={erros.email} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} erro={erros.senha} />
        <div className={s.linha}><Link to="/recuperar-senha" className={s.link}>Esqueci minha senha</Link></div>
        <Button type="submit" bloco disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</Button>
      </form>
    </AuthLayout>
  );
}

export function CriarConta() {
  const { criarConta } = useAuth();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erros, setErros] = useState<{ email?: string; senha?: string; confirma?: string }>({});
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const { enviando, erro, enviar } = useEnvio();

  function submeter(e: FormEvent) {
    e.preventDefault();
    const v = {
      email: validarEmail(email) ?? undefined,
      senha: validarSenha(senha) ?? undefined,
      confirma: confirma === senha ? undefined : "As senhas não são iguais.",
    };
    setErros(v);
    if (v.email || v.senha || v.confirma) return;
    void enviar(async () => {
      const precisaConfirmar = await criarConta(email, senha);
      if (precisaConfirmar) setConfirmarEmail(true);
      else navegar("/boas-vindas", { replace: true });
    });
  }

  if (confirmarEmail) {
    return (
      <AuthLayout titulo="Confirme seu e-mail" rodape={<Link to="/entrar">Voltar para entrar</Link>}>
        <Alerta tom="sucesso">
          Enviamos um link para <b>{email.trim()}</b>. Abra o e-mail e toque no link para ativar sua conta. Se não chegar em alguns minutos, olhe o spam.
        </Alerta>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Criar conta" subtitulo="Leva menos de 2 minutos." rodape={<>Já tem conta? <Link to="/entrar">Entrar</Link></>}>
      <JaLogado />
      {erro && <Alerta>{erro}</Alerta>}
      <form className={s.form} onSubmit={submeter} noValidate>
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={erros.email} />
        <Campo rotulo="Senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} erro={erros.senha} dica="Mínimo de 8 caracteres, com letras e números." />
        <Campo rotulo="Confirme a senha" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} erro={erros.confirma} />
        <Button type="submit" bloco disabled={enviando}>{enviando ? "Criando…" : "Criar conta"}</Button>
      </form>
    </AuthLayout>
  );
}

export function RecuperarSenha() {
  const { enviarRecuperacao } = useAuth();
  const [email, setEmail] = useState("");
  const [erroEmail, setErroEmail] = useState<string>();
  const [enviado, setEnviado] = useState(false);
  const { enviando, erro, enviar } = useEnvio();

  function submeter(e: FormEvent) {
    e.preventDefault();
    const v = validarEmail(email) ?? undefined;
    setErroEmail(v);
    if (v) return;
    void enviar(async () => {
      await enviarRecuperacao(email);
      setEnviado(true);
    });
  }

  return (
    <AuthLayout titulo="Recuperar senha" subtitulo="Enviaremos um link para você criar uma nova senha." rodape={<Link to="/entrar">Voltar para entrar</Link>}>
      {enviado ? (
        // mesma mensagem exista ou não a conta, para não revelar quais e-mails estão cadastrados
        <Alerta tom="sucesso">Se houver uma conta com <b>{email.trim()}</b>, o link chega em alguns minutos. Olhe também o spam.</Alerta>
      ) : (
        <>
          {erro && <Alerta>{erro}</Alerta>}
          <form className={s.form} onSubmit={submeter} noValidate>
            <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={erroEmail} />
            <Button type="submit" bloco disabled={enviando}>{enviando ? "Enviando…" : "Enviar link"}</Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export function RedefinirSenha() {
  const { estado, redefinirSenha } = useAuth();
  const navegar = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erros, setErros] = useState<{ senha?: string; confirma?: string }>({});
  const { enviando, erro, enviar } = useEnvio();

  if (estado.status === "carregando") return null;
  if (estado.status !== "logado") {
    return (
      <AuthLayout titulo="Link expirado" rodape={<Link to="/entrar">Voltar para entrar</Link>}>
        <Alerta>Este link de redefinição é inválido ou já expirou. Peça um novo.</Alerta>
        <Link to="/recuperar-senha" className={s.link}>Pedir novo link</Link>
      </AuthLayout>
    );
  }

  function submeter(e: FormEvent) {
    e.preventDefault();
    const v = { senha: validarSenha(senha) ?? undefined, confirma: confirma === senha ? undefined : "As senhas não são iguais." };
    setErros(v);
    if (v.senha || v.confirma) return;
    void enviar(async () => {
      await redefinirSenha(senha);
      navegar("/", { replace: true });
    });
  }

  return (
    <AuthLayout titulo="Nova senha">
      {erro && <Alerta>{erro}</Alerta>}
      <form className={s.form} onSubmit={submeter} noValidate>
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} erro={erros.senha} dica="Mínimo de 8 caracteres, com letras e números." />
        <Campo rotulo="Confirme a nova senha" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} erro={erros.confirma} />
        <Button type="submit" bloco disabled={enviando}>{enviando ? "Salvando…" : "Salvar nova senha"}</Button>
      </form>
    </AuthLayout>
  );
}

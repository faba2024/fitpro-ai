import type { AuthError, SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase as clientePadrao } from "@/lib/supabase";

export type EstadoAuth =
  | { status: "desativado" } // sem Supabase configurado: modo local
  | { status: "carregando" }
  | { status: "anonimo" }
  | { status: "logado"; user: User };

interface Ctx {
  estado: EstadoAuth;
  cliente: SupabaseClient | null;
  /** true depois de abrir o link de "redefinir senha" do e-mail */
  recuperacao: boolean;
  entrar(email: string, senha: string): Promise<void>;
  /** Devolve true quando é preciso confirmar o e-mail antes de entrar. */
  criarConta(email: string, senha: string): Promise<boolean>;
  enviarRecuperacao(email: string): Promise<void>;
  redefinirSenha(senha: string): Promise<void>;
  sair(): Promise<void>;
}

export class ErroAuth extends Error {}

/** Mensagens em português para os códigos do Supabase Auth; nunca mostra o erro cru. */
export function mensagemAuth(e: Pick<AuthError, "code" | "message" | "status"> | null): string {
  switch (e?.code) {
    case "invalid_credentials":
      return "E-mail ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.";
    case "weak_password":
      return "Senha fraca. Use pelo menos 8 caracteres, com letras e números.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "email_address_invalid":
      return "Este e-mail não é válido.";
  }
  if (e?.message?.includes("fetch")) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return "Algo deu errado. Tente de novo em instantes.";
}

const desativado: Ctx = {
  estado: { status: "desativado" },
  cliente: null,
  recuperacao: false,
  entrar: async () => {},
  criarConta: async () => false,
  enviarRecuperacao: async () => {},
  redefinirSenha: async () => {},
  sair: async () => {},
};

const AuthCtx = createContext<Ctx>(desativado);

export function AuthProvider({ children, cliente = clientePadrao }: { children: ReactNode; cliente?: SupabaseClient | null }) {
  const [estado, setEstado] = useState<EstadoAuth>(cliente ? { status: "carregando" } : { status: "desativado" });
  const [recuperacao, setRecuperacao] = useState(false);

  useEffect(() => {
    if (!cliente) return;
    let vivo = true;
    cliente.auth.getSession().then(({ data }) => {
      if (vivo) setEstado(data.session ? { status: "logado", user: data.session.user } : { status: "anonimo" });
    });
    const { data } = cliente.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperacao(true);
      // mantém o mesmo objeto quando só o token renovou, para não recarregar os dados à toa
      setEstado((atual) =>
        sessao
          ? atual.status === "logado" && atual.user.id === sessao.user.id
            ? atual
            : { status: "logado", user: sessao.user }
          : { status: "anonimo" },
      );
    });
    return () => {
      vivo = false;
      data.subscription.unsubscribe();
    };
  }, [cliente]);

  const valor = useMemo<Ctx>(() => {
    if (!cliente) return desativado;
    const origem = window.location.origin;
    const exigir = (error: AuthError | null) => {
      if (error) throw new ErroAuth(mensagemAuth(error));
    };
    return {
      estado,
      cliente,
      recuperacao,
      async entrar(email, senha) {
        const { error } = await cliente.auth.signInWithPassword({ email: email.trim(), password: senha });
        exigir(error);
      },
      async criarConta(email, senha) {
        const { data, error } = await cliente.auth.signUp({ email: email.trim(), password: senha, options: { emailRedirectTo: `${origem}/` } });
        exigir(error);
        return !data.session;
      },
      async enviarRecuperacao(email) {
        const { error } = await cliente.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origem}/redefinir-senha` });
        exigir(error);
      },
      async redefinirSenha(senha) {
        const { error } = await cliente.auth.updateUser({ password: senha });
        exigir(error);
        setRecuperacao(false);
      },
      async sair() {
        await cliente.auth.signOut();
      },
    };
  }, [cliente, estado, recuperacao]);

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

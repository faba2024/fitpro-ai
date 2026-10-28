import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { Carregando, ErroCarga } from "@/features/Estados";
import { useAuth } from "./auth";
import { useDados } from "./dados";

/**
 * Protege as telas do app:
 * - modo local (sem Supabase): libera, avisando na interface;
 * - sem login: manda para /entrar e volta depois;
 * - logado sem perfil: manda para o cadastro inicial (/boas-vindas).
 */
export function Protegido({ children, exigePerfil = true }: { children: ReactNode; exigePerfil?: boolean }) {
  const { estado: auth } = useAuth();
  const { estado, recarregar } = useDados();
  const local = useLocation();

  if (auth.status === "desativado") return <>{children}</>;
  if (auth.status === "carregando") return <Carregando />;
  if (auth.status === "anonimo") return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;

  if (estado.status === "carregando") return <Carregando />;
  if (estado.status === "erro") return <ErroCarga mensagem={estado.mensagem} tentar={recarregar} />;
  if (exigePerfil && !estado.dados.perfilCompleto) return <Navigate to="/boas-vindas" replace />;
  return <>{children}</>;
}

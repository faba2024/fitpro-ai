import { Activity, Bot, Dumbbell, House, PersonStanding, User } from "lucide-react";
import type { RouteObject } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { CriarConta, Entrar, RecuperarSenha, RedefinirSenha } from "@/features/auth/paginas";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { EmConstrucao } from "@/features/EmConstrucao";
import { NaoEncontrada } from "@/features/NaoEncontrada";
import { EditarPerfil } from "@/features/perfil/EditarPerfil";
import { Onboarding } from "@/features/perfil/Onboarding";
import { Perfil } from "@/features/perfil/Perfil";
import { PlanoSemanal } from "@/features/treinos/PlanoSemanal";
import { Protegido } from "./Protegido";

export const NAV = [
  { para: "/", rotulo: "Início", icone: House },
  { para: "/treino", rotulo: "Treino", icone: Dumbbell },
  { para: "/exercicios", rotulo: "Exercícios", icone: Activity },
  { para: "/evolucao", rotulo: "Evolução", icone: PersonStanding },
  { para: "/perfil", rotulo: "Perfil", icone: User },
] as const;

export const NAV_EXTRA = [{ para: "/assistente", rotulo: "Assistente IA", icone: Bot }] as const;

export const rotas: RouteObject[] = [
  // contas (públicas)
  { path: "entrar", element: <Entrar /> },
  { path: "criar-conta", element: <CriarConta /> },
  { path: "recuperar-senha", element: <RecuperarSenha /> },
  { path: "redefinir-senha", element: <RedefinirSenha /> },
  {
    path: "boas-vindas",
    element: (
      <Protegido exigePerfil={false}>
        <Onboarding />
      </Protegido>
    ),
  },
  // app (exige login e perfil quando há Supabase)
  {
    element: (
      <Protegido>
        <AppShell />
      </Protegido>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "treino", element: <PlanoSemanal /> },
      {
        path: "treino/sessao",
        element: <EmConstrucao titulo="Modo treino" etapa={8} texto="Registro de carga e repetições por série, cronômetro de descanso, salvamento automático e retomada da sessão." />,
      },
      {
        path: "exercicios",
        element: <EmConstrucao titulo="Exercícios" etapa={5} texto="Biblioteca com fotos, músculos trabalhados, passo a passo, erros comuns e alternativas." />,
      },
      {
        path: "anatomia",
        element: <EmConstrucao titulo="Mapa muscular" etapa={6} texto="Corpo humano de frente e de costas com músculos clicáveis e os exercícios de cada região." />,
      },
      {
        path: "evolucao",
        element: <EmConstrucao titulo="Evolução" etapa={9} texto="Gráficos de peso, medidas, cargas, volume de treino e recordes pessoais." />,
      },
      {
        path: "assistente",
        element: <EmConstrucao titulo="Assistente de IA" etapa={10} texto="Tire dúvidas sobre exercícios e encontre alternativas na biblioteca, com limites claros para questões de saúde." />,
      },
      { path: "perfil", element: <Perfil /> },
      { path: "perfil/editar", element: <EditarPerfil /> },
      { path: "*", element: <NaoEncontrada /> },
    ],
  },
];

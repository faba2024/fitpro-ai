import { Activity, Bot, Dumbbell, House, PersonStanding, Scan, User } from "lucide-react";
import type { RouteObject } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { CriarConta, Entrar, RecuperarSenha, RedefinirSenha } from "@/features/auth/paginas";
import { Dashboard } from "@/features/dashboard/Dashboard";
import { Carregando } from "@/features/Estados";
import { lazy, Suspense, type ReactNode } from "react";

// telas pesadas (catálogo de exercícios) em arquivos separados, carregados ao abrir
const Biblioteca = lazy(() => import("@/features/exercicios/Biblioteca").then((m) => ({ default: m.Biblioteca })));
const Detalhe = lazy(() => import("@/features/exercicios/Detalhe").then((m) => ({ default: m.Detalhe })));
const PlanoSemanal = lazy(() => import("@/features/treinos/PlanoSemanal").then((m) => ({ default: m.PlanoSemanal })));
const CriarTreino = lazy(() => import("@/features/treinos/CriarTreino").then((m) => ({ default: m.CriarTreino })));
const EditarFicha = lazy(() => import("@/features/treinos/EditarFicha").then((m) => ({ default: m.EditarFicha })));
const ModoTreino = lazy(() => import("@/features/sessao/ModoTreino").then((m) => ({ default: m.ModoTreino })));
const Resumo = lazy(() => import("@/features/sessao/Resumo").then((m) => ({ default: m.Resumo })));
const Evolucao = lazy(() => import("@/features/evolucao/Evolucao").then((m) => ({ default: m.Evolucao })));
const Assistente = lazy(() => import("@/features/assistente/Assistente").then((m) => ({ default: m.Assistente })));
const Anatomia = lazy(() => import("@/features/anatomia/Anatomia").then((m) => ({ default: m.Anatomia })));
const sob = (el: ReactNode) => <Suspense fallback={<Carregando />}>{el}</Suspense>;
import { NaoEncontrada } from "@/features/NaoEncontrada";
import { EditarPerfil } from "@/features/perfil/EditarPerfil";
import { Onboarding } from "@/features/perfil/Onboarding";
import { Perfil } from "@/features/perfil/Perfil";
import { Protegido } from "./Protegido";

export const NAV = [
  { para: "/", rotulo: "Início", icone: House },
  { para: "/treino", rotulo: "Treino", icone: Dumbbell },
  { para: "/exercicios", rotulo: "Exercícios", icone: Activity },
  { para: "/evolucao", rotulo: "Evolução", icone: PersonStanding },
  { para: "/perfil", rotulo: "Perfil", icone: User },
] as const;

export const NAV_EXTRA = [
  { para: "/anatomia", rotulo: "Mapa muscular", icone: Scan },
  { para: "/assistente", rotulo: "Assistente IA", icone: Bot },
] as const;

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
      { path: "treino", element: sob(<PlanoSemanal />) },
      { path: "treino/novo", element: sob(<CriarTreino />) },
      { path: "treino/editar", element: sob(<EditarFicha />) },
      { path: "treino/sessao", element: sob(<ModoTreino />) },
      { path: "treino/resumo", element: sob(<Resumo />) },
      { path: "exercicios", element: sob(<Biblioteca />) },
      { path: "exercicios/:id", element: sob(<Detalhe />) },
      { path: "anatomia", element: sob(<Anatomia />) },
      { path: "evolucao", element: sob(<Evolucao />) },
      { path: "assistente", element: sob(<Assistente />) },
      { path: "perfil", element: <Perfil /> },
      { path: "perfil/editar", element: <EditarPerfil /> },
      { path: "*", element: <NaoEncontrada /> },
    ],
  },
];

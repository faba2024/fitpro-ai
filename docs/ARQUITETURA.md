# FitPro AI — Arquitetura e plano técnico

Documento vivo. Atualize a cada etapa concluída.

## 1. Arquitetura

```
┌──────────────────────────── Navegador / PWA ────────────────────────────┐
│ React + TypeScript (Vite)                                               │
│                                                                         │
│  páginas (features/*)  →  domínio (regras puras, testadas)              │
│          │                                                              │
│          └──────────→  data/repositorio.ts  (interface única)           │
│                              │                     │                    │
│                       LocalRepositorio       SupabaseRepositorio        │
│                       (modo local/exemplo)   (etapa 4 em diante)        │
└──────────────────────────────┬──────────────────────┬───────────────────┘
                               │                      │
                    ┌──────────▼─────────┐   ┌────────▼──────────────────┐
                    │ Vercel Functions   │   │ Supabase                  │
                    │ /api/assistente    │   │ Auth · Postgres + RLS     │
                    │ (chave da IA aqui) │   │ Storage privado (fotos)   │
                    └──────────┬─────────┘   └───────────────────────────┘
                               │
                         API da Anthropic
```

Princípios:

- **Interface, regras e dados separados.** Componentes não falam com o banco; chamam o repositório. Regras de treino (resumo semanal, progressão, volume) ficam em `src/domain`, funções puras com teste.
- **Um repositório, duas implementações.** Sem Supabase configurado, o app roda em *modo local* (dados só no navegador) e mostra isso na tela. Nada é apresentado como sincronizado se não for.
- **Segredos só no servidor.** O frontend recebe apenas a URL e a chave pública (anon) do Supabase. A chave da IA fica na função `/api/assistente`.
- **Permissões no banco.** Aluno, professor e administrador são papéis em `membros_academia`; o acesso é garantido por RLS, não só pela interface.
- **Motor de treinos determinístico.** Fichas e progressão seguem regras explícitas e explicáveis (ver etapa 7). A IA explica e sugere; não prescreve.

Stack escolhida (conforme sugerido):

| Necessidade | Escolha | Motivo |
| --- | --- | --- |
| UI | React 19 + TypeScript + Vite | pedido no escopo; build rápido |
| Rotas | React Router 7 | padrão de mercado, rotas aninhadas e protegidas |
| Estilo | CSS Modules + tokens CSS | sem dependência extra; tema claro/escuro por variáveis |
| Ícones | lucide-react | consistentes, importação por ícone |
| Gráficos (etapa 9) | Recharts | maduro, responsivo; avaliar peso antes de instalar |
| 3D (etapa 6, opcional) | three.js + @react-three/fiber | só se houver modelo com licença adequada |
| Backend | Supabase (Auth, Postgres, Storage) | RLS resolve as permissões por papel |
| IA | Vercel Function + SDK da Anthropic | chave fora do frontend, limite de uso |
| PWA | vite-plugin-pwa | manifest + service worker gerados |
| Testes | Vitest + Testing Library; Playwright (E2E) | mesmo pipeline do Vite |

## 2. Estrutura de pastas

```
fitpro-ai/
├─ api/                      # Vercel Functions (etapa 10): assistente.ts
├─ docs/                     # este documento, decisões
├─ public/                   # ícones do PWA
├─ supabase/
│  └─ migrations/            # SQL versionado (etapa 4)
└─ src/
   ├─ app/                   # App, rotas, providers (tema, repositório)
   ├─ components/
   │  ├─ ui/                 # Button, Card, Badge, ProgressBar, EmptyState…
   │  └─ layout/             # AppShell, BottomNav, SideNav, PageHeader
   ├─ domain/                # tipos e regras puras (+ testes)
   ├─ data/                  # repositorio.ts, local/, supabase/, exemplo.ts
   ├─ features/
   │  ├─ dashboard/
   │  ├─ auth/               # etapa 4
   │  ├─ perfil/
   │  ├─ exercicios/         # etapa 5
   │  ├─ anatomia/           # etapa 6
   │  ├─ treinos/            # etapa 7 (motor + editor de fichas)
   │  ├─ sessao/             # etapa 8 (modo treino)
   │  ├─ evolucao/           # etapa 9
   │  ├─ assistente/         # etapa 10
   │  ├─ professor/          # etapa 11
   │  └─ academia/           # etapa 11 (admin)
   ├─ lib/                   # datas, formatação, storage seguro
   ├─ styles/                # tokens.css, global.css
   └─ test/                  # setup do Vitest
```

## 3. Telas e navegação

Navegação principal (barra inferior no celular, lateral no computador):
**Início · Treino · Exercícios · Evolução · Perfil**. Assistente de IA abre por atalho no Início e no detalhe do exercício.

```
Entrar / Criar conta / Recuperar senha
        │
        ▼
Onboarding (objetivo, nível, dias, duração, equipamentos, limitações, consentimento)
        │
        ▼
Início ──► Iniciar treino ──► Modo treino ──► Resumo do treino
  │  └──► Plano semanal ──► Editar ficha / Trocar exercício
  ├──► Exercícios ──► Detalhe do exercício (alternativas, favoritar)
  │        └──► Mapa muscular (frente/costas) ──► exercícios do músculo
  ├──► Evolução (peso, medidas, fotos, cargas, recordes, períodos)
  ├──► Assistente de IA
  └──► Perfil ──► Dados, objetivos, preferências, histórico,
                  lembretes, privacidade, excluir conta

Professor:  Meus alunos ──► Aluno ──► Fichas (criar/revisar) · Evolução
Admin:      Alunos · Professores · Planos e assinaturas · Pagamentos · Relatórios
```

Cada tela terá estados de carregando, vazio, erro e sucesso.

## 4. Modelo inicial do banco (Postgres/Supabase)

Tabelas pessoais têm `user_id` = `auth.uid()` e RLS "dono lê e escreve".

| Tabela | Campos principais |
| --- | --- |
| `perfis` | `id` (= auth.users), nome, data_nascimento, altura_cm, objetivo (enum: hipertrofia, emagrecimento, forca, condicionamento, saude), nivel (iniciante, intermediario, avancado), dias_semana, minutos_sessao, equipamentos text[], limitacoes text, consentimento_em, criado_em |
| `academias` | id, nome, slug, criado_em |
| `membros_academia` | academia_id, user_id, papel (aluno, professor, admin), professor_id (do aluno), ativo |
| `musculos` | id (slug), nome, grupo, vista (frente/costas) |
| `exercicios` | id, slug, nome, descricao, instrucoes text[], respiracao, erros_comuns text[], seguranca, dificuldade, equipamentos text[], midia_url, licenca_midia, academia_id (null = biblioteca global) |
| `exercicio_musculos` | exercicio_id, musculo_id, papel (principal/secundario) |
| `exercicio_alternativas` | exercicio_id, alternativa_id, motivo |
| `planos` | id, aluno_id, criado_por, academia_id, nome, objetivo, origem (motor/professor), ativo, revisado_por, revisado_em |
| `plano_sessoes` | id, plano_id, ordem, nome ("A"), titulo ("Peito e tríceps") |
| `plano_itens` | id, sessao_id, exercicio_id, ordem, series, reps_min, reps_max, descanso_s, carga_sugerida_kg, observacao |
| `sessoes` | id, user_id, plano_sessao_id, status (em_andamento, concluida, abandonada), iniciada_em, finalizada_em, notas |
| `series` | id, sessao_id, exercicio_id, ordem, carga_kg, reps, concluida_em |
| `medidas` | id, user_id, data, peso_kg, gordura_pct, cintura_cm, quadril_cm, braco_cm, coxa_cm, foto_path |
| `favoritos` | user_id, exercicio_id |
| `lembretes` | id, user_id, tipo, dias, horario, ativo |
| `assinaturas` / `pagamentos` | etapa 11 (plano, valor, vencimento, status) |

Visões: `recordes_pessoais` (maior carga e maior volume por exercício), `volume_semanal`.

RLS por papel:
- **aluno**: só os próprios dados.
- **professor**: lê perfil/sessões/medidas e escreve `planos` apenas de alunos vinculados a ele na mesma academia.
- **admin**: gerencia membros, planos e pagamentos da própria academia; não lê fotos nem limitações de saúde dos alunos.

## 5. Riscos técnicos e decisões

| # | Risco | Proposta | Decisão necessária |
| --- | --- | --- | --- |
| 1 | **Imagens/vídeos de exercícios** precisam de licença | Usar o acervo *free-exercise-db* (domínio público/Unlicense, ~800 exercícios com fotos) e traduzir os textos; vídeos próprios depois | ✅ aprovado |
| 2 | **Anatomia 3D**: modelos com músculos separados e licença livre são raros e pesados | Começar com mapa 2D em SVG próprio (frente/costas, regiões clicáveis); 3D vira melhoria opcional | ✅ aprovado: 2D primeiro |
| 3 | **Dados de saúde (LGPD, dado sensível)**: limitações, medidas, fotos | Consentimento explícito, fotos em bucket privado, exclusão de conta real, admin sem acesso a dados de saúde | — |
| 4 | **Segurança do treino** | Questionário de prontidão (PAR-Q) no cadastro; se houver resposta "sim", recomendar liberação médica; carga inicial por teste de repetições, nunca por idade/peso | — |
| 5 | **Custo e abuso da IA** | Função no servidor, limite por usuário, respostas só com dados autorizados | Chave da Anthropic |
| 6 | **Perda de sessão de treino** | Salvar cada série localmente na hora e sincronizar; retomar sessão ao reabrir | — |
| 7 | **Supabase** | Projeto novo, plano gratuito para começar | ✅ projeto fitpro-ai (sa-east-1, plano gratuito) |
| 8 | **Escopo grande** | Entregar por etapas, cada uma testada e publicada | — |

## 6. Plano de testes

- **Unitários (Vitest)**: regras do domínio — resumo semanal, sequência de dias, treino do dia, progressão de carga, limites de volume, cronômetro, formatação.
- **Componentes (Testing Library)**: estados vazio/erro/carregando, navegação por teclado, formulários com validação.
- **Integração**: repositório local e Supabase contra um banco de teste; políticas RLS testadas com usuários de cada papel (aluno não lê dados de outro aluno, professor só vê os seus).
- **E2E (Playwright, etapa 12)**: cadastro → onboarding → iniciar treino → registrar séries → fechar a aba → retomar → concluir → ver evolução.
- **Manuais**: celular real (Android e iPhone), instalação PWA, modo escuro, leitor de tela.
- `npm test` e `npm run build` precisam passar antes de cada publicação.

## Decisões da etapa 4

- Idade mínima de 18 anos por enquanto (dados de saúde de menores exigem consentimento dos responsáveis pela LGPD).
- Senha: mínimo de 8 caracteres com letras e números.
- Admin da academia não lê perfis (dados de saúde); professor lê só os alunos vinculados a ele.
- Funções de permissão ficam no schema `privado`, fora da API pública.

## Decisões da etapa 5

- O catálogo global fica versionado no código (`src/data/catalogo.ts`), com ids estáveis: funciona offline, sem latência e com teste automático de integridade. No banco ficam só os favoritos (`favoritos.exercicio_id`). Exercícios próprios de academias terão tabela na etapa 11.
- Fotos do acervo free-exercise-db (The Unlicense) servidas pelo jsDelivr, presas ao commit `f00c92c`. Os textos são próprios, em português, não traduções literais.
- Prescrição padrão por objetivo e tipo de exercício (faixas usuais do treinamento resistido); iniciante faz uma série a menos. A carga é escolhida pela técnica e pelo esforço (1 a 3 repetições de sobra), nunca por idade ou peso.

## Estado das etapas

| Etapa | Status |
| --- | --- |
| 1. Planejamento e estrutura | ✅ |
| 2. Identidade visual e componentes | ✅ v1 |
| 3. Navegação e dashboard | ✅ v1 (modo local) — 29 testes passando |
| 4. Cadastro e perfil (Supabase) | ✅ login, cadastro, recuperação de senha, onboarding com PAR-Q e consentimento LGPD, perfil editável, exclusão de conta; RLS testada (supabase/tests) |
| 5. Biblioteca de exercícios | ✅ 51 exercícios em português (passo a passo, respiração, técnica, erros, segurança, alternativas), busca e filtros, prescrição por objetivo/nível, favoritos (Supabase + local) |
| 6–12 | pendente |

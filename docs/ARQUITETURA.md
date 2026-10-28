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

## Decisões da etapa 6

- Mapa 2D desenhado no próprio código (`src/features/anatomia/regioes.ts`): sem dependência nem licença de terceiros, leve e com tema claro/escuro. Cada forma é descrita só do lado direito e espelhada.
- Os 16 músculos do mapa são os mesmos do catálogo (`MUSCULOS`), então a lista de exercícios por músculo vem direto das fichas técnicas.
- 3D (three.js) continua como melhoria opcional, caso surja um modelo com músculos separados e licença adequada.

## Decisões da etapa 7

- **Motor determinístico** (`src/domain/motor.ts`), sem IA. Testado em 189 combinações de dias × nível × objetivo × equipamento.
- **Divisão:** 1 dia corpo inteiro; 2 dias corpo inteiro A/B; 3 dias corpo inteiro A/B/C (iniciante, saúde, condicionamento, emagrecimento) ou empurrar/puxar/pernas; 4 dias superiores/inferiores; 5 dias PPL + superiores/inferiores; 6 dias PPL 2×. Máximo de 6 treinos (1 dia de descanso) e de **4 para iniciantes**.
- **Escolha de exercícios:** vagas por músculo em ordem de prioridade; só exercícios possíveis com o equipamento e no nível; preferências explícitas (ex.: stiff antes do terra, face pull para posterior de ombro); exercícios já usados no plano vão para o fim da fila (variedade entre treinos). O tempo disponível corta as últimas vagas (mín. 3, máx. 8 exercícios).
- **Volume semanal por grupo:** séries do grupo principal contam 1 e de grupos só secundários 0,5. Limites: iniciante 4–12, intermediário 6–18, avançado 8–22. O excesso é cortado automaticamente; abdômen fica fora do limite. Mesmo grupo com 9+ séries em treinos seguidos gera aviso de recuperação.
- **Modo conservador** (PAR-Q com "sim" ou limitações informadas): uma série a menos, nada avançado, recomendação de revisão profissional.
- **Carga inicial** fica em branco para a pessoa definir pela técnica (1 a 3 repetições de sobra). **Progressão** por dupla progressão (`progressao.ts`), usada no modo treino.
- **Banco:** `planos.estrutura` em jsonb (salva a ficha inteira de forma atômica). Uma ficha ativa por aluno; só o professor do aluno marca "revisada"; edição do aluno desfaz a revisão (gatilho no banco). Admin não lê fichas.

## Decisões da etapa 8

- **Estado da sessão em funções puras** (`src/domain/sessao.ts`) com o tempo como parâmetro: o cronômetro e o descanso usam horários absolutos, então sobrevivem a recarregar a página e a pausas.
- **Aparelho primeiro:** cada toque grava o treino em `localStorage` (por conta: `fitpro:treino-ativo:<id>`) antes de qualquer rede. A sincronização com o Supabase acontece em seguida (1,5 s depois da última mudança) por **upsert com ids gerados no aparelho**, então reenviar não duplica. Séries desfeitas são apagadas do banco na sincronização seguinte.
- **Fila offline:** ao concluir, o treino entra numa fila (`fitpro:sync-pendente:<id>`) e só sai dela depois que o banco confirma; a fila é reenviada ao abrir o app e quando a conexão volta. A tela mostra o estado ("salvo no aparelho", "enviando", "salvo na sua conta", "sem conexão").
- **Banco:** `sessoes` (resumo do treino) e `series` (cada série), com gatilho que impede série em sessão de outra pessoa; professor do aluno só lê; admin não lê. `recordes(text[])` (security invoker) devolve a maior carga por exercício.
- **Sugestão de carga** no início de cada exercício vem do último treino daquele exercício pela dupla progressão; o resumo mostra recordes (só quando havia histórico) e a sugestão para a próxima vez.
- Tela ligada durante o treino com Wake Lock quando o navegador permite; fim do descanso avisa com vibração e um bipe curto.

## Decisões da etapa 9

- **Regras puras** em `src/domain/evolucao.ts`: intervalos de período (30/90/365 dias e tudo), comparação com o período anterior de mesmo tamanho, séries semanais, séries de medidas e progresso de carga por exercício. Datas "AAAA-MM-DD" são lidas como data local, para não mudar de dia por causa do fuso.
- **Variação de peso** usa como referência o último peso **antes** do período (ou o primeiro dentro dele) e compara com o último registro do período.
- **Gráficos próprios em SVG** (`src/components/graficos`), sem biblioteca: menos peso no app. Seguem o guia de visualização: uma série por gráfico (o título nomeia, sem legenda), linha de 2 px, barras com topo arredondado e 2 px de folga, grade discreta, meta como linha cinza tracejada, eixo único, dica ao tocar/passar o mouse, navegação por teclado (setas, Home/End, Esc) e tabela de dados. A cor de destaque passou no validador de paleta nos modos claro e escuro.
- **Medidas:** tabela `medidas`, um registro por pessoa e dia (salvar de novo na mesma data atualiza); exige ao menos um valor e faixas plausíveis. Sem medidas registradas, o peso do cadastro aparece como primeiro ponto, marcado "do cadastro". Meta de peso opcional em `perfis.meta_peso_kg`.
- **Fotos:** bucket privado `fotos-evolucao` (até 5 MB, só imagens), uma pasta por usuário; tabela `fotos` com o caminho, que precisa estar na pasta do próprio usuário. **Só o dono vê** (nem o professor), com URL assinada de 1 hora. A foto é reduzida no aparelho (lado máx. 1600 px, JPEG), o que também remove os metadados da câmera.
- **Excluir conta** apaga primeiro os arquivos do Storage (que não somem junto com o usuário) e depois a conta.
- **Testes de RLS** em `supabase/tests/rls_evolucao.sql` (15 verificações). O Supabase bloqueia `DELETE` direto em `storage.objects`, então "apagar arquivo de outra pessoa" só é coberto pela policy de delete usada pela API de Storage.

## Decisões da etapa 10

- **Função no servidor** `api/assistente.ts` (Vercel Function, `POST`). A chave `ANTHROPIC_API_KEY` só existe ali; o app nunca a recebe. Sem a chave configurada, a função responde 503 com mensagem clara (nada é simulado).
- **Login obrigatório:** a função valida o token do Supabase e cria um cliente agindo como a própria pessoa (RLS vale). **Limite de 30 perguntas por dia** por pessoa em `assistente_uso`, somado só pela função `consumir_cota_assistente()` (security definer: ninguém zera o próprio contador). A pergunta é validada antes de gastar cota.
- **Núcleo testável** em `api/_lib/assistente.ts` (cliente da API injetado; testes usam um falso). Modelo `claude-opus-5-5`, esforço baixo, com modelo de reserva automático em recusas do filtro de segurança.
- **Sem invenção:** o modelo consulta a biblioteca com as ferramentas `buscar_exercicios` e `detalhar_exercicio` (executadas no servidor sobre o mesmo catálogo do app) e cita exercícios como `[[id]]`; o servidor remove ids que não existem, e o app só faz link para os conferidos. A conversa inteira (inclusive raciocínio) volta a cada chamada da ferramenta, como a API exige; no máximo 5 voltas.
- **Consentimento:** compartilhar perfil e ficha é opcional e começa desligado; limitações e PAR-Q exigem uma segunda autorização. Nome, e-mail e data de nascimento nunca são enviados. O servidor descarta campos inesperados e trata as limitações escritas pela pessoa como dado delimitado, não como instrução.
- **Privacidade da conversa:** fica só no `sessionStorage` do navegador; o servidor não grava mensagens (só a contagem diária).
- **Limites de saúde** nas instruções: sem diagnóstico, exames, remédios, suplementos ou doses; sinais de alerta (dor no peito, falta de ar, desmaio, tontura forte, dor aguda) → parar e procurar atendimento.
- **Testar localmente:** `npx vercel dev` (o `vite dev` sozinho não roda as funções de `api/`).

## Estado das etapas

| Etapa | Status |
| --- | --- |
| 1. Planejamento e estrutura | ✅ |
| 2. Identidade visual e componentes | ✅ v1 |
| 3. Navegação e dashboard | ✅ v1 (modo local) — 29 testes passando |
| 4. Cadastro e perfil (Supabase) | ✅ login, cadastro, recuperação de senha, onboarding com PAR-Q e consentimento LGPD, perfil editável, exclusão de conta; RLS testada (supabase/tests) |
| 5. Biblioteca de exercícios | ✅ 51 exercícios em português (passo a passo, respiração, técnica, erros, segurança, alternativas), busca e filtros, prescrição por objetivo/nível, favoritos (Supabase + local) |
| 6. Anatomia interativa | ✅ mapa 2D próprio (SVG) frente/costas com 16 músculos clicáveis e acessíveis por teclado, exercícios principais/secundários por músculo com filtros, mapa no detalhe do exercício |
| 7. Motor de treinos | ✅ divisão por dias, escolha por equipamento/nível, ajuste ao tempo, controle de volume e recuperação, edição (trocar, reordenar, adicionar), regra de progressão testada, revisão profissional no banco |
| 8. Modo treino | ✅ registro de carga/reps por série, cronômetro de descanso, pausa, trocar/pular/adicionar série, salvamento a cada toque no aparelho, retomada após fechar, sincronização idempotente com fila offline, resumo com recordes e sugestão de carga, histórico no exercício |
| 9. Evolução física | ✅ comparação por período, gráficos acessíveis (peso com meta, frequência, volume, carga por exercício, medidas), medidas corporais, meta de peso, recordes, fotos privadas com comparação; 169 testes |
| 10. Assistente de IA | ✅ função segura na Vercel, login e limite diário, ferramentas sobre a biblioteca (sem inventar exercícios), consentimento separado para perfil e saúde, conversa só no navegador; 195 testes. Falta cadastrar `ANTHROPIC_API_KEY` na Vercel |
| 11–12 | pendente |

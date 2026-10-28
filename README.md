# FitPro AI

Aplicativo de treino (PWA) com dashboard, fichas, biblioteca de exercícios, mapa muscular, modo treino, evolução e assistente de IA. Desenvolvido por etapas; veja o plano e o estado de cada etapa em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## O que já funciona (v0.7)

**Etapa 9 — evolução física:**
- Comparação por período (30 dias, 90 dias, 12 meses, tudo) com o período anterior: treinos, volume, treinos por semana e variação de peso.
- Gráficos acessíveis (dica ao tocar, teclado e tabela de dados): peso com meta, frequência e volume semanais, maior carga por exercício e medidas corporais.
- Registro de medidas (um por dia), meta de peso e recordes pessoais.
- Fotos de evolução privadas (só a própria pessoa vê), reduzidas no aparelho e comparáveis lado a lado. Banco: `medidas`, `fotos` e bucket `fotos-evolucao`, com RLS testada em `supabase/tests/rls_evolucao.sql`.

**Etapa 8 — modo treino:**
- Escolha do treino, exercícios na ordem da ficha, registro de carga e repetições por série com sugestão de carga do último treino.
- Cronômetro de descanso (±15 s, pular), pausa, trocar exercício, pular, adicionar e remover série.
- Salva a cada toque no aparelho e retoma depois de fechar ou recarregar; sincroniza com a conta e guarda numa fila quando está sem internet.
- Resumo com duração, séries, volume, recordes e o que fazer na próxima vez; histórico de cada exercício na biblioteca.
- Banco: `sessoes` e `series` com RLS testada (`supabase/tests/rls_sessoes.sql`).

**Etapa 7 — criador de treinos:**
- Monta a ficha a partir do perfil (objetivo, nível, dias, tempo, equipamentos), com prévia ao vivo, explicação da divisão e tabela de volume semanal por grupo.
- Avisos de volume alto, recuperação (mesmo grupo em treinos seguidos), treino longo demais e exercício repetido.
- Edição: séries, repetições, descanso, carga inicial, trocar por alternativas, reordenar, remover e adicionar.
- Selo de origem e revisão profissional (fichas em `planos`, RLS testada em `supabase/tests/rls_planos.sql`).

**Etapa 6 — mapa muscular:**
- Corpo de frente e de costas com 16 músculos clicáveis (também pelo teclado e por uma lista de nomes).
- Ao escolher um músculo: exercícios em que ele é principal e em que é secundário, com filtros de nível, objetivo e equipamentos.
- No detalhe de cada exercício, o mapa mostra os músculos principais (forte) e secundários (leve), e cada músculo leva ao mapa.

**Etapa 5 — biblioteca de exercícios:**
- 51 exercícios com fotos, animação de início e fim, músculos principais e secundários, passo a passo, respiração, técnica, erros comuns, segurança e alternativas.
- Busca sem acento, filtros por grupo, nível, objetivo, equipamentos do perfil e favoritos (os filtros ficam na URL).
- Sugestão de séries, repetições e descanso conforme o objetivo e o nível do perfil.
- Favoritos salvos na conta (Supabase, com RLS testada em `supabase/tests/rls_favoritos.sql`) ou no navegador no modo local.

**Etapa 4 — contas (Supabase):**
- Criar conta, entrar, recuperar e redefinir senha, sair.
- Cadastro inicial em 5 etapas: dados pessoais, objetivo e rotina, equipamentos, saúde (questionário PAR-Q + limitações) e consentimento LGPD.
- Perfil editável e exclusão definitiva da conta.
- Rotas protegidas: sem login vai para "Entrar"; sem perfil vai para o cadastro.
- Banco com RLS: aluno vê só os próprios dados, professor vê só os alunos dele, admin não lê dados de saúde. Testes em `supabase/tests/rls_perfis.sql`.

**Etapas 1–3:**

- Identidade visual com tema escuro e claro (segue o sistema ou escolha no Perfil).
- Navegação real: barra inferior no celular, menu lateral no computador.
- Dashboard: treino do dia (rodízio da divisão), semana com dias treinados, meta semanal, sequência de semanas, peso e últimas atividades.
- Plano semanal com os exercícios de cada sessão.
- **Modo local**: sem Supabase configurado, os dados ficam só no navegador, e a tela avisa. Há um botão para explorar com dados de exemplo, sempre identificados como tal.
- Telas das próximas etapas dizem que ainda não estão prontas, sem simular a função.

## Publicação

- Produção: **https://fitpro-ai-taupe.vercel.app** (projeto Vercel `fitpro-ai`).
- Código: https://github.com/faba2024/fitpro-ai (privado). Cada `git push` na `main` publica em produção automaticamente; outras branches geram uma prévia.
- Publicar manualmente, se precisar: `npx vercel deploy --prod`.
- As variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão cadastradas na Vercel para Production e Preview.

## Requisitos

- Node.js 20 ou superior (testado com 24)

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
```

Outros comandos:

```bash
npm test           # testes unitários e de componentes (Vitest)
npm run build      # checagem de tipos + build de produção em dist/
npm run preview    # serve o build em http://localhost:4173
node scripts/gerar-icones.mjs   # regenera os ícones PNG do PWA
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local`. Sem as variáveis do Supabase o app roda em modo local (sem contas).

### Configuração do Supabase (projeto `fitpro-ai`)

1. As migrações estão em `supabase/migrations/` e já foram aplicadas no projeto.
2. Em **Authentication → URL Configuration** do painel do Supabase:
   - *Site URL*: o endereço publicado (ou `http://localhost:5173` durante o desenvolvimento).
   - *Redirect URLs*: `http://localhost:5173/**`, `http://localhost:4173/**` e o domínio da Vercel com `/**`.
   Sem isso, os links de confirmação de e-mail e de redefinir senha abrem o endereço errado.
3. O envio de e-mail embutido do Supabase tem limite baixo por hora (serve para testes). Para produção, configure um SMTP próprio em **Authentication → SMTP Settings**.

| Variável | Onde | Etapa |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | navegador (chave pública) | 4 |
| `ANTHROPIC_API_KEY` | só no servidor (Vercel), nunca com prefixo `VITE_` | 10 |

## Estrutura

```
src/app          rotas, providers de tema e dados
src/components   ui/ (botões, cards…) e layout/ (navegação)
src/domain       tipos e regras de treino, com testes
src/data         repositório (local hoje, Supabase na etapa 4)
src/features     uma pasta por área do app
docs/            arquitetura, banco, riscos, plano de testes
```

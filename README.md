# FitPro AI

Aplicativo de treino (PWA) com dashboard, fichas, biblioteca de exercícios, mapa muscular, modo treino, evolução e assistente de IA. Desenvolvido por etapas; veja o plano e o estado de cada etapa em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## O que já funciona (v0.2)

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

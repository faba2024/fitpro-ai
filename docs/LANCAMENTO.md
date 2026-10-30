# Lançamento — lista de verificação

O que já foi feito no código está marcado. O resto depende de contas, decisões ou dados que só o responsável pelo app pode fornecer.

## Antes de abrir para o público (obrigatório)

- [ ] **Identificação do responsável (LGPD).** Preencher `src/config/legal.ts` com nome ou razão social, CPF/CNPJ e um e-mail para pedidos sobre dados. Enquanto estiver vazio, Termos e Privacidade mostram um aviso.
- [ ] **Revisão jurídica** dos textos em `src/features/legal/Legal.tsx` (Termos de Uso e Política de Privacidade). Eles descrevem o que o app faz de verdade, mas não substituem a revisão de um advogado. Pontos para decidir: idade mínima (o texto diz 18 anos ou com responsável) e prazo de resposta a pedidos.
- [ ] **Supabase → Authentication → URL Configuration:**
  - Site URL: `https://fitpro-ai-taupe.vercel.app` (ou o domínio próprio).
  - Redirect URLs: `https://fitpro-ai-taupe.vercel.app/**` e `http://localhost:5173/**`.
  - Sem isso, os links de confirmação de e-mail e de redefinir senha abrem o endereço errado.
- [ ] **Supabase → Authentication → SMTP Settings:** configurar um provedor de e-mail próprio (Resend, Brevo, Amazon SES etc.). O envio embutido do Supabase tem limite de poucos e-mails por hora e serve só para testes.
- [ ] **Supabase → Authentication → proteção contra senhas vazadas:** ligar (aparece como aviso no painel de segurança).
- [ ] **Chave da IA:** criar a chave em console.anthropic.com (com crédito) e cadastrar `ANTHROPIC_API_KEY` na Vercel (projeto `fitpro-ai`, Production e Preview). Depois, publicar de novo. Sem a chave, o assistente avisa que não está configurado; o resto do app funciona.

## Recomendado

- [ ] **Domínio próprio** na Vercel (Settings → Domains). Ao trocar, atualizar a Site URL e as Redirect URLs do Supabase **e** a `Content-Security-Policy` em `vercel.json`, se o endereço do Supabase mudar.
- [ ] **Plano do Supabase.** O plano gratuito pausa o projeto depois de 7 dias sem uso e não tem backup automático com restauração por data. Para usuários reais, avalie o plano Pro (backups diários).
- [ ] **Limite de gasto na Anthropic** (console → Limits) para o assistente não gerar surpresa na fatura. O app já limita 30 perguntas por pessoa por dia.
- [ ] **Monitoramento de erros:** a Vercel mostra os erros das funções em Logs. Para erros do navegador, avaliar um serviço como Sentry (exigiria atualizar a Política de Privacidade).
- [ ] **Testar num celular de verdade** (Android e iPhone): instalar como app (Adicionar à tela inicial), fazer um treino com a internet desligada no meio e conferir a sincronização quando ela voltar.

## Já feito no código (etapa 12)

- [x] Testes automáticos: 215 unitários e de telas (Vitest) e 8 de ponta a ponta (Playwright) em celular e computador, tema claro e escuro, sem conta e com conta (Supabase simulado em memória, sem tocar no banco real).
- [x] Jornada completa testada: criar conta → cadastro inicial → montar ficha → treinar → fechar a página no meio → retomar → concluir → evolução.
- [x] Acessibilidade automática (axe, WCAG 2.1 AA) em todas as telas: contraste de cores corrigido nos dois temas.
- [x] Nenhuma tela rola para os lados no celular.
- [x] Termos de Uso e Política de Privacidade publicados (`/termos`, `/privacidade`) e ligados ao cadastro, ao login e ao perfil.
- [x] Cabeçalhos de segurança: `Content-Security-Policy` (só o próprio app, o Supabase do projeto e as fotos do jsDelivr), HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- [x] Tela de erro amigável; depois de uma publicação nova, quem estava com o app aberto recarrega sozinho em vez de ver página branca.
- [x] RLS testada em todas as tabelas (`supabase/tests/*.sql`).

## Como rodar as verificações

```bash
npm run verificar   # tipos + testes unitários + testes de ponta a ponta
```

Na primeira vez, instale o navegador dos testes: `npx playwright install chromium`.

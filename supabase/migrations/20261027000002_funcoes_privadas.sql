-- As funções de permissão não precisam ficar expostas como RPC na API pública.
-- Movidas para o schema "privado" (não exposto pelo PostgREST); as policies continuam usando-as.
-- excluir_minha_conta() continua em public: é chamada pelo app de propósito.

create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

alter function public.tem_papel(uuid, public.papel) set schema privado;
alter function public.eh_professor_do_aluno(uuid) set schema privado;

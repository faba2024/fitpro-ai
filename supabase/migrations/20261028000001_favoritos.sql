-- Etapa 5: exercícios favoritos.
-- O catálogo global de exercícios fica versionado no código (src/data/catalogo.ts), com ids estáveis;
-- aqui guardamos só o id. Exercícios próprios de academias ganham tabela na etapa 11.

create table public.favoritos (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercicio_id text not null check (exercicio_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(exercicio_id) <= 80),
  criado_em timestamptz not null default now(),
  primary key (user_id, exercicio_id)
);

alter table public.favoritos enable row level security;

create policy "favoritos: dono lê" on public.favoritos for select to authenticated
  using (user_id = (select auth.uid()));
create policy "favoritos: dono adiciona" on public.favoritos for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "favoritos: dono remove" on public.favoritos for delete to authenticated
  using (user_id = (select auth.uid()));

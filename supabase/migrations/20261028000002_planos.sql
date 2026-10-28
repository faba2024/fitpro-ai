-- Etapa 7: fichas de treino.
-- A estrutura (treinos A/B/C… e seus exercícios) fica em jsonb: a ficha é salva inteira, de forma
-- atômica, e cada treino/exercício tem id próprio para o modo treino referenciar (etapa 8).
-- Regras:
--   aluno     → lê e edita as próprias fichas; editar uma ficha revisada desfaz a revisão
--   professor → lê, cria e edita fichas dos alunos vinculados a ele; só ele marca "revisado"
--   uma ficha ativa por aluno (ativar uma desativa as outras)

create table public.planos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references auth.users (id) on delete cascade,
  criado_por uuid not null default auth.uid() references auth.users (id) on delete set null,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  objetivo public.objetivo not null,
  origem text not null default 'motor' check (origem in ('motor', 'professor', 'manual')),
  ativo boolean not null default true,
  estrutura jsonb not null check (jsonb_typeof(estrutura) = 'array' and jsonb_array_length(estrutura) between 1 and 7),
  parametros jsonb not null default '{}'::jsonb,
  explicacao text not null default '' check (char_length(explicacao) <= 1000),
  revisado_por uuid references auth.users (id) on delete set null,
  revisado_em timestamptz,
  observacao_profissional text check (char_length(observacao_profissional) <= 2000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check ((revisado_por is null) = (revisado_em is null))
);

comment on table public.planos is 'Fichas de treino. estrutura = [{id, nome, titulo, itens: [{exercicioId, series, repsMin, repsMax, descansoS, cargaKg}]}]';

create unique index planos_um_ativo_por_aluno on public.planos (aluno_id) where ativo;
create index planos_aluno_idx on public.planos (aluno_id, criado_em desc);

create trigger planos_atualizado_em before update on public.planos
  for each row execute function public.tocar_atualizado_em();

-- Revisão profissional: só o professor do aluno marca; mudança feita pelo aluno desfaz a revisão.
create or replace function public.planos_controlar_revisao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  professor boolean := privado.eh_professor_do_aluno(new.aluno_id);
begin
  if tg_op = 'UPDATE' and new.aluno_id <> old.aluno_id then
    raise exception 'não é permitido trocar o aluno da ficha' using errcode = '42501';
  end if;

  if new.revisado_por is not null and (tg_op = 'INSERT' or new.revisado_por is distinct from old.revisado_por or new.revisado_em is distinct from old.revisado_em) then
    if not professor or new.revisado_por <> eu then
      raise exception 'só o professor do aluno pode marcar a ficha como revisada' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' and not professor and (new.estrutura is distinct from old.estrutura) then
    new.revisado_por := null;
    new.revisado_em := null;
  end if;
  return new;
end;
$$;

create trigger planos_revisao before insert or update on public.planos
  for each row execute function public.planos_controlar_revisao();

-- Uma ficha ativa por aluno: ao ativar, desativa as outras (com as permissões de quem salva).
create or replace function public.planos_um_ativo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ativo then
    update public.planos set ativo = false where aluno_id = new.aluno_id and id <> new.id and ativo;
  end if;
  return new;
end;
$$;

create trigger planos_ativo before insert or update of ativo on public.planos
  for each row when (new.ativo) execute function public.planos_um_ativo();

alter table public.planos enable row level security;

create policy "planos: aluno lê" on public.planos for select to authenticated
  using (aluno_id = (select auth.uid()));
create policy "planos: professor lê" on public.planos for select to authenticated
  using (privado.eh_professor_do_aluno(aluno_id));
create policy "planos: aluno cria" on public.planos for insert to authenticated
  with check (aluno_id = (select auth.uid()) and criado_por = (select auth.uid()));
create policy "planos: professor cria" on public.planos for insert to authenticated
  with check (privado.eh_professor_do_aluno(aluno_id) and criado_por = (select auth.uid()));
create policy "planos: aluno edita" on public.planos for update to authenticated
  using (aluno_id = (select auth.uid())) with check (aluno_id = (select auth.uid()));
create policy "planos: professor edita" on public.planos for update to authenticated
  using (privado.eh_professor_do_aluno(aluno_id)) with check (privado.eh_professor_do_aluno(aluno_id));
create policy "planos: aluno apaga" on public.planos for delete to authenticated
  using (aluno_id = (select auth.uid()));

-- Etapa 4: perfis de usuário, academias e papéis (aluno, professor, admin), com RLS.
-- Regras de acesso:
--   aluno     → só o próprio perfil
--   professor → lê o perfil dos alunos vinculados a ele (professor_id) na mesma academia
--   admin     → gerencia membros da própria academia; NÃO lê perfis (dados de saúde)

create type public.objetivo as enum ('hipertrofia', 'emagrecimento', 'forca', 'condicionamento', 'saude');
create type public.nivel as enum ('iniciante', 'intermediario', 'avancado');
create type public.papel as enum ('aluno', 'professor', 'admin');

-- atualizado_em automático
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ───────────────────────── perfis ─────────────────────────
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  data_nascimento date not null check (data_nascimento > date '1900-01-01'),
  altura_cm numeric(5, 1) not null check (altura_cm between 100 and 250),
  peso_kg numeric(5, 1) not null check (peso_kg between 30 and 300),
  objetivo public.objetivo not null,
  nivel public.nivel not null,
  dias_semana smallint not null check (dias_semana between 1 and 7),
  minutos_sessao smallint not null check (minutos_sessao between 15 and 180),
  equipamentos text[] not null default '{}' check (cardinality(equipamentos) <= 30),
  limitacoes text not null default '' check (char_length(limitacoes) <= 1000),
  -- questionário de prontidão (PAR-Q): respostas e se alguma pede liberação médica
  parq_respostas jsonb not null default '{}'::jsonb,
  parq_alerta boolean not null default false,
  consentimento_termos_em timestamptz not null,
  consentimento_saude_em timestamptz not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.perfis is 'Perfil e dados de saúde do usuário (dado sensível, LGPD art. 11). Um por usuário.';

create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- ───────────────────────── academias ─────────────────────────
create table public.academias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  criado_em timestamptz not null default now()
);

create table public.membros_academia (
  academia_id uuid not null references public.academias (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel public.papel not null,
  -- só para alunos: professor responsável
  professor_id uuid references auth.users (id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (academia_id, user_id, papel),
  check (professor_id is null or papel = 'aluno')
);

create index membros_academia_user_idx on public.membros_academia (user_id);
create index membros_academia_professor_idx on public.membros_academia (professor_id) where professor_id is not null;

-- ───────────────────────── funções de permissão ─────────────────────────
-- security definer para não cair em recursão de RLS ao consultar membros_academia.

create or replace function public.tem_papel(p_academia uuid, p_papel public.papel)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membros_academia m
    where m.academia_id = p_academia and m.user_id = (select auth.uid()) and m.papel = p_papel and m.ativo
  );
$$;

create or replace function public.eh_professor_do_aluno(p_aluno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros_academia a
    join public.membros_academia p
      on p.academia_id = a.academia_id and p.user_id = a.professor_id and p.papel = 'professor' and p.ativo
    where a.user_id = p_aluno and a.papel = 'aluno' and a.ativo and a.professor_id = (select auth.uid())
  );
$$;

-- Excluir a própria conta (LGPD): apaga o usuário; perfis e vínculos saem em cascata.
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.tem_papel(uuid, public.papel) from public, anon;
revoke all on function public.eh_professor_do_aluno(uuid) from public, anon;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.tem_papel(uuid, public.papel) to authenticated;
grant execute on function public.eh_professor_do_aluno(uuid) to authenticated;
grant execute on function public.excluir_minha_conta() to authenticated;

-- ───────────────────────── RLS ─────────────────────────
alter table public.perfis enable row level security;
alter table public.academias enable row level security;
alter table public.membros_academia enable row level security;

-- perfis
create policy "perfis: dono lê" on public.perfis for select to authenticated
  using (id = (select auth.uid()));
create policy "perfis: professor lê seus alunos" on public.perfis for select to authenticated
  using (public.eh_professor_do_aluno(id));
create policy "perfis: dono cria" on public.perfis for insert to authenticated
  with check (id = (select auth.uid()));
create policy "perfis: dono edita" on public.perfis for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- sem policy de delete: a exclusão acontece via excluir_minha_conta()

-- academias: membros veem; admin edita. Criação de academias fica para o painel (etapa 11).
create policy "academias: membros leem" on public.academias for select to authenticated
  using (
    exists (select 1 from public.membros_academia m where m.academia_id = id and m.user_id = (select auth.uid()) and m.ativo)
  );
create policy "academias: admin edita" on public.academias for update to authenticated
  using (public.tem_papel(id, 'admin')) with check (public.tem_papel(id, 'admin'));

-- membros_academia
create policy "membros: vê os próprios vínculos" on public.membros_academia for select to authenticated
  using (user_id = (select auth.uid()));
create policy "membros: professor vê seus alunos" on public.membros_academia for select to authenticated
  using (professor_id = (select auth.uid()) and public.tem_papel(academia_id, 'professor'));
create policy "membros: admin vê a academia" on public.membros_academia for select to authenticated
  using (public.tem_papel(academia_id, 'admin'));
create policy "membros: admin adiciona" on public.membros_academia for insert to authenticated
  with check (public.tem_papel(academia_id, 'admin'));
create policy "membros: admin altera" on public.membros_academia for update to authenticated
  using (public.tem_papel(academia_id, 'admin')) with check (public.tem_papel(academia_id, 'admin'));
create policy "membros: admin remove" on public.membros_academia for delete to authenticated
  using (public.tem_papel(academia_id, 'admin'));

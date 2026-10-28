-- Etapa 8: treinos realizados (sessões) e séries registradas.
-- O app grava no aparelho a cada toque e sincroniza com upsert por id (idempotente):
-- reenviar a mesma série não duplica nada.
-- Regras: dono lê e escreve; professor do aluno só lê; admin não lê.

create table public.sessoes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plano_id uuid references public.planos (id) on delete set null,
  plano_sessao_id text not null check (char_length(plano_sessao_id) <= 64),
  titulo text not null check (char_length(titulo) <= 80),
  status text not null check (status in ('em_andamento', 'concluida', 'abandonada')),
  iniciada_em timestamptz not null,
  finalizada_em timestamptz,
  duracao_ativa_s integer not null default 0 check (duracao_ativa_s between 0 and 86400),
  series_concluidas integer not null default 0 check (series_concluidas between 0 and 500),
  volume_kg numeric(10, 1) not null default 0 check (volume_kg >= 0),
  atualizado_em timestamptz not null default now(),
  check (finalizada_em is null or finalizada_em >= iniciada_em),
  check ((status = 'em_andamento') = (finalizada_em is null))
);

create index sessoes_user_idx on public.sessoes (user_id, iniciada_em desc);

create table public.series (
  id uuid primary key,
  sessao_id uuid not null references public.sessoes (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercicio_id text not null check (exercicio_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(exercicio_id) <= 80),
  ordem_exercicio smallint not null check (ordem_exercicio between 0 and 50),
  ordem smallint not null check (ordem between 0 and 50),
  carga_kg numeric(6, 2) check (carga_kg between 0 and 1000),
  reps integer not null check (reps between 1 and 3600),
  concluida_em timestamptz not null
);

create index series_historico_idx on public.series (user_id, exercicio_id, concluida_em desc);
create index series_sessao_idx on public.series (sessao_id);

create trigger sessoes_atualizado_em before update on public.sessoes
  for each row execute function public.tocar_atualizado_em();

-- a série precisa pertencer a uma sessão do mesmo usuário
create or replace function public.series_mesmo_dono()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.sessoes s where s.id = new.sessao_id and s.user_id = new.user_id) then
    raise exception 'série de outra pessoa' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger series_dono before insert or update on public.series
  for each row execute function public.series_mesmo_dono();

alter table public.sessoes enable row level security;
alter table public.series enable row level security;

create policy "sessoes: dono lê" on public.sessoes for select to authenticated using (user_id = (select auth.uid()));
create policy "sessoes: professor lê" on public.sessoes for select to authenticated using (privado.eh_professor_do_aluno(user_id));
create policy "sessoes: dono cria" on public.sessoes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "sessoes: dono edita" on public.sessoes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "sessoes: dono apaga" on public.sessoes for delete to authenticated using (user_id = (select auth.uid()));

create policy "series: dono lê" on public.series for select to authenticated using (user_id = (select auth.uid()));
create policy "series: professor lê" on public.series for select to authenticated using (privado.eh_professor_do_aluno(user_id));
create policy "series: dono cria" on public.series for insert to authenticated with check (user_id = (select auth.uid()));
create policy "series: dono edita" on public.series for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "series: dono apaga" on public.series for delete to authenticated using (user_id = (select auth.uid()));

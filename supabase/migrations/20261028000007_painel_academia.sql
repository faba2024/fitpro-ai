-- Etapa 11: painéis do professor e da academia.
--   • academia criada por quem vai administrá-la (criar_academia)
--   • entrada só por convite (código de 10 caracteres, com validade e limite de usos)
--   • admin vê só o NOME dos membros (membros_da_academia), nunca perfil/saúde/treinos
--   • pagamentos registrados à mão pelo admin (não há cobrança online)
--   • o aluno pode sair da academia a qualquer momento (o professor deixa de ver seus dados)

-- ───────────── vínculos: regras que as policies sozinhas não garantem ─────────────
alter table public.academias add column mensalidade_padrao numeric(10, 2) check (mensalidade_padrao is null or mensalidade_padrao between 0 and 100000);

-- quem entra é só por convite (aceitar_convite) ou ao criar a academia
drop policy "membros: admin adiciona" on public.membros_academia;

create policy "membros: sai da academia" on public.membros_academia for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.membros_conferir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.academia_id <> old.academia_id or new.user_id <> old.user_id or new.papel <> old.papel) then
    raise exception 'não é permitido trocar academia, pessoa ou papel de um vínculo' using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.professor_id is not null and new.professor_id is distinct from (case when tg_op = 'UPDATE' then old.professor_id end) then
    if not exists (
      select 1 from public.membros_academia p
      where p.academia_id = new.academia_id and p.user_id = new.professor_id and p.papel = 'professor' and p.ativo
    ) then
      raise exception 'o professor precisa ser um professor ativo da mesma academia' using errcode = '23514';
    end if;
  end if;

  -- a academia nunca fica sem administrador ativo
  if old.papel = 'admin' and old.ativo and (tg_op = 'DELETE' or not new.ativo) then
    if not exists (
      select 1 from public.membros_academia m
      where m.academia_id = old.academia_id and m.papel = 'admin' and m.ativo and m.user_id <> old.user_id
    )
    -- exceções: a academia está sendo apagada, ou a própria conta está sendo excluída (LGPD)
    and exists (select 1 from public.academias a where a.id = old.academia_id)
    and exists (select 1 from auth.users u where u.id = old.user_id) then
      raise exception 'a academia precisa de pelo menos um administrador ativo' using errcode = '23514';
    end if;
  end if;

  -- professor que sai ou é desativado: os alunos dele ficam sem professor
  if old.papel = 'professor' and (tg_op = 'DELETE' or not new.ativo) then
    update public.membros_academia set professor_id = null
    where academia_id = old.academia_id and professor_id = old.user_id and papel = 'aluno';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- em INSERT o OLD é nulo e em DELETE o NEW é nulo; as checagens acima tratam cada operação
create trigger membros_conferir before insert or update or delete on public.membros_academia
  for each row execute function public.membros_conferir();

-- ───────────── criar academia ─────────────
create or replace function public.criar_academia(p_nome text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  nova uuid;
begin
  if eu is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if (select count(*) from public.membros_academia where user_id = eu and papel = 'admin') >= 3 then
    raise exception 'limite de 3 academias por administrador' using errcode = '23514';
  end if;
  insert into public.academias (nome, slug) values (btrim(p_nome), p_slug) returning id into nova;
  insert into public.membros_academia (academia_id, user_id, papel) values (nova, eu, 'admin');
  return nova;
end;
$$;

-- ───────────── convites ─────────────
create table public.convites (
  codigo text primary key check (codigo ~ '^[0-9A-F]{10}$'),
  academia_id uuid not null references public.academias (id) on delete cascade,
  papel public.papel not null check (papel in ('aluno', 'professor')),
  -- convite feito por um professor já vincula o aluno a ele
  professor_id uuid references auth.users (id) on delete cascade,
  criado_por uuid not null references auth.users (id) on delete cascade,
  expira_em timestamptz not null,
  usos_max smallint not null check (usos_max between 1 and 200),
  usos smallint not null default 0 check (usos >= 0),
  criado_em timestamptz not null default now(),
  check (professor_id is null or papel = 'aluno')
);

create index convites_academia_idx on public.convites (academia_id);

alter table public.convites enable row level security;
-- criação e uso só pelas funções abaixo; ler e revogar pela API
create policy "convites: admin lê" on public.convites for select to authenticated
  using (privado.tem_papel(academia_id, 'admin'));
create policy "convites: professor lê os seus" on public.convites for select to authenticated
  using (criado_por = (select auth.uid()));
create policy "convites: admin revoga" on public.convites for delete to authenticated
  using (privado.tem_papel(academia_id, 'admin'));
create policy "convites: professor revoga os seus" on public.convites for delete to authenticated
  using (criado_por = (select auth.uid()));

-- p_vincular_a_mim: aluno convidado por um professor já fica com ele como professor
-- (para quem é só professor isso é sempre verdade; o admin que também dá aula escolhe)
create or replace function public.criar_convite(p_academia uuid, p_papel public.papel, p_usos int default 1, p_dias int default 7, p_vincular_a_mim boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  admin boolean := privado.tem_papel(p_academia, 'admin');
  professor boolean := privado.tem_papel(p_academia, 'professor');
  cod text;
begin
  if eu is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  if p_papel not in ('aluno', 'professor') then raise exception 'papel inválido' using errcode = '22023'; end if;
  if not admin and not (professor and p_papel = 'aluno') then
    raise exception 'sem permissão para convidar' using errcode = '42501';
  end if;
  if p_usos not between 1 and 200 or p_dias not between 1 and 30 then
    raise exception 'usos de 1 a 200 e validade de 1 a 30 dias' using errcode = '22023';
  end if;
  if (select count(*) from public.convites where academia_id = p_academia and expira_em > now() and usos < usos_max) >= 50 then
    raise exception 'muitos convites abertos; revogue alguns antes' using errcode = '23514';
  end if;
  -- 40 bits aleatórios em hexadecimal; colisão é praticamente impossível, mas tenta de novo
  loop
    cod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.convites where codigo = cod);
  end loop;
  insert into public.convites (codigo, academia_id, papel, professor_id, criado_por, expira_em, usos_max)
  values (
    cod, p_academia, p_papel,
    case when p_papel = 'aluno' and professor and (not admin or p_vincular_a_mim) then eu end,
    eu, now() + make_interval(days => p_dias), p_usos
  );
  return cod;
end;
$$;

create or replace function public.aceitar_convite(p_codigo text)
returns table (academia_id uuid, academia_nome text, papel public.papel)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  eu uuid := (select auth.uid());
  c public.convites%rowtype;
begin
  if eu is null then raise exception 'não autenticado' using errcode = '42501'; end if;
  select * into c from public.convites
  where codigo = upper(btrim(p_codigo)) and expira_em > now() and usos < usos_max
  for update;
  if not found then raise exception 'convite inválido ou expirado' using errcode = 'P0002'; end if;
  if c.professor_id = eu then raise exception 'você não pode usar o próprio convite' using errcode = '23514'; end if;

  insert into public.membros_academia as m (academia_id, user_id, papel, professor_id)
  values (c.academia_id, eu, c.papel, c.professor_id)
  on conflict on constraint membros_academia_pkey do update
    set ativo = true, professor_id = coalesce(excluded.professor_id, m.professor_id);
  update public.convites set usos = usos + 1 where codigo = c.codigo;

  return query select a.id, a.nome, c.papel from public.academias a where a.id = c.academia_id;
end;
$$;

-- ───────────── lista de membros para o admin (só o nome) ─────────────
create or replace function public.membros_da_academia(p_academia uuid)
returns table (user_id uuid, nome text, papel public.papel, professor_id uuid, ativo boolean, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not privado.tem_papel(p_academia, 'admin') then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return query
    select m.user_id, coalesce(p.nome, 'Sem perfil'), m.papel, m.professor_id, m.ativo, m.criado_em
    from public.membros_academia m
    left join public.perfis p on p.id = m.user_id
    where m.academia_id = p_academia
    order by m.papel, coalesce(p.nome, '');
end;
$$;

-- ───────────── minhas academias (com nome da academia e do meu professor) ─────────────
create or replace function public.minhas_academias()
returns table (academia_id uuid, academia_nome text, papel public.papel, ativo boolean, professor_id uuid, professor_nome text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.academia_id, a.nome, m.papel, m.ativo, m.professor_id, pp.nome
  from public.membros_academia m
  join public.academias a on a.id = m.academia_id
  left join public.perfis pp on pp.id = m.professor_id
  where m.user_id = (select auth.uid())
  order by a.nome, m.papel;
$$;

-- ───────────── pagamentos (registro manual) ─────────────
create or replace function privado.eh_aluno_da_academia(p_academia uuid, p_aluno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.membros_academia where academia_id = p_academia and user_id = p_aluno and papel = 'aluno');
$$;

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academias (id) on delete cascade,
  aluno_id uuid not null references auth.users (id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  valor numeric(10, 2) not null check (valor > 0 and valor <= 100000),
  pago_em date not null default current_date,
  forma text not null check (forma in ('pix', 'dinheiro', 'cartao', 'transferencia', 'outro')),
  observacao text not null default '' check (char_length(observacao) <= 300),
  registrado_por uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (academia_id, aluno_id, competencia)
);

comment on table public.pagamentos is 'Mensalidades recebidas, registradas pelo admin. O app não processa cobranças.';
create index pagamentos_aluno_idx on public.pagamentos (aluno_id);

alter table public.pagamentos enable row level security;
create policy "pagamentos: admin lê" on public.pagamentos for select to authenticated
  using (privado.tem_papel(academia_id, 'admin'));
create policy "pagamentos: aluno lê os seus" on public.pagamentos for select to authenticated
  using (aluno_id = (select auth.uid()));
create policy "pagamentos: admin registra" on public.pagamentos for insert to authenticated
  with check (privado.tem_papel(academia_id, 'admin') and privado.eh_aluno_da_academia(academia_id, aluno_id));
create policy "pagamentos: admin corrige" on public.pagamentos for update to authenticated
  using (privado.tem_papel(academia_id, 'admin'))
  with check (privado.tem_papel(academia_id, 'admin') and privado.eh_aluno_da_academia(academia_id, aluno_id));
create policy "pagamentos: admin apaga" on public.pagamentos for delete to authenticated
  using (privado.tem_papel(academia_id, 'admin'));

-- ───────────── permissões das funções ─────────────
revoke all on function public.membros_conferir() from public, anon, authenticated;
revoke all on function privado.eh_aluno_da_academia(uuid, uuid) from public, anon;
grant execute on function privado.eh_aluno_da_academia(uuid, uuid) to authenticated;
revoke all on function public.criar_academia(text, text) from public, anon;
revoke all on function public.criar_convite(uuid, public.papel, int, int, boolean) from public, anon;
revoke all on function public.aceitar_convite(text) from public, anon;
revoke all on function public.membros_da_academia(uuid) from public, anon;
revoke all on function public.minhas_academias() from public, anon;
grant execute on function public.criar_academia(text, text) to authenticated;
grant execute on function public.criar_convite(uuid, public.papel, int, int, boolean) to authenticated;
grant execute on function public.aceitar_convite(text) to authenticated;
grant execute on function public.membros_da_academia(uuid) to authenticated;
grant execute on function public.minhas_academias() to authenticated;

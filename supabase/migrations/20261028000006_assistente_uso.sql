-- Etapa 10: limite diário de perguntas ao assistente de IA (custo e abuso).
-- A conversa NÃO é guardada no banco; só a contagem por dia.
-- A pessoa só lê a própria contagem; somar é feito pela função (security definer) para ninguém zerar o contador.

create table public.assistente_uso (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  contagem integer not null default 0 check (contagem >= 0),
  primary key (user_id, dia)
);

alter table public.assistente_uso enable row level security;
create policy "assistente_uso: dono lê" on public.assistente_uso for select to authenticated using (user_id = (select auth.uid()));
-- sem policies de escrita: só a função abaixo altera

-- Consome uma pergunta do dia (fuso de São Paulo). Devolve quantas restam; -1 = limite atingido.
create or replace function public.consumir_cota_assistente(p_limite integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := (select auth.uid());
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  usado integer;
  limite integer := least(greatest(coalesce(p_limite, 30), 1), 30);
begin
  if eu is null then
    raise exception 'não autenticado' using errcode = '42501';
  end if;
  insert into public.assistente_uso (user_id, dia, contagem) values (eu, hoje, 0)
    on conflict (user_id, dia) do nothing;
  update public.assistente_uso set contagem = contagem + 1
    where user_id = eu and dia = hoje and contagem < limite
    returning contagem into usado;
  if usado is null then
    return -1;
  end if;
  return limite - usado;
end;
$$;

revoke all on function public.consumir_cota_assistente(integer) from public, anon;
grant execute on function public.consumir_cota_assistente(integer) to authenticated;

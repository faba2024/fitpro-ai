-- Maior carga já registrada por exercício, para a pessoa logada (security invoker: a RLS de series vale).
create or replace function public.recordes(p_exercicios text[])
returns table (exercicio_id text, max_carga_kg numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.exercicio_id, max(s.carga_kg)
  from public.series s
  where s.user_id = (select auth.uid()) and s.exercicio_id = any (p_exercicios) and s.carga_kg is not null
  group by s.exercicio_id;
$$;

revoke all on function public.recordes(text[]) from public, anon;
grant execute on function public.recordes(text[]) to authenticated;

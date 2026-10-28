-- Testes de RLS dos favoritos (etapa 5). Sucesso = "RLS_OK"; nada fica gravado.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  n int;
  ok int := 0;
  erro boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'fa@teste.local', 'authenticated', 'authenticated'),
    (b, 'fb@teste.local', 'authenticated', 'authenticated');
  insert into public.favoritos (user_id, exercicio_id) values (b, 'prancha');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.favoritos (user_id, exercicio_id) values (a, 'flexao');
  ok := ok + 1;

  select count(*) into n from public.favoritos;
  if n <> 1 then raise exception 'FALHOU: A deveria ver só o próprio favorito, viu %', n; end if;
  ok := ok + 1;

  erro := false;
  begin
    insert into public.favoritos (user_id, exercicio_id) values (b, 'flexao');
  exception when insufficient_privilege then erro := true;
  end;
  if not erro then raise exception 'FALHOU: A criou favorito para B'; end if;
  ok := ok + 1;

  delete from public.favoritos where user_id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: A apagou favorito de B'; end if;
  ok := ok + 1;

  erro := false;
  begin
    insert into public.favoritos (user_id, exercicio_id) values (a, 'Nome Inválido; drop');
  exception when check_violation then erro := true;
  end;
  if not erro then raise exception 'FALHOU: aceitou id fora do formato'; end if;
  ok := ok + 1;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  select count(*) into n from public.favoritos;
  if n <> 0 then raise exception 'FALHOU: anônimo leu favoritos'; end if;
  ok := ok + 1;

  raise exception 'RLS_OK: % verificações passaram (transação desfeita de propósito)', ok;
end;
$$;

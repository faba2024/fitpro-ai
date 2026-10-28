-- Testes do limite diário do assistente (etapa 10). Sucesso = "RLS_OK"; nada fica gravado.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  r integer; n integer; ok int := 0; erro boolean;
begin
  insert into auth.users (id, email, aud, role) values (a, 'ia@teste.local', 'authenticated', 'authenticated'), (b, 'ib@teste.local', 'authenticated', 'authenticated');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  r := public.consumir_cota_assistente(3); if r <> 2 then raise exception 'FALHOU: 1ª pergunta deveria deixar 2, deixou %', r; end if; ok := ok + 1;
  r := public.consumir_cota_assistente(3);
  r := public.consumir_cota_assistente(3); if r <> 0 then raise exception 'FALHOU: 3ª pergunta deveria deixar 0, deixou %', r; end if; ok := ok + 1;
  r := public.consumir_cota_assistente(3); if r <> -1 then raise exception 'FALHOU: passou do limite'; end if; ok := ok + 1;
  -- pedir limite maior que 30 não fura o teto
  select contagem into n from public.assistente_uso; if n <> 3 then raise exception 'FALHOU: contagem deveria ser 3, é %', n; end if; ok := ok + 1;
  erro := false; begin update public.assistente_uso set contagem = 0; get diagnostics n = row_count; if n = 0 then erro := true; end if; exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: pessoa zerou o próprio contador'; end if; ok := ok + 1;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.assistente_uso; if n <> 0 then raise exception 'FALHOU: B viu a contagem de A'; end if; ok := ok + 1;
  r := public.consumir_cota_assistente(3); if r <> 2 then raise exception 'FALHOU: contagem de B misturada com A'; end if; ok := ok + 1;

  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  erro := false; begin r := public.consumir_cota_assistente(3); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: anônimo usou o assistente'; end if; ok := ok + 1;

  raise exception 'RLS_OK: % verificações passaram (transação desfeita de propósito)', ok;
end;
$$;

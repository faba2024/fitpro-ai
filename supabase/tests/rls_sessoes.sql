-- Testes de RLS de sessões e séries (etapa 8). Sucesso = "RLS_OK"; nada fica gravado.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); p uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  x uuid; sa uuid := gen_random_uuid(); s1 uuid := gen_random_uuid();
  n int; ok int := 0; erro boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'sa@teste.local', 'authenticated', 'authenticated'), (b, 'sb@teste.local', 'authenticated', 'authenticated'),
    (p, 'sp@teste.local', 'authenticated', 'authenticated'), (d, 'sd@teste.local', 'authenticated', 'authenticated');
  insert into public.academias (nome, slug) values ('Academia Teste', 'academia-teste-sessoes') returning id into x;
  insert into public.membros_academia (academia_id, user_id, papel, professor_id) values
    (x, a, 'aluno', p), (x, b, 'aluno', null), (x, p, 'professor', null), (x, d, 'admin', null);

  -- aluno A grava sessão e série; reenviar (upsert) não duplica
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.sessoes (id, plano_sessao_id, titulo, status, iniciada_em) values (sa, 's1', 'Treino A', 'em_andamento', now() - interval '30 minutes');
  insert into public.series (id, sessao_id, exercicio_id, ordem_exercicio, ordem, carga_kg, reps, concluida_em) values (s1, sa, 'supino-reto-barra', 0, 0, 50, 10, now())
    on conflict (id) do update set carga_kg = excluded.carga_kg, reps = excluded.reps;
  insert into public.series (id, sessao_id, exercicio_id, ordem_exercicio, ordem, carga_kg, reps, concluida_em) values (s1, sa, 'supino-reto-barra', 0, 0, 52.5, 9, now())
    on conflict (id) do update set carga_kg = excluded.carga_kg, reps = excluded.reps;
  select count(*) into n from public.series; if n <> 1 then raise exception 'FALHOU: reenvio duplicou série (%)', n; end if; ok := ok + 1;
  select count(*) into n from public.series where carga_kg = 52.5; if n <> 1 then raise exception 'FALHOU: reenvio não atualizou a série'; end if; ok := ok + 1;

  erro := false; begin update public.sessoes set finalizada_em = now() where id = sa; exception when check_violation then erro := true; end;
  if not erro then raise exception 'FALHOU: sessão em andamento aceitou data de fim'; end if; ok := ok + 1;
  update public.sessoes set status = 'concluida', finalizada_em = now(), series_concluidas = 1, volume_kg = 472.5 where id = sa; ok := ok + 1;

  -- aluno B
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.sessoes; if n <> 0 then raise exception 'FALHOU: B viu sessão de A'; end if; ok := ok + 1;
  select count(*) into n from public.series; if n <> 0 then raise exception 'FALHOU: B viu séries de A'; end if; ok := ok + 1;
  erro := false; begin insert into public.series (id, sessao_id, exercicio_id, ordem_exercicio, ordem, reps, concluida_em) values (gen_random_uuid(), sa, 'flexao', 0, 1, 10, now()); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: B colocou série na sessão de A'; end if; ok := ok + 1;
  erro := false; begin insert into public.series (id, sessao_id, user_id, exercicio_id, ordem_exercicio, ordem, reps, concluida_em) values (gen_random_uuid(), sa, a, 'flexao', 0, 1, 10, now()); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: B gravou série em nome de A'; end if; ok := ok + 1;
  update public.sessoes set volume_kg = 0 where id = sa; get diagnostics n = row_count; if n <> 0 then raise exception 'FALHOU: B editou sessão de A'; end if; ok := ok + 1;

  -- professor P lê, não escreve
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.series where user_id = a; if n <> 1 then raise exception 'FALHOU: professor não vê séries do aluno'; end if; ok := ok + 1;
  update public.sessoes set volume_kg = 0 where id = sa; get diagnostics n = row_count; if n <> 0 then raise exception 'FALHOU: professor editou treino do aluno'; end if; ok := ok + 1;

  -- admin e anônimo
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.sessoes; if n <> 0 then raise exception 'FALHOU: admin leu treinos'; end if; ok := ok + 1;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  select count(*) into n from public.series; if n <> 0 then raise exception 'FALHOU: anônimo leu séries'; end if; ok := ok + 1;

  raise exception 'RLS_OK: % verificações passaram (transação desfeita de propósito)', ok;
end;
$$;

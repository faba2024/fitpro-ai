-- Testes de RLS de medidas, fotos e do bucket privado (etapa 9). Sucesso = "RLS_OK"; nada fica gravado.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); p uuid := gen_random_uuid();
  x uuid; n int; ok int := 0; erro boolean;
  arq_a text; arq_b text;
begin
  arq_a := a::text || '/' || gen_random_uuid()::text || '.jpg';
  arq_b := b::text || '/' || gen_random_uuid()::text || '.jpg';
  insert into auth.users (id, email, aud, role) values
    (a, 'ea@teste.local', 'authenticated', 'authenticated'), (b, 'eb@teste.local', 'authenticated', 'authenticated'), (p, 'ep@teste.local', 'authenticated', 'authenticated');
  insert into public.academias (nome, slug) values ('Academia Teste', 'academia-teste-evolucao') returning id into x;
  insert into public.membros_academia (academia_id, user_id, papel) values (x, p, 'professor');
  insert into public.membros_academia (academia_id, user_id, papel, professor_id) values (x, a, 'aluno', p);

  -- aluno A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.medidas (data, peso_kg, cintura_cm) values ('2026-10-01', 80, 90);
  insert into public.medidas (data, peso_kg) values ('2026-10-01', 79.5) on conflict (user_id, data) do update set peso_kg = excluded.peso_kg;
  select count(*) into n from public.medidas; if n <> 1 then raise exception 'FALHOU: mesmo dia deveria atualizar, há % linhas', n; end if; ok := ok + 1;
  erro := false; begin insert into public.medidas (data) values ('2026-10-02'); exception when check_violation then erro := true; end;
  if not erro then raise exception 'FALHOU: aceitou medida vazia'; end if; ok := ok + 1;

  insert into storage.objects (bucket_id, name, owner) values ('fotos-evolucao', arq_a, a); ok := ok + 1;
  erro := false; begin insert into storage.objects (bucket_id, name, owner) values ('fotos-evolucao', arq_b, a); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: A enviou arquivo para a pasta de B'; end if; ok := ok + 1;
  insert into public.fotos (data, pose, caminho) values ('2026-10-01', 'frente', arq_a); ok := ok + 1;
  erro := false; begin insert into public.fotos (data, pose, caminho) values ('2026-10-01', 'lado', arq_b); exception when check_violation then erro := true; end;
  if not erro then raise exception 'FALHOU: A registrou foto da pasta de B'; end if; ok := ok + 1;

  -- aluno B
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.medidas; if n <> 0 then raise exception 'FALHOU: B leu medidas de A'; end if; ok := ok + 1;
  select count(*) into n from public.fotos; if n <> 0 then raise exception 'FALHOU: B leu fotos de A'; end if; ok := ok + 1;
  select count(*) into n from storage.objects where bucket_id = 'fotos-evolucao'; if n <> 0 then raise exception 'FALHOU: B viu arquivo de A'; end if; ok := ok + 1;
  -- apagar arquivo de outra pessoa: o Supabase bloqueia DELETE direto em storage.objects (só pela API de Storage,
  -- onde vale a policy "fotos-evolucao: dono apaga"), então esse caso não dá para testar por SQL.

  -- professor P: lê medidas do aluno, mas NÃO as fotos
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.medidas where user_id = a; if n <> 1 then raise exception 'FALHOU: professor não vê medidas do aluno'; end if; ok := ok + 1;
  select count(*) into n from public.fotos; if n <> 0 then raise exception 'FALHOU: professor viu fotos do aluno'; end if; ok := ok + 1;
  select count(*) into n from storage.objects where bucket_id = 'fotos-evolucao'; if n <> 0 then raise exception 'FALHOU: professor viu arquivo de foto'; end if; ok := ok + 1;
  update public.medidas set peso_kg = 100 where user_id = a; get diagnostics n = row_count; if n <> 0 then raise exception 'FALHOU: professor editou medida'; end if; ok := ok + 1;

  -- anônimo
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  select count(*) into n from public.medidas; if n <> 0 then raise exception 'FALHOU: anônimo leu medidas'; end if; ok := ok + 1;
  select count(*) into n from storage.objects where bucket_id = 'fotos-evolucao'; if n <> 0 then raise exception 'FALHOU: anônimo viu arquivo'; end if; ok := ok + 1;

  raise exception 'RLS_OK: % verificações passaram (transação desfeita de propósito)', ok;
end;
$$;

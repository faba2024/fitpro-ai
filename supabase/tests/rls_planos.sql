-- Testes de RLS e regras das fichas (etapa 7). Sucesso = "RLS_OK"; nada fica gravado.
do $$
declare
  a uuid := gen_random_uuid();  -- aluno do professor P
  b uuid := gen_random_uuid();  -- outro aluno
  p uuid := gen_random_uuid();  -- professor
  d uuid := gen_random_uuid();  -- admin
  x uuid;
  pa1 uuid; pa2 uuid; pb uuid;
  est jsonb := '[{"id":"s1","nome":"A","titulo":"Treino","itens":[{"exercicioId":"flexao","series":3,"repsMin":8,"repsMax":12,"descansoS":60}]}]';
  n int; ok int := 0; erro boolean; r record;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'pa@teste.local', 'authenticated', 'authenticated'), (b, 'pb@teste.local', 'authenticated', 'authenticated'),
    (p, 'pp@teste.local', 'authenticated', 'authenticated'), (d, 'pd@teste.local', 'authenticated', 'authenticated');
  insert into public.academias (nome, slug) values ('Academia Teste', 'academia-teste-planos') returning id into x;
  insert into public.membros_academia (academia_id, user_id, papel, professor_id) values
    (x, a, 'aluno', p), (x, b, 'aluno', null), (x, p, 'professor', null), (x, d, 'admin', null);
  insert into public.planos (aluno_id, criado_por, nome, objetivo, estrutura) values (b, b, 'Ficha B', 'saude', est) returning id into pb;

  -- aluno A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.planos (aluno_id, nome, objetivo, estrutura) values (a, 'Ficha 1', 'hipertrofia', est) returning id into pa1;
  insert into public.planos (aluno_id, nome, objetivo, estrutura) values (a, 'Ficha 2', 'hipertrofia', est) returning id into pa2;
  select count(*) into n from public.planos where ativo; if n <> 1 then raise exception 'FALHOU: deveria haver 1 ficha ativa, há %', n; end if; ok := ok + 1;
  select count(*) into n from public.planos where id = pa2 and ativo; if n <> 1 then raise exception 'FALHOU: a ficha nova deveria ser a ativa'; end if; ok := ok + 1;

  erro := false; begin insert into public.planos (aluno_id, nome, objetivo, estrutura) values (b, 'Intrusa', 'saude', est); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: A criou ficha para B'; end if; ok := ok + 1;

  erro := false; begin update public.planos set revisado_por = a, revisado_em = now() where id = pa2; exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: aluno marcou a própria ficha como revisada'; end if; ok := ok + 1;

  update public.planos set nome = 'x' where id = pb; get diagnostics n = row_count; if n <> 0 then raise exception 'FALHOU: A editou ficha de B'; end if; ok := ok + 1;

  erro := false; begin update public.planos set aluno_id = b where id = pa2; exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: A transferiu a ficha para B'; end if; ok := ok + 1;

  erro := false; begin insert into public.planos (aluno_id, nome, objetivo, estrutura) values (a, 'Vazia', 'saude', '[]'); exception when check_violation then erro := true; end;
  if not erro then raise exception 'FALHOU: aceitou ficha sem treinos'; end if; ok := ok + 1;

  -- professor P
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.planos where aluno_id = a; if n <> 2 then raise exception 'FALHOU: professor deveria ver 2 fichas do aluno, viu %', n; end if; ok := ok + 1;
  select count(*) into n from public.planos where aluno_id = b; if n <> 0 then raise exception 'FALHOU: professor viu ficha de quem não é aluno dele'; end if; ok := ok + 1;
  update public.planos set revisado_por = p, revisado_em = now(), observacao_profissional = 'Ok' where id = pa2;
  get diagnostics n = row_count; if n <> 1 then raise exception 'FALHOU: professor não conseguiu revisar'; end if; ok := ok + 1;
  erro := false; begin insert into public.planos (aluno_id, nome, objetivo, estrutura) values (b, 'Intrusa', 'saude', est); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: professor criou ficha para aluno de outro'; end if; ok := ok + 1;

  -- aluno A edita a ficha revisada → revisão desfeita
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.planos set estrutura = jsonb_set(est, '{0,itens,0,series}', '4') where id = pa2;
  select revisado_por, revisado_em into r from public.planos where id = pa2;
  if r.revisado_por is not null or r.revisado_em is not null then raise exception 'FALHOU: edição do aluno manteve a revisão'; end if; ok := ok + 1;
  update public.planos set nome = 'Renomeada' where id = pa2; ok := ok + 1;

  -- admin D
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.planos; if n <> 0 then raise exception 'FALHOU: admin leu fichas (dados de treino/saúde)'; end if; ok := ok + 1;

  -- anônimo
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  select count(*) into n from public.planos; if n <> 0 then raise exception 'FALHOU: anônimo leu fichas'; end if; ok := ok + 1;

  raise exception 'RLS_OK: % verificações passaram (transação desfeita de propósito)', ok;
end;
$$;

-- Testes de RLS da etapa 4. Rode no SQL Editor do Supabase (ou via MCP).
-- Tudo acontece dentro de um bloco que termina com exceção proposital:
-- nada fica gravado. Sucesso = mensagem "RLS_OK: ...". Falha = "FALHOU: ...".
do $$
declare
  a uuid := gen_random_uuid();  -- aluno do professor P
  b uuid := gen_random_uuid();  -- outro aluno, sem professor
  p uuid := gen_random_uuid();  -- professor
  d uuid := gen_random_uuid();  -- admin
  x uuid;                       -- academia
  n int;
  ok int := 0;
  erro boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'a@teste.local', 'authenticated', 'authenticated'),
    (b, 'b@teste.local', 'authenticated', 'authenticated'),
    (p, 'p@teste.local', 'authenticated', 'authenticated'),
    (d, 'd@teste.local', 'authenticated', 'authenticated');

  insert into public.academias (nome, slug) values ('Academia Teste', 'academia-teste') returning id into x;
  -- o professor entra antes: o vínculo do aluno exige um professor ativo (etapa 11)
  insert into public.membros_academia (academia_id, user_id, papel) values (x, p, 'professor'), (x, d, 'admin');
  insert into public.membros_academia (academia_id, user_id, papel, professor_id) values (x, a, 'aluno', p), (x, b, 'aluno', null);

  insert into public.perfis (id, nome, data_nascimento, altura_cm, peso_kg, objetivo, nivel, dias_semana, minutos_sessao, limitacoes, consentimento_termos_em, consentimento_saude_em)
  values
    (a, 'Aluno A', '1995-01-01', 175, 78, 'hipertrofia', 'iniciante', 3, 60, 'dor no joelho', now(), now()),
    (b, 'Aluno B', '1990-01-01', 165, 62, 'saude', 'intermediario', 4, 45, '', now(), now());

  -- ── aluno A ──
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.perfis;
  if n <> 1 then raise exception 'FALHOU: aluno A deveria ver só o próprio perfil, viu %', n; end if;
  ok := ok + 1;

  update public.perfis set nome = 'hackeado' where id = b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: aluno A editou o perfil de B'; end if;
  ok := ok + 1;

  erro := false;
  begin
    insert into public.perfis (id, nome, data_nascimento, altura_cm, peso_kg, objetivo, nivel, dias_semana, minutos_sessao, consentimento_termos_em, consentimento_saude_em)
    values (p, 'Falso', '1990-01-01', 170, 70, 'saude', 'iniciante', 3, 60, now(), now());
  exception when insufficient_privilege then erro := true;
  end;
  if not erro then raise exception 'FALHOU: aluno A criou perfil para outra pessoa'; end if;
  ok := ok + 1;

  erro := false;
  begin
    insert into public.membros_academia (academia_id, user_id, papel) values (x, a, 'admin');
  exception when insufficient_privilege then erro := true;
  end;
  if not erro then raise exception 'FALHOU: aluno A se promoveu a admin'; end if;
  ok := ok + 1;

  select count(*) into n from public.membros_academia;
  if n <> 1 then raise exception 'FALHOU: aluno A deveria ver só o próprio vínculo, viu %', n; end if;
  ok := ok + 1;

  -- ── professor P ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.perfis where id = a;
  if n <> 1 then raise exception 'FALHOU: professor não vê o perfil do próprio aluno'; end if;
  ok := ok + 1;

  select count(*) into n from public.perfis where id = b;
  if n <> 0 then raise exception 'FALHOU: professor vê aluno que não é dele'; end if;
  ok := ok + 1;

  update public.perfis set limitacoes = '' where id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHOU: professor editou o perfil do aluno'; end if;
  ok := ok + 1;

  -- ── admin D ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.perfis;
  if n <> 0 then raise exception 'FALHOU: admin não deveria ler dados de saúde dos alunos, viu %', n; end if;
  ok := ok + 1;

  select count(*) into n from public.membros_academia where academia_id = x;
  if n <> 4 then raise exception 'FALHOU: admin deveria ver os 4 membros, viu %', n; end if;
  ok := ok + 1;

  update public.membros_academia set professor_id = p where user_id = b and papel = 'aluno';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FALHOU: admin não conseguiu vincular aluno ao professor'; end if;
  ok := ok + 1;

  -- ── anônimo ──
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';

  select count(*) into n from public.perfis;
  if n <> 0 then raise exception 'FALHOU: anônimo leu perfis'; end if;
  ok := ok + 1;

  erro := false;
  begin
    perform public.excluir_minha_conta();
  exception when insufficient_privilege then erro := true;
  end;
  if not erro then raise exception 'FALHOU: anônimo executou excluir_minha_conta'; end if;
  ok := ok + 1;

  -- ── aluno B exclui a própria conta ──
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.excluir_minha_conta();
  execute 'reset role';

  select count(*) into n from public.perfis where id = b;
  if n <> 0 then raise exception 'FALHOU: perfil de B continuou depois da exclusão'; end if;
  select count(*) into n from public.membros_academia where user_id = b;
  if n <> 0 then raise exception 'FALHOU: vínculo de B continuou depois da exclusão'; end if;
  select count(*) into n from public.perfis where id = a;
  if n <> 1 then raise exception 'FALHOU: excluir B apagou outro perfil'; end if;
  ok := ok + 1;

  raise exception 'RLS_OK: % verificações passaram (transação desfeita de propósito)', ok;
end;
$$;

-- Testes da etapa 11 (academia, convites, vínculos e pagamentos). Sucesso = "RLS_OK"; nada fica gravado.
do $$
declare
  d uuid := gen_random_uuid();  -- dono/admin
  p uuid := gen_random_uuid();  -- professor
  a uuid := gen_random_uuid();  -- aluno
  o uuid := gen_random_uuid();  -- outra pessoa (sem vínculo)
  x uuid; cod text; cod_prof text; n int; ok int := 0; erro boolean; r record;
begin
  insert into auth.users (id, email, aud, role) values
    (d, 'ad@teste.local', 'authenticated', 'authenticated'), (p, 'ap@teste.local', 'authenticated', 'authenticated'),
    (a, 'aa@teste.local', 'authenticated', 'authenticated'), (o, 'ao@teste.local', 'authenticated', 'authenticated');
  insert into public.perfis (id, nome, data_nascimento, altura_cm, peso_kg, objetivo, nivel, dias_semana, minutos_sessao, limitacoes, consentimento_termos_em, consentimento_saude_em)
  values (a, 'Aluna Teste', '1995-01-01', 165, 60, 'saude', 'iniciante', 3, 45, 'dor lombar', now(), now());

  -- dono cria a academia e convida um professor
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  x := public.criar_academia('Academia Teste', 'academia-teste-painel');
  select count(*) into n from public.membros_academia where academia_id = x and user_id = d and papel = 'admin';
  if n <> 1 then raise exception 'FALHOU: quem cria não virou admin'; end if; ok := ok + 1;
  cod_prof := public.criar_convite(x, 'professor', 1, 7);

  erro := false; begin insert into public.membros_academia (academia_id, user_id, papel) values (x, o, 'aluno'); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: admin adicionou membro sem convite'; end if; ok := ok + 1;

  erro := false; begin update public.membros_academia set ativo = false where academia_id = x and user_id = d; exception when check_violation then erro := true; end;
  if not erro then raise exception 'FALHOU: academia ficou sem admin'; end if; ok := ok + 1;

  -- professor entra pelo convite e convida um aluno (já vinculado a ele)
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select * into r from public.aceitar_convite(lower(cod_prof));
  if r.papel <> 'professor' then raise exception 'FALHOU: convite de professor'; end if; ok := ok + 1;
  erro := false; begin perform public.aceitar_convite(cod_prof); exception when no_data_found then erro := true; end;
  if not erro then raise exception 'FALHOU: convite de 1 uso foi usado duas vezes'; end if; ok := ok + 1;
  erro := false; begin perform public.criar_convite(x, 'professor', 1, 7); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: professor convidou professor'; end if; ok := ok + 1;
  cod := public.criar_convite(x, 'aluno', 5, 7);

  -- aluno entra; o professor passa a ver o perfil
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.aceitar_convite(cod);
  select * into r from public.minhas_academias();
  if r.professor_id <> p then raise exception 'FALHOU: aluno não ficou com o professor do convite'; end if; ok := ok + 1;
  erro := false; begin update public.membros_academia set professor_id = null where user_id = a; get diagnostics n = row_count; if n = 0 then erro := true; end if; end;
  if not erro then raise exception 'FALHOU: aluno trocou o próprio professor'; end if; ok := ok + 1;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.perfis where id = a; if n <> 1 then raise exception 'FALHOU: professor não vê o aluno'; end if; ok := ok + 1;

  -- admin: vê só nomes, não lê perfil; registra pagamento só de aluno da academia
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.perfis where id = a; if n <> 0 then raise exception 'FALHOU: admin leu o perfil (saúde) do aluno'; end if; ok := ok + 1;
  select count(*) into n from public.membros_da_academia(x) m where m.nome = 'Aluna Teste'; if n <> 1 then raise exception 'FALHOU: admin não vê o nome do aluno'; end if; ok := ok + 1;
  insert into public.pagamentos (academia_id, aluno_id, competencia, valor, forma) values (x, a, date_trunc('month', now())::date, 120, 'pix');
  erro := false; begin insert into public.pagamentos (academia_id, aluno_id, competencia, valor, forma) values (x, o, date_trunc('month', now())::date, 120, 'pix'); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: pagamento de quem não é aluno'; end if; ok := ok + 1;
  erro := false; begin update public.membros_academia set papel = 'admin' where user_id = a; exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: admin trocou o papel de um vínculo'; end if; ok := ok + 1;
  erro := false; begin update public.membros_academia set professor_id = o where user_id = a; exception when check_violation then erro := true; end;
  if not erro then raise exception 'FALHOU: professor_id de quem não é professor'; end if; ok := ok + 1;

  -- outra pessoa: não vê nada da academia
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.convites; if n <> 0 then raise exception 'FALHOU: estranho viu convites'; end if; ok := ok + 1;
  select count(*) into n from public.pagamentos; if n <> 0 then raise exception 'FALHOU: estranho viu pagamentos'; end if; ok := ok + 1;
  erro := false; begin perform public.membros_da_academia(x); exception when insufficient_privilege then erro := true; end;
  if not erro then raise exception 'FALHOU: estranho listou membros'; end if; ok := ok + 1;

  -- aluno vê o próprio pagamento e sai da academia; professor perde o acesso
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.pagamentos; if n <> 1 then raise exception 'FALHOU: aluno não vê o próprio pagamento'; end if; ok := ok + 1;
  delete from public.membros_academia where academia_id = x and user_id = a;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.perfis where id = a; if n <> 0 then raise exception 'FALHOU: professor ainda vê quem saiu'; end if; ok := ok + 1;

  -- professor desativado: alunos dele ficam sem professor
  execute 'reset role';
  insert into public.membros_academia (academia_id, user_id, papel, professor_id) values (x, o, 'aluno', p);
  update public.membros_academia set ativo = false where academia_id = x and user_id = p;
  select professor_id into r from public.membros_academia where academia_id = x and user_id = o;
  if r.professor_id is not null then raise exception 'FALHOU: aluno continuou com professor desativado'; end if; ok := ok + 1;

  -- o único admin ainda consegue excluir a própria conta (LGPD); a academia fica sem admin
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.excluir_minha_conta();
  execute 'reset role';
  select count(*) into n from public.membros_academia where user_id = d; if n <> 0 then raise exception 'FALHOU: admin único não excluiu a conta'; end if; ok := ok + 1;

  raise exception 'RLS_OK: % verificações', ok;
end;
$$;

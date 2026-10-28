-- Etapa 9: medidas corporais, meta de peso e fotos de evolução.
-- Medidas: dono lê e escreve; professor do aluno lê. Fotos: SÓ o dono (dado sensível),
-- em bucket privado, uma pasta por usuário; o app mostra com URL assinada de curta duração.

alter table public.perfis add column meta_peso_kg numeric(5, 1) check (meta_peso_kg between 30 and 300);

create table public.medidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  peso_kg numeric(5, 1) check (peso_kg between 30 and 300),
  gordura_pct numeric(4, 1) check (gordura_pct between 2 and 70),
  cintura_cm numeric(5, 1) check (cintura_cm between 40 and 200),
  quadril_cm numeric(5, 1) check (quadril_cm between 50 and 200),
  peito_cm numeric(5, 1) check (peito_cm between 50 and 200),
  braco_cm numeric(4, 1) check (braco_cm between 15 and 70),
  coxa_cm numeric(5, 1) check (coxa_cm between 30 and 100),
  panturrilha_cm numeric(4, 1) check (panturrilha_cm between 20 and 70),
  criado_em timestamptz not null default now(),
  unique (user_id, data),
  check (coalesce(peso_kg, gordura_pct, cintura_cm, quadril_cm, peito_cm, braco_cm, coxa_cm, panturrilha_cm) is not null)
);

alter table public.medidas enable row level security;
create policy "medidas: dono lê" on public.medidas for select to authenticated using (user_id = (select auth.uid()));
create policy "medidas: professor lê" on public.medidas for select to authenticated using (privado.eh_professor_do_aluno(user_id));
create policy "medidas: dono cria" on public.medidas for insert to authenticated with check (user_id = (select auth.uid()));
create policy "medidas: dono edita" on public.medidas for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "medidas: dono apaga" on public.medidas for delete to authenticated using (user_id = (select auth.uid()));

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  pose text not null check (pose in ('frente', 'lado', 'costas')),
  caminho text not null unique check (caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  criado_em timestamptz not null default now(),
  -- o arquivo precisa estar na pasta do próprio usuário
  check (split_part(caminho, '/', 1) = user_id::text)
);

alter table public.fotos enable row level security;
create policy "fotos: dono lê" on public.fotos for select to authenticated using (user_id = (select auth.uid()));
create policy "fotos: dono cria" on public.fotos for insert to authenticated with check (user_id = (select auth.uid()));
create policy "fotos: dono apaga" on public.fotos for delete to authenticated using (user_id = (select auth.uid()));

-- bucket privado: até 5 MB, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-evolucao', 'fotos-evolucao', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "fotos-evolucao: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'fotos-evolucao' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos-evolucao: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-evolucao' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos-evolucao: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-evolucao' and (storage.foldername(name))[1] = (select auth.uid())::text);

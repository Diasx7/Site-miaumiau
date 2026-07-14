-- ========================================================
-- COLA ESSE ARQUIVO TODO NO "SQL EDITOR" DO SUPABASE E RODA
-- ========================================================

-- tabela com os itens do cardapio
create table pratos (
  id bigint generated always as identity primary key,
  nome text not null,
  descricao text,
  preco numeric not null,
  categoria text not null check (categoria in ('burger', 'espetinho')),
  foto_url text,
  disponivel boolean default true,
  ordem int default 0,
  criado_em timestamp default now()
);

-- liga a seguranca por linha (RLS) - sem isso, qualquer chave pode mexer em tudo
alter table pratos enable row level security;

-- qualquer visitante do site pode LER os pratos (precisa, é o site publico)
create policy "leitura publica dos pratos"
on pratos for select
using (true);

-- só usuario logado (o dono, autenticado pelo painel admin) pode criar
create policy "admin pode criar prato"
on pratos for insert
with check (auth.role() = 'authenticated');

-- só usuario logado pode editar
create policy "admin pode editar prato"
on pratos for update
using (auth.role() = 'authenticated');

-- só usuario logado pode excluir
create policy "admin pode excluir prato"
on pratos for delete
using (auth.role() = 'authenticated');


-- ========================================================
-- REGRAS DE ACESSO DAS FOTOS (STORAGE)
-- antes de rodar essa parte, cria o bucket "fotos-cardapio"
-- em Storage > New bucket > marca como "Public bucket"
-- ========================================================

create policy "leitura publica das fotos"
on storage.objects for select
using ( bucket_id = 'fotos-cardapio' );

create policy "admin pode enviar foto"
on storage.objects for insert
with check ( bucket_id = 'fotos-cardapio' and auth.role() = 'authenticated' );

create policy "admin pode excluir foto"
on storage.objects for delete
using ( bucket_id = 'fotos-cardapio' and auth.role() = 'authenticated' );


-- ========================================================
-- TABELA DE CONFIGURACOES DO SITE (cidade, whatsapp, endereco...)
-- so tem uma linha, com id fixo = 1
-- ========================================================

create table configuracoes (
  id bigint primary key,
  cidade text,
  whatsapp text,
  endereco text,
  horario_semana text,
  horario_fds text,
  dia_folga text,
  instagram text,
  facebook text,
  mapa_embed text
);

alter table configuracoes enable row level security;

-- qualquer visitante do site pode LER as configuracoes
create policy "leitura publica das configuracoes"
on configuracoes for select
using (true);

-- só usuario logado pode editar as configuracoes
create policy "admin pode editar configuracoes"
on configuracoes for update
using (auth.role() = 'authenticated');

-- cria a linha unica (id = 1) ja vazia, pra so dar update nela depois
insert into configuracoes (id) values (1);

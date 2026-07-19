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


-- ========================================================
-- TABELA DE FOTOS DA FACHADA (carrossel na secao Sobre)
-- ========================================================

create table fotos_fachada (
  id bigint generated always as identity primary key,
  foto_url text not null,
  ordem int default 0,
  criado_em timestamp default now()
);

alter table fotos_fachada enable row level security;

-- qualquer visitante pode ver as fotos
create policy "leitura publica das fotos da fachada"
on fotos_fachada for select
using (true);

-- só usuario logado pode enviar foto nova
create policy "admin pode inserir foto da fachada"
on fotos_fachada for insert
with check (auth.role() = 'authenticated');

-- só usuario logado pode excluir foto
create policy "admin pode excluir foto da fachada"
on fotos_fachada for delete
using (auth.role() = 'authenticated');


-- ========================================================
-- TABELA DE COMBOS (banner de combo em rotacao no site)
-- ========================================================

create table combos (
  id bigint generated always as identity primary key,
  nome text not null,
  descricao text,
  preco numeric not null,
  disponivel boolean default true,
  ordem int default 0
);

alter table combos enable row level security;

-- qualquer visitante pode ver os combos
create policy "leitura publica dos combos"
on combos for select
using (true);

-- só usuario logado pode criar combo
create policy "admin pode criar combo"
on combos for insert
with check (auth.role() = 'authenticated');

-- só usuario logado pode editar combo
create policy "admin pode editar combo"
on combos for update
using (auth.role() = 'authenticated');

-- só usuario logado pode excluir combo
create policy "admin pode excluir combo"
on combos for delete
using (auth.role() = 'authenticated');


-- ========================================================
-- CAMPO NOVO NA TABELA CONFIGURACOES: TELEFONE FIXO
-- ========================================================

alter table configuracoes add column telefone text;


-- ========================================================
-- TABELA DE AVALIACOES DE CLIENTES (com moderacao do dono)
-- ========================================================

create table avaliacoes (
  id bigint generated always as identity primary key,
  nome text not null,
  estrelas int not null check (estrelas between 1 and 5),
  comentario text not null,
  aprovado boolean default false,
  criado_em timestamp default now()
);

alter table avaliacoes enable row level security;

-- visitante do site so ve as avaliacoes ja aprovadas (pendente nao pode vazar pela API)
create policy "leitura publica das avaliacoes aprovadas"
on avaliacoes for select
using (aprovado = true);

-- admin logado ve todas, inclusive as pendentes, pra poder moderar no painel
create policy "admin ve todas as avaliacoes"
on avaliacoes for select
using (auth.role() = 'authenticated');

-- qualquer visitante pode enviar uma avaliacao, mas sempre entra como nao aprovada
create policy "visitante pode enviar avaliacao"
on avaliacoes for insert
with check (aprovado = false);

-- só usuario logado pode aprovar (é um update mudando aprovado pra true)
create policy "admin pode aprovar avaliacao"
on avaliacoes for update
using (auth.role() = 'authenticated');

-- só usuario logado pode excluir
create policy "admin pode excluir avaliacao"
on avaliacoes for delete
using (auth.role() = 'authenticated');


-- ========================================================
-- TABELA DE ADICIONAIS (bebidas e molhos do pedido)
-- ========================================================

create table adicionais (
  id bigint generated always as identity primary key,
  nome text not null,
  tipo text not null check (tipo in ('bebida', 'molho')),
  preco numeric default 0,
  disponivel boolean default true,
  ordem int default 0
);

alter table adicionais enable row level security;

-- qualquer visitante pode ver os adicionais (precisa aparecer no modal do site)
create policy "leitura publica dos adicionais"
on adicionais for select
using (true);

-- só usuario logado pode criar adicional
create policy "admin pode criar adicional"
on adicionais for insert
with check (auth.role() = 'authenticated');

-- só usuario logado pode editar adicional
create policy "admin pode editar adicional"
on adicionais for update
using (auth.role() = 'authenticated');

-- só usuario logado pode excluir adicional
create policy "admin pode excluir adicional"
on adicionais for delete
using (auth.role() = 'authenticated');

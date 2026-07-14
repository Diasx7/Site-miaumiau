# Miau Miau Burgers & Espetinhos

Site de hamburgueria e espetaria com cardápio dinâmico e painel administrativo.

O dono do estabelecimento consegue adicionar, editar e remover itens do cardápio
pelo painel, sem precisar mexer em código. As informações do site (endereço,
horário, contato, redes sociais) também são editáveis pelo painel.

## Como funciona

- **Site público** (`index.html`): mostra o cardápio, informações e contato.
  Os dados vêm do banco em tempo real.
- **Painel admin** (`admin.html`): protegido por login. Gerencia o cardápio
  (com upload de fotos) e as informações do estabelecimento.

## Tecnologias

- HTML, CSS e JavaScript puro
- Supabase (banco Postgres, autenticação e storage das fotos)
- Hospedagem na Vercel

## Rodando local

1. Cria um projeto no Supabase e roda o `schema.sql` no SQL Editor
2. Cria o bucket `fotos-cardapio` no Storage (público)
3. Cria um usuário em Authentication > Users
4. Preenche a URL e a chave anon do projeto no `config.js`
5. Sobe um servidor local na pasta:

```bash
npx serve -p 8000
```

O site fica em `localhost:8000` e o painel em `localhost:8000/admin.html`.

## Estrutura

```
index.html      site público
admin.html      painel administrativo
script.js       lógica do site público
admin.js        lógica do painel
config.js       chaves do Supabase
schema.sql      estrutura do banco e regras de acesso
style.css       estilo do site
admin.css       estilo do painel
img/            logo
```

# Miau Miau Burgers & Espetinhos

Site de hamburgueria e espetaria com cardápio dinâmico, pedidos pelo WhatsApp
e painel administrativo completo. O dono gerencia tudo sozinho pelo painel,
sem mexer em código.

## O que o site faz

**Pro cliente:**
- Cardápio com fotos, separado em burgers e espetinhos
- Clicou no prato, abre o detalhe com foto, descrição e preço
- Escolhe bebida e molho no pedido, com total calculado na hora
- Faz o pedido direto pelo WhatsApp, com mensagem pronta e código de referência
- Combos da casa em destaque, em rotação automática
- Fotos do local em carrossel
- Avaliações de outros clientes e formulário pra deixar a sua

**Pro dono (painel em /admin.html, protegido por login):**
- Cadastra, edita e remove itens do cardápio, com upload de foto
- Marca item como disponível ou esgotado na hora
- Gerencia combos, bebidas e molhos
- Modera as avaliações dos clientes (aprova ou exclui antes de aparecer no site)
- Edita as informações do site: endereço, horários, WhatsApp, telefone,
  redes sociais e mapa
- Sobe fotos da fachada

## Tecnologias

- HTML, CSS e JavaScript puro
- Supabase (banco Postgres, autenticação, storage de fotos e regras de
  acesso via RLS)
- Hospedagem na Vercel com deploy automático a cada push

## Rodando local

1. Cria um projeto no Supabase e roda o `schema.sql` inteiro no SQL Editor
2. Cria o bucket `fotos-cardapio` no Storage (marcado como público)
3. Cria o usuário do painel em Authentication > Users (marca Auto Confirm)
4. Preenche a URL e a chave publishable do projeto no `config.js`
5. Sobe um servidor local:

```bash
npx serve -p 8000
```

Site em `localhost:8000`, painel em `localhost:8000/admin.html`.

## Estrutura

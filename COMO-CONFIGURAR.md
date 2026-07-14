# Como colocar o cardápio dinâmico pra funcionar

## 1. Cria a conta no Supabase
Vai em supabase.com, cria conta de graça, e cria um projeto novo
(pode chamar de "miau-miau" ou o nome que quiser).

## 2. Roda o schema.sql
No menu do projeto, abre o "SQL Editor", cola o conteúdo do arquivo
`schema.sql` (esse aqui na pasta) e clica em Run.
Isso cria a tabela `pratos` e já deixa as regras de acesso certas.

## 3. Cria o bucket das fotos
No menu do projeto, vai em "Storage" > "New bucket".
Nome do bucket: `fotos-cardapio`
Marca a opção "Public bucket".

Depois disso, volta no SQL Editor e roda a segunda parte do `schema.sql`
(a parte que tem "REGRAS DE ACESSO DAS FOTOS"), caso ainda não tenha rodado.

## 4. Cria o login do dono da hamburgueria
Vai em "Authentication" > "Users" > "Add user".
Cria um usuário com o email e senha que o dono vai usar pra entrar no painel.
Esse é o login dele, não precisa de cadastro nem confirmação por email.

## 5. Pega a URL e a chave do projeto
Vai em "Project Settings" > "API".
Copia o "Project URL" e a chave "anon public".

Abre o arquivo `config.js` e cola os dois valores:

```js
const SUPABASE_URL = "https://seu-projeto.supabase.co";
const SUPABASE_ANON_KEY = "sua-chave-aqui";
```

## 6. Sobe pro GitHub e Vercel
Mesmo passo de sempre:

```bash
git init
git add .
git commit -m "cardapio dinamico com painel admin"
git push
```

Depois importa o repositório no Vercel e publica.

## 7. Manda pro dono
O site normal fica em `seusite.vercel.app`.
O painel fica em `seusite.vercel.app/admin.html`.
Manda esse link + o email/senha que você criou no passo 4 pro dono usar.

---

### Detalhe importante
A chave `SUPABASE_ANON_KEY` é pública mesmo, pode ficar no código sem
problema. Quem protege o banco de dados são as regras (RLS) que ficam
no `schema.sql` — só usuário logado consegue criar, editar ou excluir
prato. Visitante comum só consegue ler o que tá disponível.

NUNCA cola a chave "service_role" do Supabase em nenhum arquivo desses.
Essa outra chave dá acesso total ao banco e não pode aparecer em
código que vai pro navegador.

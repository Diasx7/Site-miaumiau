// conecta no supabase usando as chaves do config.js
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const telaLogin = document.getElementById('tela-login');
const telaPainel = document.getElementById('tela-painel');
const formLogin = document.getElementById('form-login');
const erroLogin = document.getElementById('erro-login');
const btnSair = document.getElementById('btn-sair');

const formPrato = document.getElementById('form-prato');
const listaPratos = document.getElementById('lista-pratos');
const tituloForm = document.getElementById('titulo-form');
const btnCancelarEdicao = document.getElementById('btn-cancelar-edicao');
const msgForm = document.getElementById('msg-form');

let editandoId = null; // quando nao for null, o formulario esta editando esse prato

// quando a pagina abre, ve se ja tem login feito antes
sb.auth.getSession().then(function(resp){
  if(resp.data.session){ mostrarPainel(); } else { mostrarLogin(); }
});

formLogin.addEventListener('submit', async function(e){
  e.preventDefault();
  erroLogin.textContent = '';
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;

  const { error } = await sb.auth.signInWithPassword({ email: email, password: senha });
  if(error){
    erroLogin.textContent = 'Email ou senha errados. Tenta de novo.';
    return;
  }
  mostrarPainel();
});

btnSair.addEventListener('click', async function(){
  await sb.auth.signOut();
  mostrarLogin();
});

function mostrarLogin(){
  telaLogin.style.display = 'flex';
  telaPainel.style.display = 'none';
}

function mostrarPainel(){
  telaLogin.style.display = 'none';
  telaPainel.style.display = 'block';
  carregarLista();
  carregarConfiguracoes();
}

// busca todos os pratos (disponiveis ou nao) pra mostrar na lista do painel
async function carregarLista(){
  listaPratos.innerHTML = '<p>Carregando...</p>';
  const { data, error } = await sb.from('pratos').select('*').order('categoria').order('ordem');

  if(error){
    listaPratos.innerHTML = '<p>Erro ao carregar: ' + error.message + '</p>';
    return;
  }
  if(data.length === 0){
    listaPratos.innerHTML = '<p>Nenhum item cadastrado ainda. Usa o formulário acima pra adicionar o primeiro.</p>';
    return;
  }

  listaPratos.innerHTML = data.map(function(p){
    const fotoHtml = p.foto_url
      ? '<img src="' + p.foto_url + '" alt="">'
      : '<div class="sem-foto">sem foto</div>';

    return '<div class="item-lista">' +
      fotoHtml +
      '<div class="item-info">' +
        '<strong>' + escapeHtml(p.nome) + '</strong>' +
        '<span>' + (p.categoria === 'burger' ? 'Burger' : 'Espetinho') + ' · R$ ' + Number(p.preco).toFixed(2).replace('.', ',') + '</span>' +
      '</div>' +
      '<div class="item-acoes">' +
        '<button class="btn-mini ' + (p.disponivel ? 'ok' : 'esgotado') + '" data-acao="toggle" data-id="' + p.id + '" data-disp="' + p.disponivel + '">' +
          (p.disponivel ? 'Disponível' : 'Esgotado') +
        '</button>' +
        '<button class="btn-mini" data-acao="editar" data-id="' + p.id + '">Editar</button>' +
        '<button class="btn-mini perigo" data-acao="excluir" data-id="' + p.id + '">Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// cliques nos botoes da lista (disponivel/esgotado, editar, excluir)
listaPratos.addEventListener('click', async function(e){
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = btn.dataset.id;
  const acao = btn.dataset.acao;

  if(acao === 'toggle'){
    const dispAtual = btn.dataset.disp === 'true';
    await sb.from('pratos').update({ disponivel: !dispAtual }).eq('id', id);
    carregarLista();
  }

  if(acao === 'excluir'){
    const confirmou = confirm('Tem certeza que quer excluir esse item? Não tem como desfazer depois.');
    if(!confirmou) return;
    await sb.from('pratos').delete().eq('id', id);
    carregarLista();
  }

  if(acao === 'editar'){
    const { data } = await sb.from('pratos').select('*').eq('id', id).single();
    if(data){ carregarNoFormulario(data); }
  }
});

// preenche o formulario com os dados de um prato pra editar
function carregarNoFormulario(prato){
  editandoId = prato.id;
  tituloForm.textContent = 'Editar item';
  document.getElementById('campo-nome').value = prato.nome;
  document.getElementById('campo-descricao').value = prato.descricao || '';
  document.getElementById('campo-preco').value = prato.preco;
  document.getElementById('campo-categoria').value = prato.categoria;
  document.getElementById('campo-disponivel').checked = prato.disponivel;
  btnCancelarEdicao.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

btnCancelarEdicao.addEventListener('click', function(){
  limparFormulario();
});

function limparFormulario(){
  editandoId = null;
  tituloForm.textContent = 'Adicionar item novo';
  formPrato.reset();
  document.getElementById('campo-disponivel').checked = true;
  btnCancelarEdicao.style.display = 'none';
}

// envio do formulario - cria um item novo ou atualiza o que ta sendo editado
formPrato.addEventListener('submit', async function(e){
  e.preventDefault();
  msgForm.textContent = 'Salvando...';

  const nome = document.getElementById('campo-nome').value.trim();
  const descricao = document.getElementById('campo-descricao').value.trim();
  const preco = parseFloat(document.getElementById('campo-preco').value);
  const categoria = document.getElementById('campo-categoria').value;
  const disponivel = document.getElementById('campo-disponivel').checked;
  const arquivoFoto = document.getElementById('campo-foto').files[0];

  if(!nome || isNaN(preco)){
    msgForm.textContent = 'Preenche pelo menos o nome e o preço.';
    return;
  }

  const dadosPrato = { nome: nome, descricao: descricao, preco: preco, categoria: categoria, disponivel: disponivel };

  // se escolheu uma foto, faz o upload antes de salvar
  if(arquivoFoto){
    const nomeArquivo = Date.now() + '-' + arquivoFoto.name.replace(/\s+/g, '-');
    const { error: erroUpload } = await sb.storage.from('fotos-cardapio').upload(nomeArquivo, arquivoFoto);

    if(erroUpload){
      msgForm.textContent = 'Erro ao enviar a foto: ' + erroUpload.message;
      return;
    }

    const urlData = sb.storage.from('fotos-cardapio').getPublicUrl(nomeArquivo).data;
    dadosPrato.foto_url = urlData.publicUrl;
  }

  let resultado;
  if(editandoId){
    resultado = await sb.from('pratos').update(dadosPrato).eq('id', editandoId);
  } else {
    resultado = await sb.from('pratos').insert(dadosPrato);
  }

  if(resultado.error){
    msgForm.textContent = 'Erro ao salvar: ' + resultado.error.message;
    return;
  }

  msgForm.textContent = 'Salvo!';
  limparFormulario();
  carregarLista();
  setTimeout(function(){ msgForm.textContent = ''; }, 2500);
});

// evita que nome/descricao com caracter estranho quebre o html da lista
function escapeHtml(texto){
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// ===== INFORMACOES DO SITE (configuracoes) =====

const formConfig = document.getElementById('form-config');
const msgConfig = document.getElementById('msg-config');

// busca a linha de configuracoes (id = 1) e preenche o formulario
async function carregarConfiguracoes(){
  const { data, error } = await sb.from('configuracoes').select('*').eq('id', 1).single();

  if(error){
    msgConfig.textContent = 'Erro ao carregar informações: ' + error.message;
    return;
  }

  document.getElementById('config-cidade').value = data.cidade || '';
  document.getElementById('config-whatsapp').value = data.whatsapp || '';
  document.getElementById('config-endereco').value = data.endereco || '';
  document.getElementById('config-horario-semana').value = data.horario_semana || '';
  document.getElementById('config-horario-fds').value = data.horario_fds || '';
  document.getElementById('config-dia-folga').value = data.dia_folga || '';
  document.getElementById('config-instagram').value = data.instagram || '';
  document.getElementById('config-facebook').value = data.facebook || '';
  document.getElementById('config-mapa-embed').value = data.mapa_embed || '';
}

// salva as informacoes do site (sempre atualiza a linha id = 1)
formConfig.addEventListener('submit', async function(e){
  e.preventDefault();
  msgConfig.textContent = 'Salvando...';

  const dadosConfig = {
    cidade: document.getElementById('config-cidade').value.trim(),
    whatsapp: document.getElementById('config-whatsapp').value.trim(),
    endereco: document.getElementById('config-endereco').value.trim(),
    horario_semana: document.getElementById('config-horario-semana').value.trim(),
    horario_fds: document.getElementById('config-horario-fds').value.trim(),
    dia_folga: document.getElementById('config-dia-folga').value.trim(),
    instagram: document.getElementById('config-instagram').value.trim(),
    facebook: document.getElementById('config-facebook').value.trim(),
    mapa_embed: document.getElementById('config-mapa-embed').value.trim()
  };

  const { error } = await sb.from('configuracoes').update(dadosConfig).eq('id', 1);

  if(error){
    msgConfig.textContent = 'Erro ao salvar: ' + error.message;
    return;
  }

  msgConfig.textContent = 'Salvo!';
  setTimeout(function(){ msgConfig.textContent = ''; }, 2500);
});

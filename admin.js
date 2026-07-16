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
  carregarFotosFachada();
  carregarListaCombos();
  carregarAvaliacoes();
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
  document.getElementById('config-telefone').value = data.telefone || '';
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
    telefone: document.getElementById('config-telefone').value.trim(),
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

// ===== FOTOS DO LOCAL (carrossel da secao Sobre) =====

const formFotoFachada = document.getElementById('form-foto-fachada');
const listaFotosFachada = document.getElementById('lista-fotos-fachada');
const msgFotoFachada = document.getElementById('msg-foto-fachada');

// busca as fotos ja cadastradas e mostra a lista com botao de excluir
async function carregarFotosFachada(){
  listaFotosFachada.innerHTML = '<p>Carregando...</p>';
  const { data, error } = await sb.from('fotos_fachada').select('*').order('ordem');

  if(error){
    listaFotosFachada.innerHTML = '<p>Erro ao carregar: ' + error.message + '</p>';
    return;
  }
  if(data.length === 0){
    listaFotosFachada.innerHTML = '<p>Nenhuma foto cadastrada ainda.</p>';
    return;
  }

  listaFotosFachada.innerHTML = data.map(function(f){
    return '<div class="item-lista">' +
      '<img src="' + f.foto_url + '" alt="">' +
      '<div class="item-info"><span>Foto da fachada</span></div>' +
      '<div class="item-acoes">' +
        '<button class="btn-mini perigo" data-acao="excluir-foto" data-id="' + f.id + '">Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// envia a foto escolhida pro storage e salva o link na tabela
formFotoFachada.addEventListener('submit', async function(e){
  e.preventDefault();
  msgFotoFachada.textContent = 'Enviando...';

  const arquivo = document.getElementById('campo-foto-fachada').files[0];
  if(!arquivo){
    msgFotoFachada.textContent = 'Escolhe uma foto primeiro.';
    return;
  }

  const nomeArquivo = Date.now() + '-' + arquivo.name.replace(/\s+/g, '-');
  const { error: erroUpload } = await sb.storage.from('fotos-cardapio').upload(nomeArquivo, arquivo);

  if(erroUpload){
    msgFotoFachada.textContent = 'Erro ao enviar: ' + erroUpload.message;
    return;
  }

  const urlData = sb.storage.from('fotos-cardapio').getPublicUrl(nomeArquivo).data;
  const { error: erroInsert } = await sb.from('fotos_fachada').insert({ foto_url: urlData.publicUrl });

  if(erroInsert){
    msgFotoFachada.textContent = 'Erro ao salvar: ' + erroInsert.message;
    return;
  }

  msgFotoFachada.textContent = 'Foto enviada!';
  formFotoFachada.reset();
  carregarFotosFachada();
  setTimeout(function(){ msgFotoFachada.textContent = ''; }, 2500);
});

// clique no botao de excluir foto
listaFotosFachada.addEventListener('click', async function(e){
  const btn = e.target.closest('button');
  if(!btn || btn.dataset.acao !== 'excluir-foto') return;

  const confirmou = confirm('Tem certeza que quer excluir essa foto?');
  if(!confirmou) return;

  await sb.from('fotos_fachada').delete().eq('id', btn.dataset.id);
  carregarFotosFachada();
});

// ===== COMBOS (banner em rotacao no site) =====

const formCombo = document.getElementById('form-combo');
const listaCombos = document.getElementById('lista-combos');
const tituloFormCombo = document.getElementById('titulo-form-combo');
const btnCancelarCombo = document.getElementById('btn-cancelar-combo');
const msgCombo = document.getElementById('msg-combo');

let editandoComboId = null; // quando nao for null, o formulario esta editando esse combo

// busca todos os combos (disponiveis ou nao) pra mostrar na lista do painel
async function carregarListaCombos(){
  listaCombos.innerHTML = '<p>Carregando...</p>';
  const { data, error } = await sb.from('combos').select('*').order('ordem');

  if(error){
    listaCombos.innerHTML = '<p>Erro ao carregar: ' + error.message + '</p>';
    return;
  }
  if(data.length === 0){
    listaCombos.innerHTML = '<p>Nenhum combo cadastrado ainda. Usa o formulário acima pra adicionar o primeiro.</p>';
    return;
  }

  listaCombos.innerHTML = data.map(function(c){
    return '<div class="item-lista">' +
      '<div class="item-info">' +
        '<strong>' + escapeHtml(c.nome) + '</strong>' +
        '<span>R$ ' + Number(c.preco).toFixed(2).replace('.', ',') + '</span>' +
      '</div>' +
      '<div class="item-acoes">' +
        '<button class="btn-mini ' + (c.disponivel ? 'ok' : 'esgotado') + '" data-acao="toggle-combo" data-id="' + c.id + '" data-disp="' + c.disponivel + '">' +
          (c.disponivel ? 'Disponível' : 'Esgotado') +
        '</button>' +
        '<button class="btn-mini" data-acao="editar-combo" data-id="' + c.id + '">Editar</button>' +
        '<button class="btn-mini perigo" data-acao="excluir-combo" data-id="' + c.id + '">Excluir</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// cliques nos botoes da lista de combos (disponivel/esgotado, editar, excluir)
listaCombos.addEventListener('click', async function(e){
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = btn.dataset.id;
  const acao = btn.dataset.acao;

  if(acao === 'toggle-combo'){
    const dispAtual = btn.dataset.disp === 'true';
    await sb.from('combos').update({ disponivel: !dispAtual }).eq('id', id);
    carregarListaCombos();
  }

  if(acao === 'excluir-combo'){
    const confirmou = confirm('Tem certeza que quer excluir esse combo? Não tem como desfazer depois.');
    if(!confirmou) return;
    await sb.from('combos').delete().eq('id', id);
    carregarListaCombos();
  }

  if(acao === 'editar-combo'){
    const { data } = await sb.from('combos').select('*').eq('id', id).single();
    if(data){ carregarComboNoFormulario(data); }
  }
});

// preenche o formulario com os dados de um combo pra editar
function carregarComboNoFormulario(combo){
  editandoComboId = combo.id;
  tituloFormCombo.textContent = 'Editar combo';
  document.getElementById('combo-nome').value = combo.nome;
  document.getElementById('combo-descricao').value = combo.descricao || '';
  document.getElementById('combo-preco').value = combo.preco;
  document.getElementById('combo-disponivel').checked = combo.disponivel;
  btnCancelarCombo.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

btnCancelarCombo.addEventListener('click', function(){
  limparFormularioCombo();
});

function limparFormularioCombo(){
  editandoComboId = null;
  tituloFormCombo.textContent = 'Adicionar combo novo';
  formCombo.reset();
  document.getElementById('combo-disponivel').checked = true;
  btnCancelarCombo.style.display = 'none';
}

// envio do formulario - cria um combo novo ou atualiza o que ta sendo editado
formCombo.addEventListener('submit', async function(e){
  e.preventDefault();
  msgCombo.textContent = 'Salvando...';

  const nome = document.getElementById('combo-nome').value.trim();
  const descricao = document.getElementById('combo-descricao').value.trim();
  const preco = parseFloat(document.getElementById('combo-preco').value);
  const disponivel = document.getElementById('combo-disponivel').checked;

  if(!nome || isNaN(preco)){
    msgCombo.textContent = 'Preenche pelo menos o nome e o preço.';
    return;
  }

  const dadosCombo = { nome: nome, descricao: descricao, preco: preco, disponivel: disponivel };

  let resultado;
  if(editandoComboId){
    resultado = await sb.from('combos').update(dadosCombo).eq('id', editandoComboId);
  } else {
    resultado = await sb.from('combos').insert(dadosCombo);
  }

  if(resultado.error){
    msgCombo.textContent = 'Erro ao salvar: ' + resultado.error.message;
    return;
  }

  msgCombo.textContent = 'Salvo!';
  limparFormularioCombo();
  carregarListaCombos();
  setTimeout(function(){ msgCombo.textContent = ''; }, 2500);
});

// ===== AVALIACOES (moderacao) =====

const tituloAvaliacoes = document.getElementById('titulo-avaliacoes');
const listaAvaliacoesPendentes = document.getElementById('lista-avaliacoes-pendentes');
const listaAvaliacoesPublicadas = document.getElementById('lista-avaliacoes-publicadas');

// deixa a data bonitinha, tipo 16/07/2026
function formatarData(dataIso){
  const data = new Date(dataIso);
  return data.toLocaleDateString('pt-BR');
}

// monta o texto das estrelas com a quantidade real de estrelas cheias
function renderEstrelasAdmin(qtd){
  let texto = '';
  for(let i = 1; i <= 5; i++){
    texto += i <= qtd ? '★' : '☆';
  }
  return texto;
}

// desenha um card de avaliacao na lista (o botao de aprovar so aparece se pedirem)
function cardAvaliacao(a, mostrarAprovar){
  const botaoAprovar = mostrarAprovar
    ? '<button class="btn-mini ok" data-acao="aprovar-avaliacao" data-id="' + a.id + '">Aprovar</button>'
    : '';

  return '<div class="item-lista">' +
    '<div class="item-info">' +
      '<strong>' + escapeHtml(a.nome) + '</strong>' +
      '<span>' + renderEstrelasAdmin(a.estrelas) + ' · ' + formatarData(a.criado_em) + '</span>' +
      '<p class="item-comentario">' + escapeHtml(a.comentario) + '</p>' +
    '</div>' +
    '<div class="item-acoes">' +
      botaoAprovar +
      '<button class="btn-mini perigo" data-acao="excluir-avaliacao" data-id="' + a.id + '">Excluir</button>' +
    '</div>' +
  '</div>';
}

// busca todas as avaliacoes e separa entre pendentes e publicadas
async function carregarAvaliacoes(){
  listaAvaliacoesPendentes.innerHTML = '<p>Carregando...</p>';
  listaAvaliacoesPublicadas.innerHTML = '<p>Carregando...</p>';

  const { data, error } = await sb.from('avaliacoes').select('*').order('criado_em', { ascending: false });

  if(error){
    listaAvaliacoesPendentes.innerHTML = '<p>Erro ao carregar: ' + error.message + '</p>';
    listaAvaliacoesPublicadas.innerHTML = '';
    return;
  }

  const pendentes = data.filter(function(a){ return !a.aprovado; });
  const publicadas = data.filter(function(a){ return a.aprovado; });

  tituloAvaliacoes.textContent = pendentes.length > 0
    ? 'Avaliações (' + pendentes.length + ' pendentes)'
    : 'Avaliações';

  listaAvaliacoesPendentes.innerHTML = pendentes.length === 0
    ? '<p>Nenhuma avaliação pendente.</p>'
    : pendentes.map(function(a){ return cardAvaliacao(a, true); }).join('');

  listaAvaliacoesPublicadas.innerHTML = publicadas.length === 0
    ? '<p>Nenhuma avaliação publicada ainda.</p>'
    : publicadas.map(function(a){ return cardAvaliacao(a, false); }).join('');
}

// cliques nos botoes de aprovar/excluir (funciona pras duas listas)
async function cliqueAvaliacao(e){
  const btn = e.target.closest('button');
  if(!btn) return;
  const id = btn.dataset.id;
  const acao = btn.dataset.acao;

  if(acao === 'aprovar-avaliacao'){
    await sb.from('avaliacoes').update({ aprovado: true }).eq('id', id);
    carregarAvaliacoes();
  }

  if(acao === 'excluir-avaliacao'){
    const confirmou = confirm('Tem certeza que quer excluir essa avaliação?');
    if(!confirmou) return;
    await sb.from('avaliacoes').delete().eq('id', id);
    carregarAvaliacoes();
  }
}

listaAvaliacoesPendentes.addEventListener('click', cliqueAvaliacao);
listaAvaliacoesPublicadas.addEventListener('click', cliqueAvaliacao);

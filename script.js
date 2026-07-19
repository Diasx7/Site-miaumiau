// conecta no supabase usando as chaves que estao no config.js
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// guarda todos os pratos ja carregados, pra achar os dados quando abre o modal
let cachePratos = [];

// busca os pratos disponiveis no banco e desenha na tela
async function carregarCardapio(){
  const { data, error } = await sb
    .from('pratos')
    .select('*')
    .eq('disponivel', true)
    .order('ordem', { ascending: true });

  if(error){
    console.error('erro ao buscar cardapio', error);
    document.getElementById('burgers').innerHTML = '<p style="color:var(--creme-fraco);font-size:14px;">Não foi possível carregar o cardápio agora.</p>';
    document.getElementById('espetinhos').innerHTML = '';
    return;
  }

  cachePratos = data;
  desenhaGrupo('burgers', data.filter(function(p){ return p.categoria === 'burger'; }));
  desenhaGrupo('espetinhos', data.filter(function(p){ return p.categoria === 'espetinho'; }));
}

// desenha os cards de um grupo (burgers ou espetinhos) dentro do container certo
function desenhaGrupo(idGrupo, pratos){
  const container = document.getElementById(idGrupo);
  if(!container) return;

  if(pratos.length === 0){
    container.innerHTML = '<p style="color:var(--creme-fraco);font-size:14px;">Nenhum item disponível no momento.</p>';
    return;
  }

  container.innerHTML = pratos.map(function(p){
    const fotoHtml = p.foto_url
      ? '<img class="prato-foto" src="' + p.foto_url + '" alt="' + escapeHtml(p.nome) + '">'
      : '';
    return '<div class="prato" data-id="' + p.id + '">' +
      fotoHtml +
      '<div class="prato-linha">' +
        '<div class="prato-nome">' + escapeHtml(p.nome) + '</div>' +
        '<div class="prato-preco">R$ ' + Number(p.preco).toFixed(2).replace('.', ',') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// clique num card do cardapio abre o modal de pedido com os detalhes do prato
document.querySelector('.grade-cardapio').addEventListener('click', function(e){
  const cartao = e.target.closest('.prato');
  if(!cartao) return;
  const prato = cachePratos.find(function(p){ return String(p.id) === cartao.dataset.id; });
  if(prato) abrirModalPedido(prato);
});

// ===== MODAL DE PEDIDO (usado tanto pelo prato quanto pelo combo) =====

const modalPrato = document.getElementById('modal-prato');
const modalFoto = document.getElementById('modal-foto');
const modalNome = document.getElementById('modal-nome');
const modalDescricao = document.getElementById('modal-descricao');
const modalPreco = document.getElementById('modal-preco');
const btnFecharModal = document.getElementById('btn-fechar-modal');
const blocoBebida = document.getElementById('bloco-bebida');
const chipsBebida = document.getElementById('chips-bebida');
const blocoMolho = document.getElementById('bloco-molho');
const chipsMolho = document.getElementById('chips-molho');
const modalTotalValor = document.getElementById('modal-total-valor');
const modalCodigo = document.getElementById('modal-codigo');
const btnPedirWhatsapp = document.getElementById('btn-pedir-whatsapp');

let bebidasDisponiveis = [];
let molhosDisponiveis = [];
let bebidaSelecionada = null; // null = "sem bebida"
let molhoSelecionado = null; // null = "sem molho"
let itemAtual = null; // prato ou combo que esta aberto no modal
let codigoPedido = '';
let whatsappNumero = ''; // vem da tabela configuracoes

// busca as bebidas e molhos disponiveis (usados nos chips do modal)
async function carregarAdicionais(){
  const { data, error } = await sb
    .from('adicionais')
    .select('*')
    .eq('disponivel', true)
    .order('ordem', { ascending: true });

  if(error){
    console.error('erro ao buscar adicionais', error);
    return;
  }

  bebidasDisponiveis = data.filter(function(a){ return a.tipo === 'bebida'; });
  molhosDisponiveis = data.filter(function(a){ return a.tipo === 'molho'; });
}

// gera um codigo curto pro pedido, tipo #MM-4821
function gerarCodigoPedido(){
  const numero = Math.floor(1000 + Math.random() * 9000);
  return '#MM-' + numero;
}

// monta os chips de uma lista de adicionais (bebida ou molho), com a opcao "sem X" primeiro
function montarChips(lista, nomeAdicional){
  let html = '<button type="button" class="chip chip-selecionado" data-id="">Sem ' + nomeAdicional + '</button>';
  html += lista.map(function(item){
    const precoTexto = Number(item.preco) > 0 ? ('R$ ' + Number(item.preco).toFixed(2).replace('.', ',')) : 'Grátis';
    return '<button type="button" class="chip" data-id="' + item.id + '">' + escapeHtml(item.nome) + ' <small>' + precoTexto + '</small></button>';
  }).join('');
  return html;
}

// marca visualmente qual chip ta selecionado dentro de um container
function selecionarChip(container, chipClicado){
  container.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('chip-selecionado'); });
  chipClicado.classList.add('chip-selecionado');
}

chipsBebida.addEventListener('click', function(e){
  const chip = e.target.closest('.chip');
  if(!chip) return;
  selecionarChip(chipsBebida, chip);
  bebidaSelecionada = chip.dataset.id ? bebidasDisponiveis.find(function(b){ return String(b.id) === chip.dataset.id; }) : null;
  atualizarTotal();
});

chipsMolho.addEventListener('click', function(e){
  const chip = e.target.closest('.chip');
  if(!chip) return;
  selecionarChip(chipsMolho, chip);
  molhoSelecionado = chip.dataset.id ? molhosDisponiveis.find(function(m){ return String(m.id) === chip.dataset.id; }) : null;
  atualizarTotal();
});

// soma prato/combo + bebida + molho e atualiza o total e o botao do whatsapp
function atualizarTotal(){
  let total = Number(itemAtual.preco);
  if(bebidaSelecionada) total += Number(bebidaSelecionada.preco);
  if(molhoSelecionado) total += Number(molhoSelecionado.preco);
  modalTotalValor.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
  atualizarBotaoWhatsapp(total);
}

// monta a mensagem do whatsapp com o codigo do pedido e os itens escolhidos
function atualizarBotaoWhatsapp(total){
  if(!whatsappNumero){
    btnPedirWhatsapp.style.display = 'none';
    modalCodigo.style.display = 'none';
    return;
  }

  btnPedirWhatsapp.style.display = '';
  modalCodigo.style.display = '';
  modalCodigo.textContent = 'Código do pedido: ' + codigoPedido;

  let mensagem = 'Pedido ' + codigoPedido + ' — Olá! Quero pedir: 1x ' + itemAtual.nome;
  if(bebidaSelecionada) mensagem += ' + ' + bebidaSelecionada.nome;
  if(molhoSelecionado) mensagem += ' + ' + molhoSelecionado.nome;
  mensagem += ' — Total: R$ ' + total.toFixed(2).replace('.', ',');

  btnPedirWhatsapp.href = 'https://wa.me/' + whatsappNumero + '?text=' + encodeURIComponent(mensagem);
}

// abre o modal de pedido pra um prato ou um combo (os dois usam { nome, preco, descricao, foto_url })
function abrirModalPedido(item){
  itemAtual = item;

  if(item.foto_url){
    modalFoto.src = item.foto_url;
    modalFoto.style.display = 'block';
  } else {
    modalFoto.style.display = 'none';
  }
  modalNome.textContent = item.nome;
  modalDescricao.textContent = item.descricao || '';
  modalPreco.textContent = 'R$ ' + Number(item.preco).toFixed(2).replace('.', ',');

  // bloco de bebida - so aparece se tiver bebida cadastrada
  bebidaSelecionada = null;
  if(bebidasDisponiveis.length > 0){
    chipsBebida.innerHTML = montarChips(bebidasDisponiveis, 'bebida');
    blocoBebida.style.display = 'block';
  } else {
    blocoBebida.style.display = 'none';
  }

  // bloco de molho - so aparece se tiver molho cadastrado
  molhoSelecionado = null;
  if(molhosDisponiveis.length > 0){
    chipsMolho.innerHTML = montarChips(molhosDisponiveis, 'molho');
    blocoMolho.style.display = 'block';
  } else {
    blocoMolho.style.display = 'none';
  }

  codigoPedido = gerarCodigoPedido();
  atualizarTotal();

  modalPrato.classList.add('aberto');
}

function fecharModalPedido(){
  modalPrato.classList.remove('aberto');
}

btnFecharModal.addEventListener('click', fecharModalPedido);

// fecha o modal se clicar fora da caixa (no fundo escurecido)
modalPrato.addEventListener('click', function(e){
  if(e.target === modalPrato) fecharModalPedido();
});

// evita que nome/descricao com caracter estranho quebre o html
function escapeHtml(texto){
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// troca de aba do cardapio (burgers / espetinhos)
var abas = document.querySelectorAll('.aba-btn');
abas.forEach(function(btn){
  btn.addEventListener('click', function(){
    abas.forEach(function(b){ b.classList.remove('ativa'); });
    btn.classList.add('ativa');
    document.querySelectorAll('.grupo-pratos').forEach(function(g){ g.classList.remove('ativo'); });
    document.getElementById(btn.dataset.aba).classList.add('ativo');
  });
});

// ===== MENU MOBILE (hamburguer) =====

const btnMenuMobile = document.querySelector('.menu-hamburguer');
const navMobile = document.querySelector('header nav');

btnMenuMobile.addEventListener('click', function(e){
  e.stopPropagation();
  navMobile.classList.toggle('aberto');
  btnMenuMobile.classList.toggle('ativo');
});

// fecha o menu ao clicar num link
navMobile.querySelectorAll('a').forEach(function(link){
  link.addEventListener('click', function(){
    navMobile.classList.remove('aberto');
    btnMenuMobile.classList.remove('ativo');
  });
});

// fecha o menu se clicar fora dele
document.addEventListener('click', function(e){
  if(navMobile.classList.contains('aberto') && !navMobile.contains(e.target) && !btnMenuMobile.contains(e.target)){
    navMobile.classList.remove('aberto');
    btnMenuMobile.classList.remove('ativo');
  }
});

// efeito de revelar a secao conforme rola a pagina
var observador = new IntersectionObserver(function(entradas){
  entradas.forEach(function(item){
    if(item.isIntersecting){ item.target.classList.add('show'); }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(function(el){ observador.observe(el); });

// ===== CARROSSEL DE FOTOS DA FACHADA (secao Sobre) =====

// busca as fotos da fachada e monta o carrossel dentro do .sobre-foto
async function carregarFotosFachada(){
  const { data, error } = await sb
    .from('fotos_fachada')
    .select('*')
    .order('ordem', { ascending: true });

  if(error || !data || data.length === 0){
    if(error) console.error('erro ao buscar fotos da fachada', error);
    return; // mantem o placeholder que ja esta no html
  }

  const container = document.getElementById('carrossel-fachada');
  const placeholder = document.getElementById('carrossel-placeholder');
  if(!container) return;
  placeholder.style.display = 'none';

  data.forEach(function(foto, indice){
    const img = document.createElement('img');
    img.src = foto.foto_url;
    img.alt = 'Foto da fachada';
    if(indice === 0) img.classList.add('ativa');
    container.appendChild(img);
  });

  // com mais de uma foto, troca sozinho a cada 5 segundos com fade
  if(data.length > 1){
    const imagens = container.querySelectorAll('img');
    let indiceAtual = 0;
    setInterval(function(){
      imagens[indiceAtual].classList.remove('ativa');
      indiceAtual = (indiceAtual + 1) % imagens.length;
      imagens[indiceAtual].classList.add('ativa');
    }, 5000);
  }
}

// ===== COMBO EM ROTACAO (banner da secao Combo) =====

let combosDisponiveis = [];
let indiceComboAtual = 0; // guarda qual combo ta sendo mostrado agora, pra abrir o modal certo no clique

// busca os combos disponiveis e mostra o banner (ou esconde a secao se nao tiver nenhum)
async function carregarCombos(){
  const secaoCombo = document.getElementById('combo');
  const banner = document.getElementById('combo-banner');

  const { data, error } = await sb
    .from('combos')
    .select('*')
    .eq('disponivel', true)
    .order('ordem', { ascending: true });

  if(error){
    console.error('erro ao buscar combos', error);
    secaoCombo.style.display = 'none';
    return;
  }

  if(data.length === 0){
    secaoCombo.style.display = 'none';
    return;
  }

  combosDisponiveis = data;
  indiceComboAtual = 0;
  desenhaCombo(0);

  // com mais de um combo, troca sozinho a cada 6 segundos com fade
  if(data.length > 1){
    setInterval(function(){
      indiceComboAtual = (indiceComboAtual + 1) % combosDisponiveis.length;
      banner.style.opacity = 0;
      setTimeout(function(){
        desenhaCombo(indiceComboAtual);
        banner.style.opacity = 1;
      }, 600);
    }, 6000);
  }
}

// desenha o combo de um indice dentro do banner
function desenhaCombo(indice){
  const banner = document.getElementById('combo-banner');
  const c = combosDisponiveis[indice];
  banner.innerHTML =
    '<div>' +
      '<span class="combo-eyebrow">Combo da Casa</span>' +
      '<h3>' + escapeHtml(c.nome) + '</h3>' +
      '<p>' + escapeHtml(c.descricao || '') + '</p>' +
    '</div>' +
    '<div class="combo-preco">R$ ' + Number(c.preco).toFixed(2).replace('.', ',') + '</div>';
}

// clique no banner abre o modal de pedido com o combo que ta sendo mostrado
document.getElementById('combo-banner').addEventListener('click', function(){
  if(combosDisponiveis.length === 0) return;
  abrirModalPedido(combosDisponiveis[indiceComboAtual]);
});

// deixa o numero de whatsapp bonitinho: 5534999999999 -> (34) 99999-9999
function formatarWhatsapp(numero){
  let numeros = numero.replace(/\D/g, '');
  if(numeros.length === 13 && numeros.startsWith('55')){
    numeros = numeros.slice(2); // tira o codigo do brasil
  }
  if(numeros.length === 11){
    return '(' + numeros.slice(0, 2) + ') ' + numeros.slice(2, 7) + '-' + numeros.slice(7);
  }
  return numero; // formato diferente do esperado, mostra do jeito que veio
}

// pega só o usuario do link do instagram e coloca @ na frente
function formatarInstagram(link){
  const partes = link.split('/').filter(Boolean);
  const usuario = partes[partes.length - 1] || link;
  return usuario.startsWith('@') ? usuario : '@' + usuario;
}

// ===== AVALIACOES DE CLIENTES =====

// monta o texto das estrelas com a quantidade real de estrelas cheias
function renderEstrelas(qtd){
  let texto = '';
  for(let i = 1; i <= 5; i++){
    texto += i <= qtd ? '★' : '☆';
  }
  return texto;
}

// busca as avaliacoes aprovadas (mais recentes primeiro, no maximo 6) e desenha na tela
// a secao continua visivel mesmo sem nenhuma aprovada, pra sempre dar pra deixar a primeira avaliacao
async function carregarAvaliacoes(){
  const listaAvaliacoes = document.getElementById('lista-avaliacoes');

  const { data, error } = await sb
    .from('avaliacoes')
    .select('*')
    .eq('aprovado', true)
    .order('criado_em', { ascending: false })
    .limit(6);

  if(error){
    console.error('erro ao buscar avaliacoes', error);
    listaAvaliacoes.innerHTML = '';
    return;
  }

  if(data.length === 0){
    listaAvaliacoes.innerHTML = '<p style="color:var(--creme-fraco);font-size:14px;">Seja o primeiro a avaliar!</p>';
    return;
  }

  listaAvaliacoes.innerHTML = data.map(function(a){
    return '<div class="depo-card">' +
      '<div class="estrelas">' + renderEstrelas(a.estrelas) + '</div>' +
      '<p class="depo-texto">"' + escapeHtml(a.comentario) + '"</p>' +
      '<div class="depo-nome">— ' + escapeHtml(a.nome) + '</div>' +
    '</div>';
  }).join('');
}

// ===== FORMULARIO/MODAL DE NOVA AVALIACAO =====

const modalAvaliacao = document.getElementById('modal-avaliacao');
const btnAbrirAvaliacao = document.getElementById('btn-abrir-avaliacao');
const btnFecharAvaliacao = document.getElementById('btn-fechar-avaliacao');
const formAvaliacao = document.getElementById('form-avaliacao');
const msgAvaliacao = document.getElementById('msg-avaliacao');
const inputComentario = document.getElementById('avaliacao-comentario');
const contadorComentario = document.getElementById('contador-comentario');
const botoesEstrela = document.querySelectorAll('.estrela-btn');

let notaEscolhida = 0;

// se ja mandou avaliacao nessa sessao, deixa o botao desabilitado
if(sessionStorage.getItem('avaliacaoEnviada')){
  btnAbrirAvaliacao.textContent = 'Avaliação enviada, obrigado!';
  btnAbrirAvaliacao.disabled = true;
}

btnAbrirAvaliacao.addEventListener('click', function(){
  modalAvaliacao.classList.add('aberto');
});

btnFecharAvaliacao.addEventListener('click', function(){
  modalAvaliacao.classList.remove('aberto');
});

// fecha o modal se clicar fora da caixa
modalAvaliacao.addEventListener('click', function(e){
  if(e.target === modalAvaliacao) modalAvaliacao.classList.remove('aberto');
});

// clique numa estrela escolhe a nota (preenche ela e todas as anteriores)
botoesEstrela.forEach(function(btn){
  btn.addEventListener('click', function(){
    notaEscolhida = Number(btn.dataset.valor);
    botoesEstrela.forEach(function(b){
      b.classList.toggle('selecionada', Number(b.dataset.valor) <= notaEscolhida);
    });
  });
});

// contador de caracteres do comentario
inputComentario.addEventListener('input', function(){
  contadorComentario.textContent = inputComentario.value.length + '/300';
});

// envio da avaliacao - sempre entra como nao aprovada, esperando o dono liberar
formAvaliacao.addEventListener('submit', async function(e){
  e.preventDefault();

  const nome = document.getElementById('avaliacao-nome').value.trim();
  const comentario = inputComentario.value.trim();

  if(!nome || !comentario || notaEscolhida === 0){
    msgAvaliacao.textContent = 'Preenche o nome, a nota e o comentário.';
    return;
  }

  msgAvaliacao.textContent = 'Enviando...';

  const { error } = await sb.from('avaliacoes').insert({
    nome: nome,
    estrelas: notaEscolhida,
    comentario: comentario,
    aprovado: false
  });

  if(error){
    msgAvaliacao.textContent = 'Erro ao enviar: ' + error.message;
    return;
  }

  sessionStorage.setItem('avaliacaoEnviada', 'true');
  msgAvaliacao.textContent = 'Recebemos sua avaliação! Ela aparece aqui depois de aprovada.';
  formAvaliacao.reset();
  notaEscolhida = 0;
  botoesEstrela.forEach(function(b){ b.classList.remove('selecionada'); });
  contadorComentario.textContent = '0/300';

  setTimeout(function(){
    modalAvaliacao.classList.remove('aberto');
    msgAvaliacao.textContent = '';
    btnAbrirAvaliacao.textContent = 'Avaliação enviada, obrigado!';
    btnAbrirAvaliacao.disabled = true;
  }, 2500);
});

// busca a linha de configuracoes do site (cidade, whatsapp, endereco...) e aplica no html
async function carregarConfiguracoes(){
  const { data, error } = await sb
    .from('configuracoes')
    .select('*')
    .eq('id', 1)
    .single();

  if(error){
    console.error('erro ao buscar configuracoes', error);
    return;
  }

  // cidade no eyebrow do hero
  if(data.cidade){
    const eyebrow = document.querySelector('.hero-eyebrow');
    if(eyebrow) eyebrow.textContent = data.cidade + ' • Burgers & Espetinhos';
  }

  // whatsapp no botao do header (e guarda o numero pro botao de pedir no modal)
  if(data.whatsapp){
    const btnWhats = document.getElementById('btn-whatsapp-header');
    if(btnWhats) btnWhats.href = 'https://wa.me/' + data.whatsapp;
    whatsappNumero = data.whatsapp;
  }

  // endereco
  if(data.endereco){
    const textoEndereco = document.getElementById('texto-endereco');
    if(textoEndereco) textoEndereco.textContent = data.endereco;
  }

  // horarios
  if(data.horario_semana){
    const valorSemana = document.getElementById('valor-horario-semana');
    if(valorSemana) valorSemana.textContent = data.horario_semana;
  }
  if(data.horario_fds){
    const valorFds = document.getElementById('valor-horario-fds');
    if(valorFds) valorFds.textContent = data.horario_fds;
  }
  if(data.dia_folga){
    const valorFolga = document.getElementById('valor-dia-folga');
    if(valorFolga) valorFolga.textContent = data.dia_folga;
  }

  // redes sociais no footer
  if(data.instagram){
    const linkInsta = document.getElementById('link-instagram-footer');
    if(linkInsta) linkInsta.href = data.instagram;
  }
  if(data.facebook){
    const linkFace = document.getElementById('link-facebook-footer');
    if(linkFace) linkFace.href = data.facebook;
  }

  // bloco de contato (whatsapp, telefone, instagram) - esconde a linha se estiver vazio
  const linhaWhats = document.getElementById('linha-contato-whatsapp');
  const valorWhats = document.getElementById('valor-contato-whatsapp');
  if(data.whatsapp && linhaWhats && valorWhats){
    valorWhats.textContent = formatarWhatsapp(data.whatsapp);
    linhaWhats.style.display = 'block';
  } else if(linhaWhats){
    linhaWhats.style.display = 'none';
  }

  const linhaTelefone = document.getElementById('linha-contato-telefone');
  const valorTelefone = document.getElementById('valor-contato-telefone');
  if(data.telefone && linhaTelefone && valorTelefone){
    valorTelefone.textContent = data.telefone;
    linhaTelefone.style.display = 'block';
  } else if(linhaTelefone){
    linhaTelefone.style.display = 'none';
  }

  const linhaInsta = document.getElementById('linha-contato-instagram');
  const valorInsta = document.getElementById('valor-contato-instagram');
  if(data.instagram && linhaInsta && valorInsta){
    valorInsta.textContent = formatarInstagram(data.instagram);
    linhaInsta.style.display = 'block';
  } else if(linhaInsta){
    linhaInsta.style.display = 'none';
  }

  // mapa: se tiver o iframe preenchido, troca o bloco fake pela moldura com o mapa de verdade
  if(data.mapa_embed){
    const mapaFake = document.querySelector('.mapa-fake');
    if(mapaFake){
      mapaFake.classList.remove('mapa-fake');
      mapaFake.classList.add('mapa-moldura');
      mapaFake.innerHTML = data.mapa_embed;
    }
  }
}

// busca o cardapio, fotos, combos, adicionais, avaliacoes e configuracoes assim que a pagina carrega
carregarCardapio();
carregarFotosFachada();
carregarCombos();
carregarAdicionais();
carregarAvaliacoes();
carregarConfiguracoes();

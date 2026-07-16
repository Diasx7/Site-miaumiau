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

// clique num card do cardapio abre o modal com os detalhes do prato
document.querySelector('.grade-cardapio').addEventListener('click', function(e){
  const cartao = e.target.closest('.prato');
  if(!cartao) return;
  const prato = cachePratos.find(function(p){ return String(p.id) === cartao.dataset.id; });
  if(prato) abrirModalPrato(prato);
});

// ===== MODAL DO PRATO =====

const modalPrato = document.getElementById('modal-prato');
const modalFoto = document.getElementById('modal-foto');
const modalNome = document.getElementById('modal-nome');
const modalDescricao = document.getElementById('modal-descricao');
const modalPreco = document.getElementById('modal-preco');
const btnFecharModal = document.getElementById('btn-fechar-modal');

function abrirModalPrato(prato){
  if(prato.foto_url){
    modalFoto.src = prato.foto_url;
    modalFoto.style.display = 'block';
  } else {
    modalFoto.style.display = 'none';
  }
  modalNome.textContent = prato.nome;
  modalDescricao.textContent = prato.descricao || '';
  modalPreco.textContent = 'R$ ' + Number(prato.preco).toFixed(2).replace('.', ',');
  modalPrato.classList.add('aberto');
}

function fecharModalPrato(){
  modalPrato.classList.remove('aberto');
}

btnFecharModal.addEventListener('click', fecharModalPrato);

// fecha o modal se clicar fora da caixa (no fundo escurecido)
modalPrato.addEventListener('click', function(e){
  if(e.target === modalPrato) fecharModalPrato();
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
  desenhaCombo(0);

  // com mais de um combo, troca sozinho a cada 6 segundos com fade
  if(data.length > 1){
    let indiceCombo = 0;
    setInterval(function(){
      indiceCombo = (indiceCombo + 1) % combosDisponiveis.length;
      banner.style.opacity = 0;
      setTimeout(function(){
        desenhaCombo(indiceCombo);
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

  // whatsapp no botao do header
  if(data.whatsapp){
    const btnWhats = document.getElementById('btn-whatsapp-header');
    if(btnWhats) btnWhats.href = 'https://wa.me/' + data.whatsapp;
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

// busca o cardapio, fotos, combos e configuracoes assim que a pagina carrega
carregarCardapio();
carregarFotosFachada();
carregarCombos();
carregarConfiguracoes();

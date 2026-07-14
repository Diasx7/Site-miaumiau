// conecta no supabase usando as chaves que estao no config.js
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    return '<div class="prato">' +
      '<div>' +
        '<div class="prato-nome">' + escapeHtml(p.nome) + '</div>' +
        '<div class="prato-desc">' + escapeHtml(p.descricao || '') + '</div>' +
      '</div>' +
      '<div class="prato-preco">R$ ' + Number(p.preco).toFixed(2).replace('.', ',') + '</div>' +
    '</div>';
  }).join('');
}

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

  // mapa: se tiver o iframe preenchido, troca o bloco fake pelo mapa de verdade
  if(data.mapa_embed){
    const mapaFake = document.querySelector('.mapa-fake');
    if(mapaFake) mapaFake.outerHTML = data.mapa_embed;
  }
}

// busca o cardapio e as configuracoes assim que a pagina carrega
carregarCardapio();
carregarConfiguracoes();

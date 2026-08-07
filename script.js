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

// clique na grade do cardapio: botao de bebida joga direto no carrinho, card de prato abre o modal
document.querySelector('.grade-cardapio').addEventListener('click', function(e){
  const btnBebida = e.target.closest('.btn-add-bebida');
  if(btnBebida){
    const bebida = bebidasDisponiveis.find(function(b){ return String(b.id) === btnBebida.dataset.id; });
    if(bebida){
      adicionarAoCarrinho(bebida.nome, Number(bebida.preco), []);
      // feedback rapido no botao
      btnBebida.textContent = 'Adicionado ✓';
      setTimeout(function(){ btnBebida.textContent = '+ Adicionar'; }, 1200);
    }
    return;
  }

  // card de combo (das abas de combos) abre o modal montavel
  const cartaoCombo = e.target.closest('[data-combo-id]');
  if(cartaoCombo){
    const combo = combosDisponiveis.find(function(c){ return String(c.id) === cartaoCombo.dataset.comboId; });
    if(combo) abrirModalPedido(combo, true);
    return;
  }

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
const btnAdicionarCarrinho = document.getElementById('btn-adicionar-carrinho');
const blocoItensCombo = document.getElementById('bloco-itens-combo');
const tituloItensCombo = document.getElementById('titulo-itens-combo');
const contadorItensCombo = document.getElementById('contador-itens-combo');
const chipsItensCombo = document.getElementById('chips-itens-combo');
const blocoJantinha = document.getElementById('bloco-jantinha');
const chipJantinha = document.getElementById('chip-jantinha');

let bebidasDisponiveis = [];
let molhosDisponiveis = [];
let bebidaSelecionada = null; // null = "sem bebida"
let molhoSelecionado = null; // null = "sem molho"
let itemAtual = null; // prato ou combo que esta aberto no modal
let comboAberto = false; // true quando o modal esta mostrando um combo montavel
let itensComboEscolhidos = {}; // id do prato -> quantidade escolhida no combo
let jantinhaMarcada = false;
let whatsappNumero = ''; // vem da tabela configuracoes
let taxaEntrega = 0; // vem da tabela configuracoes

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
  desenhaBebidas();
}

// desenha os cards da aba Bebidas (adicionar vai direto pro carrinho, sem modal)
function desenhaBebidas(){
  const container = document.getElementById('bebidas');
  if(!container) return;

  if(bebidasDisponiveis.length === 0){
    container.innerHTML = '<p style="color:var(--creme-fraco);font-size:14px;">Nenhuma bebida disponível no momento.</p>';
    return;
  }

  container.innerHTML = bebidasDisponiveis.map(function(b){
    const precoTexto = Number(b.preco) > 0 ? formatarPreco(b.preco) : 'Grátis';
    return '<div class="prato prato-bebida">' +
      '<div class="prato-linha">' +
        '<div class="prato-nome">' + escapeHtml(b.nome) + '</div>' +
        '<div class="prato-preco">' + precoTexto + '</div>' +
      '</div>' +
      '<div class="bebida-rodape">' +
        '<button type="button" class="btn-add-bebida" data-id="' + b.id + '">+ Adicionar</button>' +
      '</div>' +
    '</div>';
  }).join('');
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

// ===== MONTAGEM DO COMBO (escolher os N itens e a jantinha) =====

// pratos que podem entrar no combo (espetinhos ou burgers, conforme o tipo do combo)
function pratosDoCombo(){
  const categoria = itemAtual.tipo === 'burger' ? 'burger' : 'espetinho';
  return cachePratos.filter(function(p){ return p.categoria === categoria; });
}

// soma quantos itens ja foram escolhidos no combo
function totalItensEscolhidos(){
  let total = 0;
  Object.keys(itensComboEscolhidos).forEach(function(id){ total += itensComboEscolhidos[id]; });
  return total;
}

// desenha os chips dos itens do combo, com badge de quantidade e botao de diminuir
function desenhaChipsCombo(){
  const escolhidos = totalItensEscolhidos();
  const completo = escolhidos >= itemAtual.qtd_itens;

  chipsItensCombo.innerHTML = pratosDoCombo().map(function(p){
    const qtd = itensComboEscolhidos[p.id] || 0;
    let classes = 'chip';
    if(qtd > 0) classes += ' chip-selecionado';
    if(completo && qtd === 0) classes += ' chip-bloqueado'; // ja escolheu tudo, esse chip trava
    let dentro = escapeHtml(p.nome);
    if(qtd > 0){
      // o "menos" diminui, e o badge mostra quantas vezes o item foi escolhido
      dentro = '<span class="chip-menos" data-id="' + p.id + '">−</span> ' + dentro + ' <span class="chip-badge">' + qtd + 'x</span>';
    }
    return '<button type="button" class="' + classes + '" data-id="' + p.id + '">' + dentro + '</button>';
  }).join('');

  contadorItensCombo.textContent = escolhidos + ' de ' + itemAtual.qtd_itens + ' escolhidos';
  atualizarBotaoAdicionar();
}

// clique nos chips do combo: no "menos" diminui, no resto do chip aumenta (se ainda couber)
chipsItensCombo.addEventListener('click', function(e){
  const menos = e.target.closest('.chip-menos');
  if(menos){
    const id = menos.dataset.id;
    itensComboEscolhidos[id] -= 1;
    if(itensComboEscolhidos[id] <= 0) delete itensComboEscolhidos[id];
    desenhaChipsCombo();
    return;
  }

  const chip = e.target.closest('.chip');
  if(!chip) return;
  if(totalItensEscolhidos() >= itemAtual.qtd_itens) return; // ja escolheu todos os itens
  const id = chip.dataset.id;
  itensComboEscolhidos[id] = (itensComboEscolhidos[id] || 0) + 1;
  desenhaChipsCombo();
});

// toggle da jantinha: marca/desmarca e soma no total se for paga
chipJantinha.addEventListener('click', function(){
  jantinhaMarcada = !jantinhaMarcada;
  chipJantinha.classList.toggle('chip-selecionado', jantinhaMarcada);
  atualizarTotal();
});

// o botao de adicionar so libera quando o cliente escolheu os N itens do combo
function atualizarBotaoAdicionar(){
  if(comboAberto && itemAtual.qtd_itens > 0){
    const escolhidos = totalItensEscolhidos();
    if(escolhidos < itemAtual.qtd_itens){
      btnAdicionarCarrinho.disabled = true;
      btnAdicionarCarrinho.textContent = 'Escolha os itens (' + escolhidos + ' de ' + itemAtual.qtd_itens + ')';
      return;
    }
  }
  btnAdicionarCarrinho.disabled = false;
  btnAdicionarCarrinho.textContent = 'Adicionar ao carrinho';
}

// soma prato/combo + jantinha + bebida + molho e atualiza o total mostrado no modal
function atualizarTotal(){
  let total = Number(itemAtual.preco);
  if(comboAberto && jantinhaMarcada) total += Number(itemAtual.preco_jantinha || 0);
  if(bebidaSelecionada) total += Number(bebidaSelecionada.preco);
  if(molhoSelecionado) total += Number(molhoSelecionado.preco);
  modalTotalValor.textContent = formatarPreco(total);
}

// botao do modal: joga o prato/combo com os opcionais escolhidos no carrinho e fecha
btnAdicionarCarrinho.addEventListener('click', function(){
  const opcionais = [];

  // no combo, os itens montados e a jantinha entram como opcionais (aparecem no carrinho e no whatsapp)
  if(comboAberto){
    Object.keys(itensComboEscolhidos).forEach(function(id){
      const prato = cachePratos.find(function(p){ return String(p.id) === String(id); });
      if(!prato) return;
      const qtd = itensComboEscolhidos[id];
      opcionais.push({ nome: (qtd > 1 ? qtd + 'x ' : '') + prato.nome, preco: 0 });
    });
    if(jantinhaMarcada) opcionais.push({ nome: 'Jantinha', preco: Number(itemAtual.preco_jantinha || 0) });
  }

  if(bebidaSelecionada) opcionais.push({ nome: bebidaSelecionada.nome, preco: Number(bebidaSelecionada.preco) });
  if(molhoSelecionado) opcionais.push({ nome: molhoSelecionado.nome, preco: Number(molhoSelecionado.preco) });
  adicionarAoCarrinho(itemAtual.nome, Number(itemAtual.preco), opcionais);
  fecharModalPedido();
});

// abre o modal de pedido pra um prato ou um combo (ehCombo = true liga a parte montavel)
function abrirModalPedido(item, ehCombo){
  itemAtual = item;
  comboAberto = !!ehCombo;
  itensComboEscolhidos = {};
  jantinhaMarcada = false;

  // bloco de escolher os N itens do combo
  if(comboAberto && item.qtd_itens > 0){
    const nomeItem = item.tipo === 'burger' ? 'burger' : 'espetinho';
    tituloItensCombo.textContent = item.qtd_itens === 1
      ? 'Escolha seu ' + nomeItem
      : 'Escolha seus ' + item.qtd_itens + ' ' + nomeItem + 's';
    blocoItensCombo.style.display = 'block';
    desenhaChipsCombo();
  } else {
    blocoItensCombo.style.display = 'none';
  }

  // toggle da jantinha (mostra o preco ou "Incluída")
  if(comboAberto && item.tem_jantinha){
    const precoJant = Number(item.preco_jantinha || 0);
    chipJantinha.innerHTML = precoJant > 0
      ? 'Jantinha <small>+ ' + formatarPreco(precoJant) + '</small>'
      : 'Jantinha <small>Incluída</small>';
    chipJantinha.classList.remove('chip-selecionado');
    blocoJantinha.style.display = 'block';
  } else {
    blocoJantinha.style.display = 'none';
  }

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

  atualizarTotal();
  atualizarBotaoAdicionar();

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

// deixa o preco no formato brasileiro: 12.5 -> R$ 12,50
function formatarPreco(valor){
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
}

// ===== CARRINHO DE COMPRAS =====

const CHAVE_CARRINHO = 'carrinho'; // chave propria no sessionStorage (separada da avaliacao)

const btnCarrinhoFlutuante = document.getElementById('btn-carrinho-flutuante');
const modalCarrinho = document.getElementById('modal-carrinho');
const btnFecharCarrinho = document.getElementById('btn-fechar-carrinho');
const carrinhoCodigo = document.getElementById('carrinho-codigo');
const carrinhoItens = document.getElementById('carrinho-itens');
const toggleEntrega = document.getElementById('toggle-entrega');
const campoEnderecoWrap = document.getElementById('campo-endereco-wrap');
const inputEndereco = document.getElementById('carrinho-endereco');
const inputCupom = document.getElementById('carrinho-cupom');
const btnAplicarCupom = document.getElementById('btn-aplicar-cupom');
const msgCupom = document.getElementById('msg-cupom');
const carrinhoResumo = document.getElementById('carrinho-resumo');
const msgCarrinho = document.getElementById('msg-carrinho');
const btnEnviarPedido = document.getElementById('btn-enviar-pedido');

// o carrinho guarda o codigo do pedido e a lista de itens
let carrinho = { codigo: '', itens: [] };
let formaEntrega = 'entrega'; // 'entrega' ou 'retirada'
let cupomAplicado = null; // linha da tabela cupons quando o cliente aplica um valido

// recupera o carrinho salvo na sessao (se a pessoa navegou e voltou)
function carregarCarrinhoSalvo(){
  const salvo = sessionStorage.getItem(CHAVE_CARRINHO);
  if(!salvo) return;
  try {
    carrinho = JSON.parse(salvo);
  } catch(e) {
    carrinho = { codigo: '', itens: [] };
  }
}

function salvarCarrinho(){
  sessionStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
}

// preco de um item somando o prato + opcionais
function precoUnitario(item){
  let total = Number(item.preco);
  item.opcionais.forEach(function(o){ total += Number(o.preco); });
  return total;
}

// adiciona um item no carrinho - se ja tem um igual (mesmo nome e opcionais), so aumenta a quantidade
function adicionarAoCarrinho(nome, preco, opcionais){
  const chave = nome + '|' + opcionais.map(function(o){ return o.nome; }).join(',');
  const existente = carrinho.itens.find(function(i){ return i.chave === chave; });

  if(existente){
    existente.qtd += 1;
  } else {
    carrinho.itens.push({ chave: chave, nome: nome, preco: preco, opcionais: opcionais, qtd: 1 });
  }

  // o codigo do pedido nasce quando o primeiro item entra e dura a sessao toda
  if(!carrinho.codigo) carrinho.codigo = gerarCodigoPedido();

  salvarCarrinho();
  atualizarBotaoFlutuante();
}

// soma tudo: subtotal dos itens, taxa de entrega e desconto do cupom
function calcularTotais(){
  let subtotal = 0;
  carrinho.itens.forEach(function(i){ subtotal += precoUnitario(i) * i.qtd; });

  let desconto = 0;
  if(cupomAplicado){
    if(cupomAplicado.tipo === 'percentual'){
      desconto = subtotal * Number(cupomAplicado.valor) / 100;
    } else {
      desconto = Number(cupomAplicado.valor);
    }
    if(desconto > subtotal) desconto = subtotal; // desconto nao passa do subtotal
  }

  const taxa = formaEntrega === 'entrega' ? Number(taxaEntrega) : 0;
  const total = subtotal - desconto + taxa;

  return { subtotal: subtotal, desconto: desconto, taxa: taxa, total: total };
}

// mostra/esconde o botao flutuante conforme o carrinho
function atualizarBotaoFlutuante(){
  let qtd = 0;
  carrinho.itens.forEach(function(i){ qtd += i.qtd; });

  if(qtd === 0){
    btnCarrinhoFlutuante.style.display = 'none';
    return;
  }

  let subtotal = 0;
  carrinho.itens.forEach(function(i){ subtotal += precoUnitario(i) * i.qtd; });
  btnCarrinhoFlutuante.textContent = '🛒 Ver carrinho (' + qtd + ') · ' + formatarPreco(subtotal);
  btnCarrinhoFlutuante.style.display = 'flex';
}

// desenha a lista de itens e o resumo dentro do modal do carrinho
function desenhaCarrinho(){
  carrinhoCodigo.textContent = carrinho.codigo;

  if(carrinho.itens.length === 0){
    carrinhoItens.innerHTML = '<p class="carrinho-vazio">Seu carrinho está vazio.</p>';
    carrinhoResumo.innerHTML = '';
    btnEnviarPedido.disabled = true;
    return;
  }

  carrinhoItens.innerHTML = carrinho.itens.map(function(i, indice){
    const opcTexto = i.opcionais.map(function(o){ return escapeHtml(o.nome); }).join(', ');
    return '<div class="carrinho-item">' +
      '<span class="carrinho-item-nome">' + i.qtd + 'x ' + escapeHtml(i.nome) +
        (opcTexto ? ' <small>(' + opcTexto + ')</small>' : '') +
      '</span>' +
      '<span class="carrinho-item-preco">' + formatarPreco(precoUnitario(i) * i.qtd) + '</span>' +
      '<button type="button" class="btn-remover-item" data-indice="' + indice + '" aria-label="remover item">✕</button>' +
    '</div>';
  }).join('');

  const t = calcularTotais();
  let resumoHtml = '<div class="resumo-linha"><span>Subtotal</span><span>' + formatarPreco(t.subtotal) + '</span></div>';
  if(t.taxa > 0){
    resumoHtml += '<div class="resumo-linha"><span>Entrega</span><span>' + formatarPreco(t.taxa) + '</span></div>';
  }
  if(cupomAplicado){
    resumoHtml += '<div class="resumo-linha cupom"><span>Cupom ' + escapeHtml(cupomAplicado.codigo) + '</span><span>- ' + formatarPreco(t.desconto) + '</span></div>';
  }
  resumoHtml += '<div class="resumo-linha total"><span>Total</span><strong>' + formatarPreco(t.total) + '</strong></div>';
  carrinhoResumo.innerHTML = resumoHtml;

  // sem whatsapp configurado nao tem pra onde enviar o pedido
  if(!whatsappNumero){
    btnEnviarPedido.disabled = true;
    msgCarrinho.textContent = 'WhatsApp ainda não configurado, não dá pra enviar o pedido.';
  } else {
    btnEnviarPedido.disabled = false;
  }
}

// abre e fecha o modal do carrinho
btnCarrinhoFlutuante.addEventListener('click', function(){
  msgCarrinho.textContent = '';
  desenhaCarrinho();
  modalCarrinho.classList.add('aberto');
});

btnFecharCarrinho.addEventListener('click', function(){
  modalCarrinho.classList.remove('aberto');
});

modalCarrinho.addEventListener('click', function(e){
  if(e.target === modalCarrinho) modalCarrinho.classList.remove('aberto');
});

// clique no ✕ vermelho remove o item da lista
carrinhoItens.addEventListener('click', function(e){
  const btn = e.target.closest('.btn-remover-item');
  if(!btn) return;
  carrinho.itens.splice(Number(btn.dataset.indice), 1);
  salvarCarrinho();
  atualizarBotaoFlutuante();
  desenhaCarrinho();
});

// alterna entre entrega e retirada
toggleEntrega.addEventListener('click', function(e){
  const chip = e.target.closest('.chip');
  if(!chip) return;
  toggleEntrega.querySelectorAll('.chip').forEach(function(c){ c.classList.remove('chip-selecionado'); });
  chip.classList.add('chip-selecionado');
  formaEntrega = chip.dataset.forma;
  campoEnderecoWrap.style.display = formaEntrega === 'entrega' ? 'block' : 'none';
  msgCarrinho.textContent = '';
  desenhaCarrinho();
});

// valida o cupom digitado na tabela cupons (so acha os ativos, sem diferenciar maiuscula)
btnAplicarCupom.addEventListener('click', async function(){
  const codigo = inputCupom.value.trim();
  if(!codigo) return;

  msgCupom.textContent = 'Verificando...';

  const { data, error } = await sb
    .from('cupons')
    .select('*')
    .ilike('codigo', codigo)
    .eq('ativo', true)
    .limit(1);

  if(error || !data || data.length === 0){
    cupomAplicado = null;
    msgCupom.textContent = 'Cupom inválido';
    desenhaCarrinho();
    return;
  }

  cupomAplicado = data[0];
  msgCupom.textContent = '';
  desenhaCarrinho();
});

// monta a mensagem final e abre o whatsapp com o pedido completo
btnEnviarPedido.addEventListener('click', function(){
  if(carrinho.itens.length === 0 || !whatsappNumero) return;

  const endereco = inputEndereco.value.trim();
  if(formaEntrega === 'entrega' && !endereco){
    msgCarrinho.textContent = 'Preenche o endereço de entrega.';
    return;
  }

  const t = calcularTotais();

  let mensagem = 'Pedido ' + carrinho.codigo + ' — Olá! Quero pedir:\n';
  carrinho.itens.forEach(function(i){
    const opcTexto = i.opcionais.map(function(o){ return o.nome; }).join(', ');
    mensagem += i.qtd + 'x ' + i.nome + (opcTexto ? ' (' + opcTexto + ')' : '') + '\n';
  });
  mensagem += formaEntrega === 'entrega'
    ? 'Entrega: ' + endereco + '\n'
    : 'Retirada no local\n';
  if(cupomAplicado) mensagem += 'Cupom: ' + cupomAplicado.codigo + '\n';
  mensagem += 'Total: ' + formatarPreco(t.total);

  // deixa so os digitos do numero antes de montar o link
  const numeroLimpo = whatsappNumero.replace(/\D/g, '');
  window.open('https://wa.me/' + numeroLimpo + '?text=' + encodeURIComponent(mensagem), '_blank');

  // pedido enviado, zera tudo
  carrinho = { codigo: '', itens: [] };
  sessionStorage.removeItem(CHAVE_CARRINHO);
  cupomAplicado = null;
  inputCupom.value = '';
  inputEndereco.value = '';
  msgCupom.textContent = '';
  modalCarrinho.classList.remove('aberto');
  atualizarBotaoFlutuante();
});

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
    desenhaGrupoCombos('combos-espeto', []);
    desenhaGrupoCombos('combos-burger', []);
    return;
  }

  combosDisponiveis = data;

  // preenche as abas de combos do cardapio, separadas pelo tipo
  desenhaGrupoCombos('combos-espeto', data.filter(function(c){ return c.tipo === 'espeto'; }));
  desenhaGrupoCombos('combos-burger', data.filter(function(c){ return c.tipo === 'burger'; }));

  if(data.length === 0){
    secaoCombo.style.display = 'none';
    return;
  }

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

// desenha os cards de combo de uma aba do cardapio (nome, descricao e preco)
function desenhaGrupoCombos(idGrupo, combos){
  const container = document.getElementById(idGrupo);
  if(!container) return;

  if(combos.length === 0){
    container.innerHTML = '<p style="color:var(--creme-fraco);font-size:14px;">Nenhum combo disponível no momento.</p>';
    return;
  }

  container.innerHTML = combos.map(function(c){
    return '<div class="prato" data-combo-id="' + c.id + '">' +
      '<div class="prato-linha">' +
        '<div class="prato-nome">' + escapeHtml(c.nome) + '</div>' +
        '<div class="prato-preco">' + formatarPreco(c.preco) + '</div>' +
      '</div>' +
      (c.descricao ? '<p class="prato-desc">' + escapeHtml(c.descricao) + '</p>' : '') +
    '</div>';
  }).join('');
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

// clique no banner abre o modal montavel com o combo que ta sendo mostrado
document.getElementById('combo-banner').addEventListener('click', function(){
  if(combosDisponiveis.length === 0) return;
  abrirModalPedido(combosDisponiveis[indiceComboAtual], true);
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

  // whatsapp no botao do header (e guarda o numero pro envio do pedido do carrinho)
  if(data.whatsapp){
    const btnWhats = document.getElementById('btn-whatsapp-header');
    if(btnWhats) btnWhats.href = 'https://wa.me/' + data.whatsapp;
    whatsappNumero = data.whatsapp;
  }

  // taxa de entrega usada no carrinho
  taxaEntrega = Number(data.taxa_entrega) || 0;

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

// recupera o carrinho da sessao e mostra o botao flutuante se tiver item
carregarCarrinhoSalvo();
atualizarBotaoFlutuante();

'use strict';

// ═══════════════════════════════════════════════════════════════
// INTERPRETADOR DE MENSAGENS DO WHATSAPP
// ───────────────────────────────────────────────────────────────
// Recebe um texto livre em português e o transforma em uma ação no
// sistema (caixa, estoque, compra) ou numa consulta. Devolve sempre
// um texto de resposta para mandar de volta no WhatsApp.
//
// Exemplos que entende:
//   "entrou 1850 vendas"            → caixa: entrada R$1850 (Vendas)
//   "saiu 600 fornecedor"           → caixa: saída R$600 (Insumos)
//   "comprei carne 5kg 120"         → compra: preço + entrada no estoque
//   "baixa carne 2kg quebra"        → estoque: baixa de 2kg
//   "contei carne 5kg"              → estoque: ajuste (contagem) p/ 5kg
//   "entrou carne 5kg"              → estoque: entrada de 5kg
//   "caixa" / "caixa hoje"          → consulta do resultado do dia
//   "estoque" / "estoque baixo"     → consulta de estoque
//   "ajuda"                         → lista de comandos
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const cmvCore = require('./cmv');
const estoqueCore = require('./estoque');
const caixaCore = require('./caixa');
const units = require('./units');
const { v4: uuidv4 } = require('uuid');

// ─── utilidades de texto ───────────────────────────────────────
function normalizar(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

// Valor em R$ a partir de texto (aceita 1850 / 1.850,50 / 1850,50 / R$ 120)
function extrairValor(texto) {
  // procura números que NÃO estejam colados a uma unidade (kg/g/l/ml/un)
  const limpo = texto.replace(/r\$\s*/gi, ' ');
  const re = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?!\s*(?:kg|g|l|ml|un|und|unid))/gi;
  const achados = [...limpo.matchAll(re)].map(m => m[1]);
  if (!achados.length) return null;
  // pega o último número "solto" (geralmente o valor vem por último)
  const bruto = achados[achados.length - 1];
  return paraNumero(bruto);
}

function paraNumero(bruto) {
  let s = String(bruto).trim();
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.850,50
  else if (s.includes(',')) s = s.replace(',', '.');                                   // 120,50
  // se só tem ponto, mantém (ex.: 120.50). milhares sem decimal raramente ocorrem aqui.
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Quantidade + unidade (5kg, 500 g, 2un, 1l, 750ml)
function extrairQuantidade(texto) {
  const re = /(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un|und|unid|unidades?)\b/i;
  const m = normalizar(texto).match(re);
  if (!m) return null;
  const valor = paraNumero(m[1]);
  let un = m[2].toLowerCase();
  if (un === 'l') un = 'L';
  if (un.startsWith('un')) un = 'un';
  return { quantidade: valor, unidade: un, original: m[0] };
}

// Acha o ingrediente citado no texto (casa pelo nome ou por palavra do nome)
function acharIngrediente(texto) {
  const norm = normalizar(texto);
  const ings = storage.listarIngredientes();
  let melhor = null, melhorTam = 0;
  for (const i of ings) {
    const nome = normalizar(i.nome);
    const casa = norm.includes(nome) ||
      nome.split(' ').some(p => p.length >= 3 && new RegExp(`\\b${p}`).test(norm));
    if (casa && nome.length > melhorTam) { melhor = i; melhorTam = nome.length; }
  }
  return melhor;
}

// ─── formatação ────────────────────────────────────────────────
function moeda(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function qtdExib(baseQtd, unidadeBase) {
  const fator = units.UNIDADE_EXIBICAO[unidadeBase]?.fator || 1;
  const un = units.UNIDADE_EXIBICAO[unidadeBase]?.unidade || unidadeBase;
  return (baseQtd / fator).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' ' + un;
}
function dataHojeBR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // YYYY-MM-DD
}

// ─── categorias de caixa por palavra-chave ─────────────────────
function categoriaEntrada(t) {
  if (/delivery|ifood|i food|rappi|app|aplicativo/.test(t)) return 'Delivery / App';
  if (/balcao|loja|venda|vendas|dinheiro|pix|cartao/.test(t)) return 'Vendas no Balcão';
  return 'Outras Entradas';
}
function categoriaSaida(t) {
  if (/fornecedor|insumo|mercado|atacad|compra/.test(t)) return 'Compra de Insumos';
  if (/salario|funcionario|diaria|pagamento.*func|folha/.test(t)) return 'Salários / Diárias';
  if (/luz|energia|agua|gas|conta|aluguel|internet/.test(t)) return 'Contas (água, luz, gás)';
  if (/retirada|pro.?labore|dono|socio/.test(t)) return 'Retirada do Dono';
  return 'Outras Saídas';
}

// ─── execuções ─────────────────────────────────────────────────
function lancarCaixa(tipo, valor, categoria, descricao) {
  const data = dataHojeBR();
  storage.salvarLancamento({
    id: uuidv4(), data, tipo, categoria,
    descricao: descricao || 'Lançado via WhatsApp',
    valor: cmvCore.arredondar(valor, 2),
    criado_em: new Date().toISOString(),
    origem: 'whatsapp',
  });
  const resumo = caixaCore.resumoMensal(data.slice(0, 7));
  const dia = resumo.dias.find(d => d.data === data);
  const res = dia ? dia.resultado : 0;
  const sinal = tipo === 'entrada' ? '⬆' : '⬇';
  return `✅ ${sinal} Caixa: ${tipo === 'entrada' ? 'entrada' : 'saída'} de ${moeda(valor)} (${categoria}).\n` +
         `Resultado de hoje: ${res >= 0 ? '+' : ''}${moeda(res)} ${res >= 0 ? '🟢' : '🔴'}`;
}

function ehDimensaoCompativel(ing, unidade) {
  return units.existeUnidade(unidade) && units.unidadeBase(unidade) === ing.unidade_base;
}

function processarMensagem(texto, de) {
  const original = (texto || '').trim();
  const t = normalizar(original);
  const log = { id: uuidv4(), data: new Date().toISOString(), de: de || null, texto: original, sucesso: false, resposta: '' };

  function responder(msg, ok = true, intent = null) {
    log.resposta = msg; log.sucesso = ok; log.intent = intent;
    return { reply: msg, log };
  }

  if (!t) return responder(ajuda(), false, 'vazio');

  // 1) Ajuda / saudação
  if (/^(ajuda|menu|help|comandos|oi|ola|bom dia|boa tarde|boa noite|\?)\b/.test(t)) {
    return responder(ajuda(), true, 'ajuda');
  }

  const qtd = extrairQuantidade(original);

  // 2) Comandos COM quantidade → mexem no ESTOQUE/COMPRA
  if (qtd) {
    const ing = acharIngrediente(original);
    if (!ing) {
      return responder('❓ Não achei esse item no estoque. Cadastre o ingrediente no sistema primeiro (com preço). Itens atuais: ' +
        (storage.listarIngredientes().map(i => i.nome).slice(0, 12).join(', ') || 'nenhum'), false, 'item_nao_encontrado');
    }
    if (!ehDimensaoCompativel(ing, qtd.unidade)) {
      return responder(`⚠️ "${ing.nome}" é medido em ${ing.unidade_base}. Use uma unidade compatível (ex.: ${unidadesSugeridas(ing.unidade_base)}).`, false, 'unidade_incompativel');
    }

    const valor = extrairValor(original.replace(qtd.original, ' ')); // valor após remover a quantidade

    // COMPRA: tem verbo de compra OU veio um valor junto
    if (/compr|paguei|chegou nota|nota fiscal/.test(t) || valor) {
      if (!valor) return responder(`Para registrar a compra preciso do valor. Ex.: "comprei ${ing.nome.toLowerCase()} ${qtd.quantidade}${qtd.unidade} 120".`, false, 'compra_sem_valor');
      return responder(registrarCompra(ing, qtd, valor), true, 'compra');
    }
    // CONTAGEM (ajuste para o valor contado)
    if (/cont(ei|agem|ar)|sobrou|tem agora|fechamento/.test(t)) {
      const r = estoqueCore.aplicarMovimento({ ingrediente_id: ing.id, tipo: 'ajuste', quantidade: qtd.quantidade, unidade: qtd.unidade, motivo: 'Contagem (WhatsApp)' });
      if (r.erro) return responder('⚠️ ' + r.erro, false, 'erro');
      return responder(`✅ Contagem registrada: ${ing.nome} agora com ${qtdExib(r.ingrediente.estoque_atual, ing.unidade_base)} (${moeda(r.ingrediente.estoque_atual * (ing.custo_base || 0))}).`, true, 'contagem');
    }
    // BAIXA (perda/quebra/consumo)
    if (/baixa|perd|quebr|estragou|jogue?i|venceu|vencido|sai(u|ram)/.test(t)) {
      const r = estoqueCore.aplicarMovimento({ ingrediente_id: ing.id, tipo: 'saida', quantidade: qtd.quantidade, unidade: qtd.unidade, motivo: motivoLivre(original, ing, qtd) || 'Baixa (WhatsApp)' });
      if (r.erro) return responder('⚠️ ' + r.erro, false, 'erro');
      return responder(`✅ ➖ Baixa de ${qtd.quantidade}${qtd.unidade} em ${ing.nome}. Sobrou ${qtdExib(r.ingrediente.estoque_atual, ing.unidade_base)}.`, true, 'baixa');
    }
    // ENTRADA (chegou mercadoria, sem valor)
    const r = estoqueCore.aplicarMovimento({ ingrediente_id: ing.id, tipo: 'entrada', quantidade: qtd.quantidade, unidade: qtd.unidade, motivo: 'Entrada (WhatsApp)' });
    if (r.erro) return responder('⚠️ ' + r.erro, false, 'erro');
    return responder(`✅ ➕ Entrada de ${qtd.quantidade}${qtd.unidade} em ${ing.nome}. Estoque: ${qtdExib(r.ingrediente.estoque_atual, ing.unidade_base)}.`, true, 'entrada_estoque');
  }

  // 3) Consultas (sem número)
  if (/^(caixa|resumo|fechamento|hoje)\b/.test(t) || (/caixa/.test(t) && !temNumero(t))) {
    return responder(consultaCaixa(), true, 'consulta_caixa');
  }
  if (/^(estoque|comprar|falta|lista de compras)\b/.test(t) || (/estoque/.test(t) && !temNumero(t))) {
    return responder(consultaEstoque(), true, 'consulta_estoque');
  }

  // 4) Comandos de CAIXA (tem valor, sem quantidade)
  const valor = extrairValor(original);
  if (valor) {
    if (/sai(u|ram)|paguei|gastei|pagamento|despesa|saida|retirada|comprei|fornecedor|conta/.test(t)) {
      return responder(lancarCaixa('saida', valor, categoriaSaida(t), descricaoLivre(original)), true, 'caixa_saida');
    }
    // padrão: entrada
    return responder(lancarCaixa('entrada', valor, categoriaEntrada(t), descricaoLivre(original)), true, 'caixa_entrada');
  }

  // 5) Não entendi
  return responder('🤔 Não entendi. Mande, por exemplo:\n• "entrou 1850 vendas"\n• "saiu 600 fornecedor"\n• "comprei carne 5kg 120"\n• "baixa carne 2kg quebra"\n\nOu digite *ajuda*.', false, 'nao_entendi');
}

function registrarCompra(ing, qtd, valor) {
  const custo_base = cmvCore.calcularCustoBase(valor, qtd.quantidade, qtd.unidade);
  const registro = {
    data: new Date().toISOString(), fornecedor: 'WhatsApp', unidade_compra: qtd.unidade,
    quantidade_comprada: qtd.quantidade, valor_total: valor, custo_base,
  };
  ing.custo_base = custo_base;
  ing.unidade_compra = qtd.unidade;
  ing.historico = [...(ing.historico || []), registro];
  ing.ultima_atualizacao = new Date().toISOString();
  storage.salvarIngrediente(ing);
  const fichas = cmvCore.propagarPreco(ing.id);
  const r = estoqueCore.aplicarMovimento({ ingrediente_id: ing.id, tipo: 'entrada', quantidade: qtd.quantidade, unidade: qtd.unidade, motivo: 'Compra (WhatsApp)' });
  const estoqueTxt = r.ingrediente ? ` Estoque: ${qtdExib(r.ingrediente.estoque_atual, ing.unidade_base)}.` : '';
  const ex = units.exibicao(custo_base, ing.unidade_base);
  const fichasTxt = fichas && fichas.length ? `\n🔄 CMV recalculado: ${fichas.join(', ')}.` : '';
  return `✅ 🛒 Compra: ${ing.nome} ${qtd.quantidade}${qtd.unidade} por ${moeda(valor)} (${moeda(ex.valor)}/${ex.unidade}).${estoqueTxt}${fichasTxt}`;
}

function consultaCaixa() {
  const data = dataHojeBR();
  const resumo = caixaCore.resumoMensal(data.slice(0, 7));
  const dia = resumo.dias.find(d => d.data === data);
  const r = resumo.resumo;
  let msg = `📊 *Caixa de hoje (${data.split('-').reverse().join('/')})*\n`;
  if (dia) {
    msg += `⬆ Entradas: ${moeda(dia.entradas)}\n⬇ Saídas: ${moeda(dia.saidas)}\n` +
           `Resultado: ${dia.resultado >= 0 ? '+' : ''}${moeda(dia.resultado)} ${dia.resultado >= 0 ? '🟢' : '🔴'}\n\n`;
  } else {
    msg += 'Nenhum lançamento hoje ainda.\n\n';
  }
  msg += `*Mês:* entradas ${moeda(r.total_entradas)} · saídas ${moeda(r.total_saidas)} · resultado ${moeda(r.resultado)}`;
  return msg;
}

function consultaEstoque() {
  const p = estoqueCore.panorama();
  let msg = `📦 *Estoque*\nValor parado: ${moeda(p.valor_total_estoque)}\n`;
  if (p.lista_compras.length) {
    msg += `\n🛒 *Precisa comprar (${p.lista_compras.length}):*\n` +
      p.lista_compras.slice(0, 15).map(i => `• ${i.nome} — ${i.situacao === 'zerado' ? 'sem estoque' : 'tem ' + i.estoque_exibicao + i.unidade_exibicao}`).join('\n');
  } else {
    msg += '\n✅ Nada abaixo do mínimo.';
  }
  return msg;
}

function temNumero(t) { return /\d/.test(t); }
function unidadesSugeridas(base) {
  return ({ g: 'kg ou g', ml: 'L ou ml', un: 'un' })[base] || base;
}
function descricaoLivre(texto) {
  // remove números e R$ para sobrar uma descrição curta
  const s = texto.replace(/r\$\s*/gi, '').replace(/\d[\d.,]*/g, '').replace(/\s+/g, ' ').trim();
  return s.length > 2 ? s.charAt(0).toUpperCase() + s.slice(1) : null;
}
function motivoLivre(texto, ing, qtd) {
  let s = normalizar(texto).replace(normalizar(ing.nome), '').replace(qtd.original, '');
  s = s.replace(/\b(baixa|perda|perdi|perdeu|quebra|quebrou|estragou|joguei|jogue|fora|venceu|vencido|saiu|de|do|da)\b/g, '').replace(/\s+/g, ' ').trim();
  return s || null;
}

function ajuda() {
  return '🍔 *Comandos do CMV pelo WhatsApp*\n\n' +
    '💰 *Caixa*\n• entrou 1850 vendas\n• saiu 600 fornecedor\n• saiu 300 salário\n\n' +
    '📦 *Estoque*\n• comprei carne 5kg 120  (preço + entrada)\n• entrou carne 5kg  (chegou mercadoria)\n• baixa carne 2kg quebra  (perda)\n• contei carne 5kg  (contagem)\n\n' +
    '📊 *Consultas*\n• caixa  (resultado do dia)\n• estoque  (valor + o que comprar)\n\n' +
    'Dica: o nome do item precisa estar cadastrado no sistema.';
}

module.exports = { processarMensagem, _internos: { normalizar, extrairValor, extrairQuantidade, acharIngrediente } };

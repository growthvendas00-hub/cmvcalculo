'use strict';

// ═══════════════════════════════════════════════════════════════
// CONTROLE DE ESTOQUE
// ───────────────────────────────────────────────────────────────
// O estoque de cada ingrediente é guardado SEMPRE na unidade base
// (g / ml / un), igual ao custo. Assim "5 kg" viram 5000 g e o
// valor parado em estoque = quantidade_base × custo_base.
//
// Movimentos:
//   entrada → compra ou reposição (soma ao estoque)
//   saida   → perda, quebra, consumo (subtrai do estoque)
//   ajuste  → contagem de inventário (define o valor absoluto)
// ═══════════════════════════════════════════════════════════════

const storage = require('./storage');
const units = require('./units');
const { arredondar } = require('./cmv');

// Quantidade base atual do ingrediente (tolerante a campo ausente/legado)
function estoqueAtual(ing) {
  const v = Number(ing.estoque_atual);
  return Number.isFinite(v) ? v : 0;
}

function estoqueMinimo(ing) {
  const v = Number(ing.estoque_minimo);
  return Number.isFinite(v) ? v : 0;
}

// Situação do item para a lista de compras
function situacao(atual, minimo) {
  if (atual <= 0) return { classe: 'zerado', rotulo: 'Sem estoque' };
  if (minimo > 0 && atual <= minimo) return { classe: 'baixo', rotulo: 'Abaixo do mínimo' };
  return { classe: 'ok', rotulo: 'Em estoque' };
}

// Monta a visão de estoque de um ingrediente (quantidade, valor, situação)
function visaoIngrediente(ing) {
  const atual = estoqueAtual(ing);
  const minimo = estoqueMinimo(ing);
  const custo_base = Number(ing.custo_base) || 0;
  const valor_estoque = arredondar(atual * custo_base, 2);
  const ex = units.exibicao(custo_base, ing.unidade_base); // unidade amigável p/ exibir
  const exFator = units.UNIDADE_EXIBICAO[ing.unidade_base]?.fator || 1;
  const s = situacao(atual, minimo);

  return {
    id: ing.id,
    nome: ing.nome,
    unidade_base: ing.unidade_base,
    unidade_exibicao: ex.unidade,
    fator_exibicao: exFator,                 // base × fator? não: base / fator p/ exibir
    custo_base,
    tem_preco: custo_base > 0,
    estoque_base: atual,
    minimo_base: minimo,
    // valores "amigáveis" para exibir (kg/L/un)
    estoque_exibicao: arredondar(atual / exFator, 3),
    minimo_exibicao: arredondar(minimo / exFator, 3),
    valor_estoque,
    situacao: s.classe,
    situacao_rotulo: s.rotulo,
  };
}

// Aplica um movimento e retorna o ingrediente atualizado + registro salvo
function aplicarMovimento({ ingrediente_id, tipo, quantidade, unidade, motivo }) {
  const ing = storage.buscarIngredientePorId(ingrediente_id);
  if (!ing) return { erro: 'Ingrediente não encontrado.' };

  const tiposValidos = ['entrada', 'saida', 'ajuste'];
  if (!tiposValidos.includes(tipo)) return { erro: 'Tipo de movimento inválido.' };

  const qtd = Number(quantidade);
  if (!(qtd >= 0) || (tipo !== 'ajuste' && qtd <= 0)) {
    return { erro: 'Informe uma quantidade válida.' };
  }

  // Converte a quantidade informada para a unidade base
  const un = unidade || ing.unidade_base;
  if (!units.existeUnidade(un)) return { erro: 'Unidade inválida.' };
  if (units.unidadeBase(un) !== ing.unidade_base) {
    return { erro: `Unidade incompatível: "${ing.nome}" é medido em ${ing.unidade_base}.` };
  }
  const qtdBase = arredondar(units.paraBase(qtd, un), 3);

  const anterior = estoqueAtual(ing);
  let novo;
  if (tipo === 'entrada') novo = anterior + qtdBase;
  else if (tipo === 'saida') novo = anterior - qtdBase;
  else novo = qtdBase; // ajuste = valor absoluto contado

  novo = arredondar(Math.max(0, novo), 3);

  ing.estoque_atual = novo;
  ing.ultima_atualizacao = new Date().toISOString();
  storage.salvarIngrediente(ing);

  const registro = {
    id: require('uuid').v4(),
    ingrediente_id,
    ingrediente_nome: ing.nome,
    tipo,
    quantidade_base: tipo === 'ajuste' ? arredondar(novo - anterior, 3) : qtdBase,
    unidade_base: ing.unidade_base,
    estoque_antes: anterior,
    estoque_depois: novo,
    motivo: (motivo || '').trim() || null,
    data: new Date().toISOString(),
  };
  storage.salvarMovimento(registro);

  return { ingrediente: ing, movimento: registro };
}

// Visão geral do estoque (lista + totais + lista de compras)
function panorama() {
  const itens = storage.listarIngredientes().map(visaoIngrediente);

  const valor_total = arredondar(itens.reduce((s, i) => s + i.valor_estoque, 0), 2);
  const lista_compras = itens
    .filter(i => i.situacao !== 'ok')
    .sort((a, b) => {
      const ordem = { zerado: 0, baixo: 1 };
      return (ordem[a.situacao] - ordem[b.situacao]) || a.nome.localeCompare(b.nome, 'pt-BR');
    });

  itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    itens,
    valor_total_estoque: valor_total,
    total_itens: itens.length,
    itens_zerados: itens.filter(i => i.situacao === 'zerado').length,
    itens_abaixo_minimo: itens.filter(i => i.situacao === 'baixo').length,
    lista_compras,
  };
}

module.exports = {
  estoqueAtual,
  estoqueMinimo,
  visaoIngrediente,
  aplicarMovimento,
  panorama,
};
